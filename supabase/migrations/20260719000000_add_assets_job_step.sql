-- Add 'assets' as a valid job_step enum value.
ALTER TYPE public.job_step ADD VALUE IF NOT EXISTS 'assets' AFTER 'subtitle_extraction';
