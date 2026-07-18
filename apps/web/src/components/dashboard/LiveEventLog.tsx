'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useDashboard } from '../../providers/DashboardProvider'
import { Terminal, Filter, Clock } from 'lucide-react'
import { format } from 'date-fns'

export function LiveEventLog() {
  const { telemetry } = useDashboard()
  const { events } = telemetry
  
  const [filter, setFilter] = useState<'all' | 'errors' | 'warnings' | 'info'>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const logContainerRef = useRef<HTMLDivElement>(null)

  const filteredEvents = events.filter(e => {
    if (filter === 'errors') return e.event_type === 'failed'
    if (filter === 'info') return e.event_type === 'started' || e.event_type === 'finished'
    if (filter === 'warnings') return e.event_type === 'retrying'
    return true
  })

  // Auto-scroll logic
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [filteredEvents, autoScroll])

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[400px]">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
        <h3 className="text-sm font-semibold text-zinc-400 flex items-center gap-2">
          <Terminal className="w-4 h-4" /> Live Event Log
        </h3>
        
        <div className="flex items-center gap-4 text-xs">
          <div className="flex bg-zinc-800 rounded-lg p-1">
            {(['all', 'errors', 'info', 'warnings'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md capitalize transition-colors ${
                  filter === f ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          
          <label className="flex items-center gap-2 text-zinc-400 cursor-pointer">
            <input 
              type="checkbox" 
              checked={autoScroll} 
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-zinc-800 border-zinc-700"
            />
            Auto-scroll
          </label>
        </div>
      </div>

      <div 
        ref={logContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs"
      >
        {filteredEvents.length === 0 && (
          <div className="text-zinc-600 text-center mt-10">No events matching filter.</div>
        )}
        
        {filteredEvents.map((e, idx) => {
          // Calculate duration from previous event if any
          let durationStr = ''
          if (idx > 0) {
            const prevTime = new Date(filteredEvents[idx-1].created_at).getTime()
            const currTime = new Date(e.created_at).getTime()
            const diffMs = currTime - prevTime
            if (diffMs > 1000) {
              durationStr = `+${(diffMs / 1000).toFixed(1)}s`
            } else {
              durationStr = `+${diffMs}ms`
            }
          }

          return (
            <div key={e.id} className="flex items-start gap-3 hover:bg-zinc-900/50 p-1 rounded">
              <span className="text-zinc-600 min-w-[65px]">
                {format(new Date(e.created_at), 'HH:mm:ss')}
              </span>
              
              <span className={`px-1.5 rounded uppercase text-[10px] min-w-[70px] text-center ${
                e.event_type === 'failed' ? 'bg-red-900/50 text-red-400' :
                e.event_type === 'retrying' ? 'bg-amber-900/50 text-amber-400' :
                e.event_type === 'finished' ? 'bg-emerald-900/50 text-emerald-400' :
                'bg-blue-900/50 text-blue-400'
              }`}>
                {e.event_type}
              </span>

              <span className="text-zinc-500 uppercase w-24 truncate" title={e.job_step}>
                [{e.job_step}]
              </span>

              <span className={`flex-1 ${
                e.event_type === 'failed' ? 'text-red-300' : 'text-zinc-300'
              }`}>
                {e.message}
              </span>

              {durationStr && (
                <span className="text-zinc-600 flex items-center gap-1 w-16 justify-end">
                  <Clock className="w-3 h-3" /> {durationStr}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
