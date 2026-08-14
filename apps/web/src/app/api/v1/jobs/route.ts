import { NextResponse } from 'next/server';
import { query } from '@aiva/database';
import { getAuthenticatedUser } from '../../../../lib/auth/session';

export async function GET(req: Request) {
  try {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ status: 'error', error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let sql = `
      SELECT j.*, p.title as project_title
      FROM public.jobs j
      JOIN public.projects p ON j.project_id = p.id
      WHERE (p.user_id = $1 OR $2 = 'local')
    `;
    const params: any[] = [user.id, process.env.AIVA_AUTH_MODE || 'local'];

    if (projectId) {
      params.push(projectId);
      sql += ` AND j.project_id = $${params.length}`;
    }

    params.push(limit);
    sql += ` ORDER BY j.updated_at DESC LIMIT $${params.length}`;

    const res = await query(sql, params);
    return NextResponse.json({ status: 'success', data: res.rows });
  } catch (err: any) {
    const isConnRefused = err.code === 'ECONNREFUSED' || (err.errors && err.errors.some((e: any) => e.code === 'ECONNREFUSED'));
    if (isConnRefused) {
      return NextResponse.json({ status: 'success', data: [] });
    }
    console.error('[Jobs Route GET] Error:', err);
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  }
}
