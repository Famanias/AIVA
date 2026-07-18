import React from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@aiva/shared-types/src/database.types'
import { DashboardProvider } from '@/providers/DashboardProvider'
import { SystemHealthPanel } from '@/components/dashboard/SystemHealthPanel'
import { JobMetadataPanel } from '@/components/dashboard/JobMetadataPanel'
import { CurrentJobStatus } from '@/components/dashboard/CurrentJobStatus'
import { TimelineView } from '@/components/dashboard/TimelineView'
import { PipelineStatePanel } from '@/components/dashboard/PipelineStatePanel'
import { RawStateViewer } from '@/components/dashboard/RawStateViewer'
import { LiveEventLog } from '@/components/dashboard/LiveEventLog'
import { ArtifactsPanel } from '@/components/dashboard/ArtifactsPanel'
import { redirect } from 'next/navigation'

export default async function OperatorDashboard({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  // Fetch initial project data
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!project) {
    return <div className="p-8 text-red-500">Project not found.</div>
  }

  // Fetch latest job
  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Fetch initial events
  let initialEvents: any[] = []
  if (job) {
    const { data: events } = await supabase
      .from('job_events')
      .select('*')
      .eq('job_id', job.id)
      .order('created_at', { ascending: true })
    
    initialEvents = events || []
  }

  return (
    <DashboardProvider 
      projectId={project.id} 
      initialProject={project} 
      initialJob={job || null} 
      initialEvents={initialEvents}
    >
      <div className="min-h-screen bg-black p-4 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <header className="mb-8">
            <h1 className="text-2xl font-bold">Operator Dashboard</h1>
            <p className="text-sm text-zinc-500">Real-time pipeline telemetry and observation.</p>
          </header>

          <TimelineView />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <CurrentJobStatus />
              <ArtifactsPanel />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <LiveEventLog />
                <RawStateViewer />
              </div>
            </div>

            <div className="space-y-6">
              <SystemHealthPanel />
              <JobMetadataPanel />
              <PipelineStatePanel />
            </div>
          </div>
        </div>
      </div>
    </DashboardProvider>
  )
}
