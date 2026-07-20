import React, { useMemo } from 'react'
import { Activity, PlayCircle, PauseCircle, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { ProjectRow } from '../../types/telemetry'

interface OperationsSummaryHeaderProps {
  projects: ProjectRow[]
}

export function OperationsSummaryHeader({ projects }: OperationsSummaryHeaderProps) {
  const stats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const active = projects.filter(p => ['queued', 'generating'].includes(p.status)).length
    const paused = projects.filter(p => p.status === 'paused').length
    
    const completedToday = projects.filter(p => 
      p.status === 'completed' && new Date(p.updated_at) >= today
    ).length
    
    const failedToday = projects.filter(p => 
      p.status === 'failed' && new Date(p.updated_at) >= today
    ).length

    // Simple throughput metric (completed / total created today)
    const createdToday = projects.filter(p => new Date(p.created_at) >= today).length
    const throughput = createdToday > 0 ? Math.round((completedToday / createdToday) * 100) : 0

    return { active, paused, completedToday, failedToday, throughput }
  }, [projects])

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between h-24">
        <div className="flex items-center gap-2 text-zinc-400">
          <PlayCircle className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium">Active Jobs</span>
        </div>
        <div className="text-3xl font-bold text-white">{stats.active}</div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between h-24">
        <div className="flex items-center gap-2 text-zinc-400">
          <PauseCircle className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-medium">Paused</span>
        </div>
        <div className="text-3xl font-bold text-white">{stats.paused}</div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between h-24">
        <div className="flex items-center gap-2 text-zinc-400">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium">Completed (24h)</span>
        </div>
        <div className="text-3xl font-bold text-white">{stats.completedToday}</div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between h-24">
        <div className="flex items-center gap-2 text-zinc-400">
          <XCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm font-medium">Failed (24h)</span>
        </div>
        <div className="text-3xl font-bold text-white">{stats.failedToday}</div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between h-24">
        <div className="flex items-center gap-2 text-zinc-400">
          <Activity className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium">Success Rate</span>
        </div>
        <div className="text-3xl font-bold text-white">{stats.throughput}%</div>
      </div>
    </div>
  )
}
