-- =============================================================================
-- Migration 001: Core Schema — Phase 1 (Prove the Loop)
--
-- This migration creates the P1-scoped database schema.
-- Multi-tenancy tables (workspace_members, channels), RLS policies,
-- render_cache, and video_exports are intentionally excluded from P1.
-- They will be added in P2/P3 migrations.
--
-- Reference: docs/EDD.md §13.1
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

CREATE TYPE video_status AS ENUM (
  'draft',
  'queued',
  'generating',
  'awaiting_approval',
  'rendered',
  'failed',
  'completed'
);

CREATE TYPE job_step AS ENUM (
  'research',
  'outline',
  'script_direction',
  'brand_safety_check',
  'voiceover',
  'subtitle_extraction',
  'scene_preview',
  'scene_render',
  'composition',
  'rendering',
  'thumbnail',
  'metadata',
  'cost_reconciliation',
  'upload',
  'notify'
);

CREATE TYPE scene_visual_type AS ENUM (
  'character_animation',
  'broll',
  'ai_image',
  'kinetic_typography',
  'avatar'
);

CREATE TYPE video_style AS ENUM (
  'stickman_animation',
  'documentary',
  'kinetic_typography',
  'avatar_narration',
  'mixed_custom'
);

CREATE TYPE rig_style AS ENUM (
  'stickman',
  'branded_character'
);

-- -----------------------------------------------------------------------------
-- Workspaces
-- P1: A single row is seeded; multi-tenancy is a P3 feature.
-- -----------------------------------------------------------------------------
CREATE TABLE workspaces (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  VARCHAR(120) NOT NULL,
  plan                  VARCHAR(30) NOT NULL DEFAULT 'starter',
  monthly_cost_cap_usd  NUMERIC(10, 2) DEFAULT 50.00,
  created_at            TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- -----------------------------------------------------------------------------
-- Animation Rigs
-- P1: System default rigs seeded in 001_defaults.sql
-- P2: Management UI added
-- -----------------------------------------------------------------------------
CREATE TABLE animation_rigs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID REFERENCES workspaces(id) ON DELETE CASCADE, -- NULL = system rig
  cloned_from_rig_id    UUID REFERENCES animation_rigs(id),
  name                  VARCHAR(100) NOT NULL,
  style                 rig_style DEFAULT 'stickman',
  available_actions     TEXT[] NOT NULL,
  rig_config            JSONB NOT NULL,
  version               INT NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- -----------------------------------------------------------------------------
-- Video Style Presets
-- P1: System presets seeded in 001_defaults.sql
-- P3: Workspace-custom presets
-- -----------------------------------------------------------------------------
CREATE TABLE video_style_presets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID REFERENCES workspaces(id) ON DELETE CASCADE, -- NULL = system preset
  style                 video_style NOT NULL,
  name                  VARCHAR(100) NOT NULL,
  -- visual_type_weights: {"character_animation": 0.7, "broll": 0.3}
  visual_type_weights   JSONB NOT NULL,
  default_rig_id        UUID REFERENCES animation_rigs(id),
  default_camera_pacing VARCHAR(30) DEFAULT 'medium',
  default_transition    VARCHAR(30) DEFAULT 'fade',
  allow_scene_override  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- -----------------------------------------------------------------------------
-- Projects (one project = one video)
-- channel_id is nullable in P1 — channels are a P3 concept.
-- -----------------------------------------------------------------------------
CREATE TABLE projects (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id              UUID,  -- nullable P1; FK to channels added in P3 migration
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                   VARCHAR(255) NOT NULL,
  topic                   TEXT NOT NULL,
  language                VARCHAR(10) DEFAULT 'en',
  video_style             video_style NOT NULL DEFAULT 'stickman_animation',
  style_preset_id         UUID REFERENCES video_style_presets(id),
  status                  video_status NOT NULL DEFAULT 'draft',
  cost_accumulated        NUMERIC(10, 4) DEFAULT 0.0000,
  duration_target_minutes SMALLINT DEFAULT 20,
  created_at              TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- -----------------------------------------------------------------------------
-- Scenes
-- current_version_id FK is added after scene_versions table is created (below).
-- -----------------------------------------------------------------------------
CREATE TABLE scenes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sequence_number         INT NOT NULL,
  current_version_id      UUID,  -- FK added below after scene_versions exists
  voiceover_url           TEXT,
  voiceover_word_timings  JSONB,
  preview_url             TEXT,  -- [P2] fast preview asset
  render_url              TEXT,  -- full-quality rendered segment
  render_status           video_status NOT NULL DEFAULT 'draft',
  duration                NUMERIC(6, 2) DEFAULT 0.00,
  created_at              TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (project_id, sequence_number)
);

-- -----------------------------------------------------------------------------
-- Scene Versions (immutable — edits append rows, never overwrite)
-- [P2 feature] — table created in P1 so the schema is forward-compatible.
-- -----------------------------------------------------------------------------
CREATE TABLE scene_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id              UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  version_number        INT NOT NULL,
  script_segment        TEXT NOT NULL,
  visual_type           scene_visual_type NOT NULL,
  animation_rig_id      UUID REFERENCES animation_rigs(id),
  animation_action      VARCHAR(64),
  typography_template   VARCHAR(64),
  camera_style          VARCHAR(32),
  background_broll_url  TEXT,
  transition            VARCHAR(32) DEFAULT 'fade',
  emotional_tone        VARCHAR(32),
  broll_search_keywords TEXT,
  visual_prompt         TEXT,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (scene_id, version_number)
);

-- Add current_version_id FK now that scene_versions exists
ALTER TABLE scenes
  ADD CONSTRAINT fk_current_version
  FOREIGN KEY (current_version_id)
  REFERENCES scene_versions(id);

-- -----------------------------------------------------------------------------
-- Distributed Jobs
-- state_payload stores enough context to resume from any pipeline stage.
-- -----------------------------------------------------------------------------
CREATE TABLE jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  current_step  job_step NOT NULL,
  progress      INT NOT NULL DEFAULT 0,
  attempt_count INT NOT NULL DEFAULT 0,
  error_log     TEXT,
  state_payload JSONB,
  updated_at    TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- -----------------------------------------------------------------------------
-- Cost Ledger
-- Populated from P1 — every pipeline stage records its cost.
-- P3 adds a dashboard on top of this data.
-- -----------------------------------------------------------------------------
CREATE TABLE cost_ledger_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  job_step         job_step NOT NULL,
  provider         VARCHAR(60) NOT NULL,
  amount_usd       NUMERIC(10, 5) NOT NULL,
  units_consumed   NUMERIC(12, 4),
  created_at       TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- -----------------------------------------------------------------------------
-- Indexes (EDD §13.3)
-- -----------------------------------------------------------------------------
CREATE INDEX idx_scenes_project_seq        ON scenes (project_id, sequence_number);
CREATE INDEX idx_scene_versions_scene      ON scene_versions (scene_id, version_number DESC);
CREATE INDEX idx_jobs_project_step         ON jobs (project_id, current_step);
CREATE INDEX idx_cost_ledger_project       ON cost_ledger_entries (project_id, job_step);
CREATE INDEX idx_projects_user_status      ON projects (user_id, status);

-- -----------------------------------------------------------------------------
-- updated_at trigger for projects
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
