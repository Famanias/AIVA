'use client'

import React, { useState } from 'react'
import { useDashboard } from '../../providers/DashboardProvider'
import { FileJson, ChevronDown, ChevronRight } from 'lucide-react'

export function RawStateViewer() {
  const { telemetry } = useDashboard()
  const { job } = telemetry
  const [isExpanded, setIsExpanded] = useState(false)

  if (!job) return null

  // For P1, we use standard JSON.stringify. For future, react-json-view can be dropped in here.
  const rawJson = JSON.stringify(job.state_payload || {}, null, 2)

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
      <div 
        className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between cursor-pointer hover:bg-zinc-800/80 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-sm font-semibold text-zinc-400 flex items-center gap-2">
          <FileJson className="w-4 h-4" /> Raw Pipeline State
        </h3>
        <div className="text-zinc-500">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-4 overflow-x-auto max-h-[500px] overflow-y-auto">
          <pre className="text-xs text-emerald-400/80 font-mono">
            <code>{rawJson}</code>
          </pre>
        </div>
      )}
    </div>
  )
}
