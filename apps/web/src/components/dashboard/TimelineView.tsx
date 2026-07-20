'use client'

import React, { useState } from 'react'
import { useDashboard } from '../../providers/DashboardProvider'
import { CheckCircle2, Circle, Loader2, XCircle, ChevronDown, ChevronUp, PauseCircle } from 'lucide-react'

export function TimelineView() {
  const { telemetry } = useDashboard()
  const { stages, logs } = telemetry
  const [expandedStage, setExpandedStage] = useState<string | null>(null)

  const toggleStage = (stageId: string) => {
    setExpandedStage(prev => prev === stageId ? null : stageId)
  }

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-zinc-100">Pipeline Timeline</h3>
      </div>
      
      <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
        <div className="flex items-start min-w-max px-2">
          {stages.map((stage, idx) => {
            const isLast = idx === stages.length - 1
            const isExpanded = expandedStage === stage.id
            const stageLogs = logs.filter(l => l.stage === stage.id)
            const errorLogs = stageLogs.filter(l => l.level === 'error')

            return (
              <React.Fragment key={stage.id}>
                {/* Node */}
                <div className="flex flex-col relative w-32 shrink-0">
                  <div 
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors border border-transparent ${
                      isExpanded ? 'bg-zinc-900 border-zinc-800' : 'hover:bg-zinc-900/50'
                    }`}
                    onClick={() => toggleStage(stage.id)}
                  >
                    <div className="shrink-0 mt-0.5">
                      {stage.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                      {stage.status === 'running' && <Loader2 className="w-5 h-5 text-red-500 animate-spin" />}
                      {stage.status === 'cancelling' && <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />}
                      {stage.status === 'failed' && <XCircle className="w-5 h-5 text-red-500" />}
                      {stage.status === 'paused' && <PauseCircle className="w-5 h-5 text-yellow-500" />}
                      {stage.status === 'cancelled' && <XCircle className="w-5 h-5 text-zinc-500" />}
                      {stage.status === 'pending' && <Circle className="w-5 h-5 text-zinc-700" />}
                    </div>
                    
                    <div className="flex flex-col">
                      <span className={`text-xs font-medium truncate w-full ${
                        stage.status === 'completed' ? 'text-zinc-200' :
                        stage.status === 'running' ? 'text-red-500' :
                        stage.status === 'failed' ? 'text-red-500' : 
                        stage.status === 'paused' ? 'text-yellow-400' : 
                        (stage.status === 'cancelled' || stage.status === 'cancelling') ? 'text-zinc-500' : 
                        'text-zinc-500'
                      }`} title={stage.label}>
                        {stage.label}
                      </span>
                      <span className="text-[10px] text-zinc-600 capitalize">
                        {stage.status}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Content Drawer (Vertical dropdown under the node) */}
                  {isExpanded && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-lg p-3 z-10 shadow-2xl">
                      <h4 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Stage Details</h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Logs recorded:</span>
                          <span className="text-zinc-300">{stageLogs.length}</span>
                        </div>
                        {errorLogs.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-red-500">Errors:</span>
                            <span className="text-red-400">{errorLogs.length}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Status:</span>
                          <span className="text-zinc-300 capitalize">{stage.status}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Edge */}
                {!isLast && (
                  <div className="flex items-center shrink-0 w-8 mx-1 pt-4">
                    <div className={`w-full h-[2px] ${
                      stage.status === 'completed' ? 'bg-red-600/50' : 'bg-zinc-800'
                    }`} />
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}
