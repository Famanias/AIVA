import { query } from './local-db'
import crypto from 'crypto'

async function run() {
  const projectId = crypto.randomUUID()
  const sceneId = crypto.randomUUID()
  const versionId = crypto.randomUUID()

  // 1. Insert Project
  await query(
    `INSERT INTO public.projects (id, user_id, title, topic, video_style, status, duration_target_minutes)
     VALUES ($1, '00000000-0000-0000-0000-000000000000', 'Test Scene Persistence', 'Aviation', 'stickman_animation', 'queued', 1)`,
    [projectId]
  )

  // 2. Insert Scene
  await query(
    `INSERT INTO public.scenes (id, project_id, sequence_number, render_status, duration)
     VALUES ($1, $2, 1, 'draft', 5.0)`,
    [sceneId, projectId]
  )

  // 3. Insert Scene Version
  await query(
    `INSERT INTO public.scene_versions (
       id, scene_id, version_number, script_segment, visual_type,
       animation_action, typography_template, camera_style,
       transition, emotional_tone, broll_search_keywords, visual_prompt
     ) VALUES ($1, $2, 1, 'In 1903, the Wright Brothers achieved flight.', 'character_animation',
       'talk', NULL, 'zoom_in_slow', 'fade', 'inspiring', 'wright brothers plane', 'historical aircraft takeoff')`,
    [versionId, sceneId]
  )

  // 4. Update current_version_id
  await query(
    `UPDATE public.scenes SET current_version_id = $1 WHERE id = $2`,
    [versionId, sceneId]
  )

  // 5. Query back via the exact SQL query used by /api/v1/projects/[id]
  const scenesRes = await query(
    `SELECT s.*, sv.script_segment, sv.visual_type, sv.visual_prompt, sv.animation_action, sv.camera_style, sv.typography_template, sv.transition, sv.emotional_tone, sv.broll_search_keywords
     FROM public.scenes s
     LEFT JOIN public.scene_versions sv ON s.current_version_id = sv.id
     WHERE s.project_id = $1
     ORDER BY s.sequence_number ASC`,
    [projectId]
  )

  console.log('Queried scenes:', scenesRes.rows)
  if (scenesRes.rows.length === 1 && scenesRes.rows[0].script_segment.includes('Wright Brothers')) {
    console.log('SUCCESS: Scene and Version persisted and joined correctly.')
  } else {
    throw new Error('Scene persistence verification failed.')
  }

  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
