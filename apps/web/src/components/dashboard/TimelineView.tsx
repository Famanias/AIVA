'use client'

import React from 'react'
import { useDashboard } from '../../providers/DashboardProvider'
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react'

export function TimelineView() {
  const { telemetry } = useDashboard()
  const { stages } = telemetry

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 overflow-x-auto">
      <div className="flex items-center min-w-max px-4 py-2">
        {stages.map((stage, idx) => {
          const isLast = idx === stages.length - 1
          
          return (
            <React.Fragment key={stage.id}>
              {/* Node */}
              <div className="flex flex-col items-center relative group">
                <div className="mb-2">
                  {stage.status === 'completed' && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                  {stage.status === 'running' && <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />}
                  {stage.status === 'failed' && <XCircle className="w-6 h-6 text-red-500" />}
                  {stage.status === 'pending' && <Circle className="w-6 h-6 text-zinc-700" />}
                </div>
                
                <span className={`text-xs font-medium whitespace-nowrap ${
                  stage.status === 'completed' ? 'text-zinc-300' :
                  stage.status === 'running' ? 'text-blue-400' :
                  stage.status === 'failed' ? 'text-red-400' : 'text-zinc-600'
                }`}>
                  {stage.label}
                </span>

                {/* Tooltip for durations/retry (future) */}
                <div className="absolute top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-xs p-2 rounded pointer-events-none z-10 w-max">
                  Status: {stage.status}
                </div>
              </div>

              {/* Edge */}
              {!isLast && (
                <div className={`w-12 h-[2px] mx-2 mb-4 ${
                  stage.status === 'completed' ? 'bg-emerald-500/50' : 'bg-zinc-800'
                }`} />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
