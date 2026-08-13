import { query } from './index';

async function main() {
  const pId = '00000000-0000-0000-0000-000000000001';
  const sId = '00000000-0000-0000-0000-000000000002';

  await query(
    `INSERT INTO public.projects (id, user_id, title, topic, video_style, status)
     VALUES ($1, $2, $3, $4, $5::video_style, $6::video_status)
     ON CONFLICT (id) DO NOTHING`,
    [pId, '00000000-0000-0000-0000-000000000000', 'Test Project', 'Test', 'stickman_animation', 'queued']
  );

  await query(
    `INSERT INTO public.scenes (id, project_id, sequence_number, duration)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [sId, pId, 1, 10]
  );

  console.log('✅ Seeded test project and scene into PostgreSQL!');
}

main().catch((err) => console.error('Seed error:', err.message));
