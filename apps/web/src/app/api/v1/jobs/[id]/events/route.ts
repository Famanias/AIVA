import { NextResponse } from 'next/server'
import { query } from '@aiva/database'
import { getAuthenticatedUser } from '../../../../../../lib/auth/session'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getAuthenticatedUser(req)
    if (!user) {
      return NextResponse.json({ status: 'error', error: 'Unauthorized' }, { status: 401 })
    }

    const { id: jobId } = await params

    // 1. Fetch Job & Project
    const jobRes = await query(
      `SELECT j.*, row_to_json(p.*) as project
       FROM public.jobs j
       JOIN public.projects p ON j.project_id = p.id
       WHERE j.id = $1 AND (p.user_id = $2 OR $3 = 'local')
       LIMIT 1`,
      [jobId, user.id, process.env.AIVA_AUTH_MODE || 'local']
    )

    if (jobRes.rows.length === 0) {
      return NextResponse.json({ status: 'error', error: 'Job not found' }, { status: 404 })
    }

    const job = jobRes.rows[0]

    // 2. Fetch Job Events
    const eventsRes = await query(
      `SELECT * FROM public.job_events WHERE job_id = $1 ORDER BY created_at ASC`,
      [jobId]
    )

    // 3. Fetch Pipeline Logs
    const logsRes = await query(
      `SELECT * FROM public.pipeline_logs WHERE job_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [jobId]
    )

    return NextResponse.json({
      status: 'success',
      data: {
        job,
        project: job.project,
        events: eventsRes.rows,
        logs: logsRes.rows,
      },
    })
  } catch (err: any) {
    console.error('[Job Events Route GET] Error:', err)
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 })
  }
}
