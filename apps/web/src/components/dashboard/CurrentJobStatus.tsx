'use client'

import React, { useState, useEffect } from 'react'
import { useDashboard } from '../../providers/DashboardProvider'
import { Loader2, AlertCircle, CheckCircle2, Clock, Activity, DollarSign, PauseCircle, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export function CurrentJobStatus() {
  const { telemetry } = useDashboard()
  const { job, events } = telemetry
  const [elapsed, setElapsed] = useState<string>('0s')

  useEffect(() => {
    if (!job || !telemetry.project) return
    const isCompleted = telemetry.project.status === 'completed' || telemetry.project.status === 'failed'
    if (isCompleted) {
      setElapsed(formatDistanceToNow(new Date(telemetry.project.created_at), { includeSeconds: true }))
      return
    }
    
    const interval = setInterval(() => {
      setElapsed(formatDistanceToNow(new Date(telemetry.project!.created_at), { includeSeconds: true }))
    }, 1000)
    return () => clearInterval(interval)
  }, [job, telemetry.project])

  if (!job) return null

  const lastErrorEvent = [...events].reverse().find(e => e.job_step === job.current_step && e.event_type === 'failed')
  const isFailed = telemetry.project?.status === 'failed' || !!lastErrorEvent
  const isCompleted = telemetry.project?.status === 'completed'
  const isPaused = telemetry.project?.status === 'paused'
  const isCancelling = telemetry.project?.status === 'cancelling'
  const isCancelled = telemetry.project?.status === 'cancelled'

  // Estimate cost based on progress (dummy logic for MVP)
  const estimatedCost = `$${((job.progress / 100) * 0.15).toFixed(3)}`

  let displayStatus = job.current_step.replace(/_/g, ' ')
  if (isPaused) displayStatus = 'Paused'
  else if (isCancelling) displayStatus = 'Cancelling...'
  else if (isCancelled) displayStatus = 'Cancelled'
  else if (isCompleted) displayStatus = 'Completed'
  else if (isFailed) displayStatus = 'Failed'

  const showSpinner = !isCompleted && !isFailed && !isPaused && !isCancelled

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Current Stage */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 lg:col-span-2 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Activity className="w-4 h-4" /> Current Stage
        </label>
        <div className="text-xl font-medium text-zinc-100 capitalize flex items-center gap-2">
          {displayStatus}
          {showSpinner && <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />}
          {isCompleted && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          {isFailed && <AlertCircle className="w-5 h-5 text-red-500" />}
          {isPaused && <PauseCircle className="w-5 h-5 text-yellow-500" />}
          {isCancelled && <XCircle className="w-5 h-5 text-zinc-500" />}
        </div>
      </div>

      {/* Progress */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          Overall Progress
        </label>
        <div className="text-2xl font-semibold text-zinc-100">{job.progress}%</div>
        <div className="w-full bg-zinc-950 rounded-full h-1.5 mt-2 overflow-hidden border border-zinc-800">
          <div className="bg-red-600 h-1.5 rounded-full transition-all duration-500 ease-out" style={{ width: `${job.progress}%` }}></div>
        </div>
      </div>

      {/* Elapsed Time */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4" /> Elapsed
        </label>
        <div className="text-xl font-medium text-zinc-100">{elapsed}</div>
      </div>

      {/* Estimated Cost */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <DollarSign className="w-4 h-4" /> Est. Cost
        </label>
        <div className="text-xl font-medium text-zinc-100">{estimatedCost}</div>
      </div>
    </div>
  )
}
