'use client'

import React from 'react'
import { useDashboard } from '../../providers/DashboardProvider'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

export function CurrentJobStatus() {
  const { telemetry } = useDashboard()
  const { job, events } = telemetry

  if (!job) return null

  // Find the most recent failure event if any for the current step
  const lastErrorEvent = [...events]
    .reverse()
    .find(e => e.job_step === job.current_step && e.event_type === 'failed')

  const isFailed = job.current_step === 'failed' || !!lastErrorEvent
  const isCompleted = job.current_step === 'completed'

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-zinc-400 mb-4">Current Execution</h3>
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-3xl font-bold text-white capitalize flex items-center gap-3">
            {job.current_step.replace(/_/g, ' ')}
            {!isCompleted && !isFailed && <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />}
            {isCompleted && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
            {isFailed && <AlertCircle className="w-6 h-6 text-red-500" />}
          </div>
          <div className="text-sm text-zinc-500 mt-1">Overall Progress: {job.progress}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Queue Status</label>
          <span className="text-zinc-200">Processing</span>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Retry Count</label>
          <span className="text-zinc-200">0 / 5</span>
        </div>
      </div>

      {isFailed && lastErrorEvent && (
        <div className="mt-4 bg-red-950/30 border border-red-900/50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-red-400 flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4" /> Failure Context
          </h4>
          <p className="text-sm text-red-200/80 font-mono">
            {lastErrorEvent.message}
          </p>
          <div className="mt-2 text-xs text-red-400/60 uppercase tracking-wider">
            Worker backoff active. Retrying...
          </div>
        </div>
      )}
    </div>
  )
}
