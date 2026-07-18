CREATE TYPE public.job_event_type AS ENUM (
  'started',
  'finished',
  'failed',
  'retrying'
);

CREATE TABLE public.job_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  event_type public.job_event_type NOT NULL,
  job_step public.job_step NOT NULL,
  message text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indices
CREATE INDEX idx_job_events_job_id ON public.job_events(job_id);

-- RLS
ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their job events via projects"
  ON public.job_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.projects p ON j.project_id = p.id
      WHERE j.id = job_events.job_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage job events"
  ON public.job_events FOR ALL
  USING (true)
  WITH CHECK (true);
