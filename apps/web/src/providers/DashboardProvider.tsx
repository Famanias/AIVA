'use client'

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@aiva/shared-types'
import { PipelineTelemetry, JobRow, ProjectRow, JobEventRow, PipelineLogRow, PipelineStage } from '../types/telemetry'

interface DashboardContextType {
  telemetry: PipelineTelemetry
  isLoading: boolean
}

const DashboardContext = createContext<DashboardContextType | null>(null)

export function DashboardProvider({
  projectId,
  initialProject,
  initialJob,
  initialEvents,
  initialLogs,
  children
}: {
  projectId: string
  initialProject: ProjectRow | null
  initialJob: JobRow | null
  initialEvents: JobEventRow[]
  initialLogs?: PipelineLogRow[]
  children: React.ReactNode
}) {
  const [job, setJob] = useState<JobRow | null>(initialJob)
  const [events, setEvents] = useState<JobEventRow[]>(initialEvents)
  const [logs, setLogs] = useState<PipelineLogRow[]>(initialLogs || [])
  const [project, setProject] = useState<ProjectRow | null>(initialProject)
  
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (!job?.id) return

    // Subscribe to jobs table changes
    const jobSubscription = supabase
      .channel(`job-updates-${job.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${job.id}` },
        (payload) => {
          setJob(payload.new as JobRow)
        }
      )
      .subscribe()

    // Subscribe to job_events table insertions
    const eventsSubscription = supabase
      .channel(`event-updates-${job.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_events', filter: `job_id=eq.${job.id}` },
        (payload) => {
          setEvents((prev) => [...prev, payload.new as JobEventRow])
        }
      )
      .subscribe()

    // Subscribe to pipeline_logs table insertions
    const logsSubscription = supabase
      .channel(`log-updates-${job.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pipeline_logs', filter: `job_id=eq.${job.id}` },
        (payload) => {
          setLogs((prev) => [payload.new as PipelineLogRow, ...prev]) // Prepended to show newest first
        }
      )
      .subscribe()

    // Subscribe to projects table changes
    const projectSubscription = supabase
      .channel(`project-updates-${project?.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${project?.id}` },
        (payload) => {
          setProject(payload.new as ProjectRow)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(jobSubscription)
      supabase.removeChannel(eventsSubscription)
      supabase.removeChannel(logsSubscription)
      supabase.removeChannel(projectSubscription)
    }
  }, [job?.id, project?.id, supabase])

  // Derive Pipeline Stages from the current job step and history
  const stages = useMemo<PipelineStage[]>(() => {
    const sequence = [
      'queued', 'research', 'outline', 'script_direction', 'brand_safety_check', 
      'voiceover', 'subtitle_extraction', 'scene_preview', 'scene_render', 
      'composition', 'rendering', 'thumbnail', 'metadata', 
      'cost_reconciliation', 'upload', 'notify', 'completed'
    ]

    const currentIndex = sequence.indexOf(job?.current_step || 'queued')

    return sequence.map((step, index) => {
      let status: PipelineStage['status'] = 'pending'
      
      if (step === 'completed' && project?.status === 'completed') {
        status = 'completed'
      } else if (index < currentIndex || project?.status === 'completed') {
        status = 'completed'
      } else if (index === currentIndex) {
        if (project?.status === 'failed') status = 'failed'
        else if (project?.status === 'paused') status = 'paused'
        else if (project?.status === 'cancelled') status = 'cancelled'
        else if (project?.status === 'cancelling') status = 'cancelling'
        else status = 'running'
      }

      return {
        id: step,
        label: step.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        status
      }
    })
  }, [job?.current_step])

  // Build Telemetry Object
  const telemetry: PipelineTelemetry = useMemo(() => {
    return {
      project,
      job,
      events,
      logs,
      stages,
      // Default to checking; this will be hydrated by a real health check hook later
      health: {
        infrastructure: { redis: 'checking', supabase: 'checking', worker: 'checking' },
        providers: { llm: 'checking', tts: 'checking' }
      },
      artifacts: {
        research: stages.find(s => s.id === 'research')?.status === 'completed' ? 'ready' : 'pending',
        outline: stages.find(s => s.id === 'outline')?.status === 'completed' ? 'ready' : 'pending',
        script: stages.find(s => s.id === 'script_direction')?.status === 'completed' ? 'ready' : 'pending',
        voiceover: stages.find(s => s.id === 'voiceover')?.status === 'completed' ? 'ready' : 'pending',
        assets: 'pending',
        finalVideo: 'pending'
      },
      metrics: {
        stageDurationMs: 0,
        totalTimeMs: 0,
        retryCount: 0
      }
    }
  }, [project, job, events, logs, stages])

  return (
    <DashboardContext.Provider value={{ telemetry, isLoading: !job }}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider')
  }
  return context
}
