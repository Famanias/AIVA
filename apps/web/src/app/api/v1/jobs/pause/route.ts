import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { QueueControlService } from '../../../../../services/queue.control.service'

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

    // Authenticate user with local fallback
    let userId = '00000000-0000-0000-0000-000000000000'
    const isDev = process.env.NODE_ENV === 'development' || !process.env.NEXT_PUBLIC_SUPABASE_URL
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
      } else if (!isDev) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } catch {
      if (!isDev) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await req.json()
    const { action, jobId, projectId, jobIds, filter } = body

    if (action === 'single') {
      if (!jobId || !projectId) {
        return NextResponse.json({ error: 'Missing jobId or projectId' }, { status: 400 })
      }
      await QueueControlService.pauseJob(jobId, projectId, userId)
    } else if (action === 'selected') {
      if (!jobIds || !Array.isArray(jobIds)) {
        return NextResponse.json({ error: 'Missing or invalid jobIds array' }, { status: 400 })
      }
      await QueueControlService.pauseSelected(jobIds, userId)
    } else if (action === 'all') {
      if (!filter || !['queued', 'processing', 'all'].includes(filter)) {
        return NextResponse.json({ error: 'Missing or invalid filter' }, { status: 400 })
      }
      await QueueControlService.pauseAll(filter, userId)
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
