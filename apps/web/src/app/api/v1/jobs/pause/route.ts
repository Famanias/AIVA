import { NextResponse } from 'next/server'
import { QueueControlService } from '../../../../../services/queue.control.service'
import { getAuthenticatedUser } from '../../../../../lib/auth/session'

export async function POST(req: Request) {
  try {
    const user = getAuthenticatedUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id

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
