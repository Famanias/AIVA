import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { QueueService } from '../../../../services/queue.service'

export async function POST(req: Request) {
  try {
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

    // Ensure user is authenticated using their session cookie
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Initialize Admin client to bypass Postgres role restrictions for the inserts
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const body = await req.json()
    const { topic, style } = body

    if (!topic || !style) {
      return NextResponse.json({ error: 'Missing required fields: topic, style' }, { status: 400 })
    }

    // 1. Create the Project
    const { data: project, error: projectError } = await adminSupabase
      .from('projects')
      .insert({
        title: `Video about ${topic}`,
        topic: topic,
        video_style: style,
        status: 'queued',
        user_id: user.id,
      })
      .select()
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: `Failed to create project: ${projectError?.message}` }, { status: 500 })
    }

    // 2. Create the Job tracking row
    const { data: job, error: jobError } = await adminSupabase
      .from('jobs')
      .insert({
        project_id: project.id,
        current_step: 'research',
        progress: 0,
        state_payload: {},
      })
      .select()
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: `Failed to create job: ${jobError?.message}` }, { status: 500 })
    }

    // 3. Enqueue the Pipeline Job in BullMQ
    await QueueService.enqueuePipelineJob(job.id, 0)

    return NextResponse.json({ project, job }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
