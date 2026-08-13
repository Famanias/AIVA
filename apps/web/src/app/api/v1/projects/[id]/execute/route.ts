import { NextResponse } from 'next/server'
import { query } from '@aiva/database'
import { QueueService } from '../../../../../../services/queue.service'
import fs from 'fs'
import path from 'path'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await req.json().catch(() => ({}))
    const { start_step = 'rendering', override_config = {} } = body

    // 1. Fetch active Job for Project
    const jobRes = await query(
      `SELECT * FROM public.jobs WHERE project_id = $1 LIMIT 1`,
      [projectId]
    )

    let job = jobRes.rows[0]

    if (!job) {
      // Auto-create project and job if executing a sample or new artifact package
      const projRes = await query(
        `SELECT * FROM public.projects WHERE id = $1 LIMIT 1`,
        [projectId]
      )
      let project = projRes.rows[0]

      if (!project) {
        const headerUserId = req.headers.get('x-user-id')
        let userId = headerUserId || null

        if (!userId) {
          const isLocalDev = process.env.NODE_ENV === 'development' || !process.env.NEXT_PUBLIC_SUPABASE_URL
          if (isLocalDev) {
            userId = '00000000-0000-0000-0000-000000000000'
          } else {
            return NextResponse.json({ error: 'Unauthorized: Missing user authentication session' }, { status: 401 })
          }
        }

        const insertProj = await query(
          `INSERT INTO public.projects (
            id, user_id, title, topic, video_style, status, duration_target_minutes, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, 'queued', 1, NOW(), NOW())
          RETURNING *`,
          [projectId, userId, `Sample Video (${projectId})`, "The Story of Homer's Odyssey", 'stickman_animation']
        )
        project = insertProj.rows[0]
      }

      // Read sample artifact state payload
      const samplePath = path.join(process.cwd(), '../workers/sample_project_artifact.json')
      let samplePayload = {}
      if (fs.existsSync(samplePath)) {
        try {
          const raw = fs.readFileSync(samplePath, 'utf-8')
          samplePayload = JSON.parse(raw).artifacts || {}
        } catch (e: any) {
          console.warn('[Execute Route] Could not read sample artifact json:', e.message)
        }
      }

      const insertJob = await query(
        `INSERT INTO public.jobs (
          project_id, current_step, progress, state_payload, created_at, updated_at
        ) VALUES ($1, $2, 50, $3, NOW(), NOW())
        RETURNING *`,
        [projectId, start_step, JSON.stringify(samplePayload)]
      )
      job = insertJob.rows[0]
    }

    // 2. Update job current_step & project status
    await query(
      `UPDATE public.projects SET status = 'queued', updated_at = NOW() WHERE id = $1`,
      [projectId]
    )

    await query(
      `UPDATE public.jobs SET current_step = $1, updated_at = NOW() WHERE id = $2`,
      [start_step, job.id]
    )

    // 3. Enqueue job at start_step
    await QueueService.enqueuePipelineJob(job.id, start_step, 0)

    return NextResponse.json({
      message: `Resumed project ${projectId} from step ${start_step}`,
      job_id: job.id,
      start_step
    }, { status: 200 })

  } catch (err: any) {
    console.error('[Execute Route] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

