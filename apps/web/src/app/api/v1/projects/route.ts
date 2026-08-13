import { NextResponse } from 'next/server';
import { query } from '@aiva/database';
import { QueueService } from '../../../../services/queue.service';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      topic = 'Untitled Topic',
      style = 'stickman_animation',
      input_mode = 'topic',
      custom_script = '',
      aspect_ratio = '9:16',
      duration_target_seconds = 60,
      voice_id = 'en-US-AriaNeural',
      persona = 'Informative',
    } = body;

    const projectId = crypto.randomUUID();
    const jobId = crypto.randomUUID();

    const title = input_mode === 'custom_script'
      ? `Custom Script: ${(topic || custom_script).slice(0, 30)}...`
      : `Video: ${topic}`;

    const durationMinutes = Math.max(1, Math.round((duration_target_seconds || 60) / 60));

    // Get default dev user ID or fallback to zero-UUID
    let userId = '00000000-0000-0000-0000-000000000000';
    try {
      const userRes = await query(`SELECT id FROM auth.users LIMIT 1`);
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;
      }
    } catch (userErr: any) {
      console.warn('[Project Route] Default user lookup note:', userErr.message);
    }

    // 1. Insert Project into PostgreSQL
    const projectRes = await query(
      `INSERT INTO public.projects (
        id, user_id, title, topic, video_style, status, duration_target_minutes
      ) VALUES ($1, $2, $3, $4, $5, 'queued', $6)
      RETURNING *`,
      [projectId, userId, title, topic, style, durationMinutes]
    );

    const project = projectRes.rows[0];

    const statePayload = {
      input_mode,
      custom_script,
      aspect_ratio,
      duration_target_seconds,
      voice_id,
      persona,
    };

    // 2. Insert Job tracking row
    const jobRes = await query(
      `INSERT INTO public.jobs (
        id, project_id, current_step, progress, state_payload
      ) VALUES ($1, $2, 'research', 0, $3)
      RETURNING *`,
      [jobId, projectId, JSON.stringify(statePayload)]
    );

    const job = jobRes.rows[0];

    // 3. Enqueue job in BullMQ queue (gracefully handle Redis connection)
    try {
      await QueueService.enqueuePipelineJob(jobId, 'research', 0);
    } catch (err: any) {
      console.warn('[Project Route] Warning: BullMQ queue enqueue skipped or failed:', err.message);
    }

    return NextResponse.json({ status: 'success', project, job }, { status: 201 });
  } catch (err: any) {
    console.error('[Project Route] Error creating project:', err);
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  }
}
