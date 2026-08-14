import { NextResponse } from 'next/server';
import { query } from '@aiva/database';
import { QueueService } from '../../../../services/queue.service';
import { getAuthenticatedUser } from '../../../../lib/auth/session';
import crypto from 'crypto';

export async function GET(req: Request) {
  try {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ status: 'error', error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const res = await query(
      `SELECT p.*,
              (
                SELECT row_to_json(j.*)
                FROM public.jobs j
                WHERE j.project_id = p.id
                ORDER BY j.updated_at DESC
                LIMIT 1
              ) AS job
       FROM public.projects p
       WHERE p.user_id = $1 OR $2 = 'local'
       ORDER BY p.created_at DESC
       LIMIT $3`,
      [user.id, process.env.AIVA_AUTH_MODE || 'local', limit]
    );

    return NextResponse.json({ status: 'success', data: res.rows });
  } catch (err: any) {
    const isConnRefused = err.code === 'ECONNREFUSED' || (err.errors && err.errors.some((e: any) => e.code === 'ECONNREFUSED'));
    if (isConnRefused) {
      console.warn('[Projects Route GET] Database is unreachable. Returning empty array fallback. (Run `pnpm services:up` to start PostgreSQL)');
      return NextResponse.json({ status: 'success', data: [] });
    }
    console.error('[Projects Route GET] Error:', err);
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ status: 'error', error: 'Unauthorized: Missing user authentication session' }, { status: 401 });
    }

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
    const userId = user.id;

    // 1. Insert Project into PostgreSQL
    const projectRes = await query(
      `INSERT INTO public.projects (
        id, user_id, title, topic, video_style, status, duration_target_minutes
      ) VALUES ($1, $2, $3, $4, $5, 'queued', $6)
      RETURNING *`,
      [projectId, userId, title, topic, style, durationMinutes]
    );

    const project = projectRes.rows[0];

    const isCustomScript = input_mode === 'custom_script' || (typeof custom_script === 'string' && custom_script.trim().length > 0);
    const initialStep = isCustomScript ? 'script_direction' : 'research';

    const generationProfile = {
      aspect_ratio: aspect_ratio || '9:16',
      duration_target_seconds: Number(duration_target_seconds) || 60,
      voice_id: voice_id || 'en-US-AriaNeural',
      persona: persona || 'Informative',
      visual_style: style || 'stickman_animation',
    };

    const statePayload = {
      input_mode: isCustomScript ? 'custom_script' : 'topic',
      custom_script: isCustomScript ? custom_script : '',
      aspect_ratio,
      duration_target_seconds,
      voice_id,
      persona,
      generationProfile,
    };

    // 2. Insert Job tracking row
    const jobRes = await query(
      `INSERT INTO public.jobs (
        id, project_id, current_step, progress, state_payload
      ) VALUES ($1, $2, $3, 0, $4)
      RETURNING *`,
      [jobId, projectId, initialStep, JSON.stringify(statePayload)]
    );

    const job = jobRes.rows[0];

    // 3. Enqueue job in BullMQ queue (gracefully handle Redis connection)
    try {
      await QueueService.enqueuePipelineJob(jobId, initialStep, 0);
    } catch (err: any) {
      console.warn('[Project Route] Warning: BullMQ queue enqueue skipped or failed:', err.message);
    }

    return NextResponse.json({ status: 'success', project, job }, { status: 201 });
  } catch (err: any) {
    const isConnRefused = err.code === 'ECONNREFUSED' || (err.errors && err.errors.some((e: any) => e.code === 'ECONNREFUSED'));
    if (isConnRefused) {
      return NextResponse.json({
        status: 'error',
        error: 'Database is offline or unreachable. Please start PostgreSQL with `pnpm services:up`.',
      }, { status: 503 });
    }
    console.error('[Project Route] Error creating project:', err);
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  }
}
