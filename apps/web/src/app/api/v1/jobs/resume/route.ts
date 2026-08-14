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
    const { action, jobId, projectId, jobIds } = body

    if (action === 'single') {
      if (!jobId || !projectId) {
        return NextResponse.json({ error: 'Missing jobId or projectId' }, { status: 400 })
      }
      await QueueControlService.resumeJob(jobId, projectId, userId)
    } else if (action === 'selected') {
      if (!jobIds || !Array.isArray(jobIds)) {
        return NextResponse.json({ error: 'Missing or invalid jobIds array' }, { status: 400 })
      }
      await QueueControlService.resumeSelected(jobIds, userId)
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
