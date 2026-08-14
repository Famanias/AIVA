-- Create log level enum
CREATE TYPE log_level AS ENUM ('debug', 'info', 'warn', 'error');

-- Create pipeline logs table
CREATE TABLE pipeline_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    stage job_step,
    level log_level NOT NULL,
    source VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;

-- Project owners can view logs for jobs in their projects
CREATE POLICY "Users can view pipeline logs for their projects"
    ON pipeline_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM jobs j
            JOIN projects p ON j.project_id = p.id
            WHERE j.id = pipeline_logs.job_id
            AND p.user_id = auth.uid()
        )
    );

-- Index for querying logs by job_id efficiently (very important for live UI)
CREATE INDEX idx_pipeline_logs_job_id ON pipeline_logs(job_id);

-- Index for created_at to support sorting and retention policies
CREATE INDEX idx_pipeline_logs_created_at ON pipeline_logs(created_at DESC);
