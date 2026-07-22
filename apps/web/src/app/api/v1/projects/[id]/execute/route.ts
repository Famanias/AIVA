import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { QueueService } from '../../../../../../services/queue.service'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            } catch {
              // Ignore inside route handlers
            }
          },
        },
      }
    )

    const authHeader = req.headers.get('authorization')
    const isDev = process.env.NODE_ENV === 'development'

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!isDev && (authError || !user) && !authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const body = await req.json().catch(() => ({}))
    const { start_step = 'rendering', override_config = {} } = body

    // 1. Fetch active Job for Project
    let { data: job } = await adminSupabase
      .from('jobs')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle()

    if (!job) {
      // Auto-create project and job if executing a sample or new artifact package
      let { data: project } = await adminSupabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle()

      if (!project) {
        const { data: newProject, error: pErr } = await adminSupabase
          .from('projects')
          .insert({
            id: projectId,
            title: `Sample Video (${projectId})`,
            topic: "The Story of Homer's Odyssey",
            video_style: 'stickman_animation',
            status: 'queued',
            user_id: user?.id || 'e55f2c0d-c4f4-4218-b711-2dd2d71d06df'
          })
          .select()
          .single()
        if (pErr) throw pErr
        project = newProject
      }

      // Read sample artifact state payload
      const fs = await import('fs')
      const path = await import('path')
      const samplePath = path.join(process.cwd(), '../workers/sample_project_artifact.json')
      let samplePayload = {}
      if (fs.existsSync(samplePath)) {
        try {
          const raw = fs.readFileSync(samplePath, 'utf-8')
          samplePayload = JSON.parse(raw).artifacts || {}
        } catch (e) {
          console.warn('Could not read sample artifact json:', e)
        }
      }

      const { data: newJob, error: jErr } = await adminSupabase
        .from('jobs')
        .insert({
          project_id: projectId,
          current_step: start_step,
          progress: 50,
          state_payload: samplePayload
        })
        .select()
        .single()
      if (jErr) throw jErr
      job = newJob
    }

    // 2. Update job current_step & project status
    await adminSupabase
      .from('projects')
      .update({ status: 'queued', updated_at: new Date().toISOString() })
      .eq('id', projectId)

    await adminSupabase
      .from('jobs')
      .update({
        current_step: start_step,
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id)

    // 3. Enqueue job at start_step
    await QueueService.enqueuePipelineJob(job.id, start_step, 0)

    return NextResponse.json({
      message: `Resumed project ${projectId} from step ${start_step}`,
      job_id: job.id,
      start_step
    }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
