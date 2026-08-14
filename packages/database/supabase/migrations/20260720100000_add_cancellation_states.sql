-- Add 'cancelled' to video_status ENUM
ALTER TYPE video_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Add cancellation tracking fields to jobs table
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS cancel_requested_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cancel_requested_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cancel_reason text;
