'use client'

import React from 'react'
import { useDashboard } from '../../providers/DashboardProvider'
import { LayoutList, CheckCircle2, Circle, Loader2, AlertCircle, PauseCircle, XCircle } from 'lucide-react'

export function PipelineStatePanel() {
  const { telemetry } = useDashboard()
  const { stages } = telemetry

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-zinc-400 mb-4 flex items-center gap-2">
        <LayoutList className="w-4 h-4" /> Pipeline Stages
      </h3>
      
      <div className="space-y-3">
        {stages.map(stage => {
          return (
            <div key={stage.id} className="flex items-center justify-between">
              <span className={`text-sm ${
                stage.status === 'completed' ? 'text-zinc-400' :
                stage.status === 'running' ? 'text-zinc-200 font-medium' :
                stage.status === 'failed' ? 'text-red-400' : 
                stage.status === 'paused' ? 'text-yellow-400' :
                (stage.status === 'cancelled' || stage.status === 'cancelling') ? 'text-zinc-500' :
                'text-zinc-600'
              }`}>
                {stage.label}
              </span>
              
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-zinc-500">
                  {stage.status}
                </span>
                {stage.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                {stage.status === 'running' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                {stage.status === 'cancelling' && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
                {stage.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-500" />}
                {stage.status === 'paused' && <PauseCircle className="w-4 h-4 text-yellow-500" />}
                {stage.status === 'cancelled' && <XCircle className="w-4 h-4 text-zinc-500" />}
                {stage.status === 'pending' && <Circle className="w-4 h-4 text-zinc-700" />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
