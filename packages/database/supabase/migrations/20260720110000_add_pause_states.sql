-- Migration: add_pause_states

-- 1. Add 'paused' to video_status enum
ALTER TYPE video_status ADD VALUE IF NOT EXISTS 'paused';

-- 2. Add pause tracking columns to jobs table
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS pause_requested_at timestamptz,
ADD COLUMN IF NOT EXISTS pause_requested_by uuid REFERENCES auth.users(id);
