-- =============================================================================
-- Seed 001: System Defaults — Phase 1
--
-- Seeds:
-- 1. System default stickman animation rig with full action taxonomy
-- 2. Two system video_style_presets: stickman_animation and documentary
--
-- NOTE: A workspace row is NOT seeded here — it must be created after
-- the first user signs up (the owner_id FK requires an existing auth.users row).
-- The application creates the workspace on first login.
--
-- Reference: docs/EDD.md §19.1 (action taxonomy), §4.3 (style presets)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- System Default Stickman Rig
-- workspace_id IS NULL → system asset, visible to all users
-- -----------------------------------------------------------------------------
INSERT INTO animation_rigs (
  id,
  workspace_id,
  name,
  style,
  available_actions,
  rig_config,
  version
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  NULL,
  'Default Stickman',
  'stickman',
  ARRAY[
    'idle_talk',
    'walk_left',
    'walk_right',
    'point_forward',
    'argue_mild',
    'argue_intense',
    'celebrate',
    'laugh',
    'wave',
    'shrug',
    'nod',
    'head_shake',
    'cry',
    'facepalm',
    'surprised_jump',
    'look_around',
    'flinch',
    'sit_idle',
    'lean_wall',
    'cross_arms',
    'run',
    'stand_idle'
  ],
  '{
    "skeleton": {
      "joints": [
        "head", "torso",
        "left_shoulder", "left_elbow", "left_hand",
        "right_shoulder", "right_elbow", "right_hand",
        "left_hip", "left_knee", "left_foot",
        "right_hip", "right_knee", "right_foot"
      ],
      "boneLengthsPx": {
        "torso": 120,
        "upper_arm": 60,
        "forearm": 55,
        "thigh": 70,
        "shin": 65
      }
    },
    "palette": {
      "stroke": "#1A1A1A",
      "fill": "#FFFFFF",
      "accent": "#3B82F6"
    },
    "componentRef": "templates/character-rig/default_stickman/Rig",
    "actions": {
      "idle_talk":      { "keyframesRef": "actions/idle_talk.json",      "loopable": true,  "syncsTo": "phoneme" },
      "walk_left":      { "keyframesRef": "actions/walk_left.json",      "loopable": true,  "syncsTo": "beat" },
      "walk_right":     { "keyframesRef": "actions/walk_right.json",     "loopable": true,  "syncsTo": "beat" },
      "run":            { "keyframesRef": "actions/run.json",             "loopable": true,  "syncsTo": "beat" },
      "stand_idle":     { "keyframesRef": "actions/stand_idle.json",     "loopable": true,  "syncsTo": "none" },
      "point_forward":  { "keyframesRef": "actions/point_forward.json",  "loopable": false, "syncsTo": "emphasis_word" },
      "nod":            { "keyframesRef": "actions/nod.json",            "loopable": false, "syncsTo": "emphasis_word" },
      "head_shake":     { "keyframesRef": "actions/head_shake.json",     "loopable": false, "syncsTo": "none" },
      "argue_mild":     { "keyframesRef": "actions/argue_mild.json",     "loopable": true,  "syncsTo": "phoneme" },
      "argue_intense":  { "keyframesRef": "actions/argue_intense.json",  "loopable": true,  "syncsTo": "phoneme" },
      "celebrate":      { "keyframesRef": "actions/celebrate.json",      "loopable": false, "syncsTo": "none" },
      "laugh":          { "keyframesRef": "actions/laugh.json",          "loopable": false, "syncsTo": "phoneme" },
      "wave":           { "keyframesRef": "actions/wave.json",           "loopable": false, "syncsTo": "none" },
      "shrug":          { "keyframesRef": "actions/shrug.json",          "loopable": false, "syncsTo": "none" },
      "cry":            { "keyframesRef": "actions/cry.json",            "loopable": true,  "syncsTo": "phoneme" },
      "facepalm":       { "keyframesRef": "actions/facepalm.json",       "loopable": false, "syncsTo": "none" },
      "surprised_jump": { "keyframesRef": "actions/surprised_jump.json", "loopable": false, "syncsTo": "none" },
      "look_around":    { "keyframesRef": "actions/look_around.json",    "loopable": true,  "syncsTo": "beat" },
      "flinch":         { "keyframesRef": "actions/flinch.json",         "loopable": false, "syncsTo": "none" },
      "sit_idle":       { "keyframesRef": "actions/sit_idle.json",       "loopable": true,  "syncsTo": "phoneme" },
      "lean_wall":      { "keyframesRef": "actions/lean_wall.json",      "loopable": true,  "syncsTo": "none" },
      "cross_arms":     { "keyframesRef": "actions/cross_arms.json",     "loopable": true,  "syncsTo": "none" }
    }
  }'::jsonb,
  1
) ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- System Video Style Preset: Stickman Animation
-- visual_type_weights: 70% character_animation, 30% broll background plates
-- -----------------------------------------------------------------------------
INSERT INTO video_style_presets (
  id,
  workspace_id,
  style,
  name,
  visual_type_weights,
  default_rig_id,
  default_camera_pacing,
  default_transition,
  allow_scene_override
) VALUES (
  '00000000-0000-0000-0001-000000000001',
  NULL,
  'stickman_animation',
  'Stickman Animation',
  '{"character_animation": 0.7, "broll": 0.3}'::jsonb,
  '00000000-0000-0000-0000-000000000001',
  'medium',
  'fade',
  TRUE
) ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- System Video Style Preset: Documentary
-- visual_type_weights: 60% broll, 30% ai_image, 10% kinetic_typography
-- -----------------------------------------------------------------------------
INSERT INTO video_style_presets (
  id,
  workspace_id,
  style,
  name,
  visual_type_weights,
  default_rig_id,
  default_camera_pacing,
  default_transition,
  allow_scene_override
) VALUES (
  '00000000-0000-0000-0001-000000000002',
  NULL,
  'documentary',
  'Documentary',
  '{"broll": 0.6, "ai_image": 0.3, "kinetic_typography": 0.1}'::jsonb,
  NULL,
  'slow',
  'fade',
  TRUE
) ON CONFLICT (id) DO NOTHING;

