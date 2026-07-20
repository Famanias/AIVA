'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useDashboard } from '../../providers/DashboardProvider'
import { Terminal, Filter, Clock, ChevronDown, ChevronRight, Activity, AlertCircle, Info, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { PipelineLogRow } from '../../types/telemetry'

export function LiveEventLog() {
  const { telemetry } = useDashboard()
  const { logs } = telemetry
  
  const [filter, setFilter] = useState<'all' | 'errors' | 'warnings' | 'info'>('all')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())

  // Deduplicate stages for the filter dropdown
  const availableStages = Array.from(new Set(logs.map(l => l.stage).filter(Boolean))) as string[]

  const filteredLogs = logs.filter(l => {
    if (filter === 'errors') return l.level === 'error'
    if (filter === 'info') return l.level === 'info' || l.level === 'debug'
    if (filter === 'warnings') return l.level === 'warn'
    if (stageFilter !== 'all' && l.stage !== stageFilter) return false
    return true
  })

  // Auto-scroll logic (note: since we prepended logs to show newest first, auto-scroll is different now. 
  // Wait, if we prepend them, the newest is at the top. So auto-scroll means scroll to top?
  // Let's actually reverse it for display if we want traditional terminal feel, or keep it activity-feed style (newest at top).
  // Activity feed is usually newest at top. So no auto-scroll needed, just scroll to top when new item arrives.
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0
    }
  }, [logs.length, autoScroll])

  const toggleExpand = (id: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'warn': return <AlertCircle className="w-4 h-4 text-amber-500" />
      case 'info': return <Info className="w-4 h-4 text-blue-400" />
      case 'debug': return <Terminal className="w-4 h-4 text-zinc-500" />
      default: return <Activity className="w-4 h-4 text-zinc-400" />
    }
  }

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[500px]">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Activity className="w-4 h-4 text-red-600" /> Live Activity Feed
        </h3>
        
        <div className="flex items-center gap-4 text-xs">
          <select 
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 outline-none focus:border-red-600 transition-colors"
          >
            <option value="all">All Stages</option>
            {availableStages.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

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
          
          <label className="flex items-center gap-2 text-zinc-400 cursor-pointer hover:text-zinc-200 transition-colors">
            <input 
              type="checkbox" 
              checked={autoScroll} 
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-zinc-800 border-zinc-700 accent-red-600"
            />
            Auto-scroll
          </label>
        </div>
      </div>

      <div 
        ref={logContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {filteredLogs.length === 0 && (
          <div className="text-zinc-600 text-center mt-10">No activity matching filter.</div>
        )}
        
        {filteredLogs.map((log) => {
          const isExpanded = expandedLogs.has(log.id)
          const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0

          return (
            <div key={log.id} className="bg-zinc-900 border border-zinc-800/50 rounded-lg p-3 hover:border-zinc-700 transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getLevelIcon(log.level)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-zinc-500 text-xs font-mono">
                      {format(new Date(log.created_at), 'HH:mm:ss')}
                    </span>
                    <span className="text-xs font-medium text-zinc-300 uppercase px-1.5 py-0.5 bg-zinc-800 rounded">
                      {log.stage || 'system'}
                    </span>
                    <span className="text-xs text-zinc-500">via {log.source}</span>
                  </div>
                  
                  <div className={`text-sm ${
                    log.level === 'error' ? 'text-red-400' : 'text-zinc-200'
                  }`}>
                    {log.message}
                  </div>

                  {hasMetadata && (
                    <button 
                      onClick={() => toggleExpand(log.id)}
                      className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      {isExpanded ? 'Hide Details' : 'View Details'}
                    </button>
                  )}

                  {isExpanded && hasMetadata && (
                    <div className="mt-3 p-3 bg-zinc-950 rounded border border-zinc-800 overflow-x-auto">
                      <pre className="text-xs text-zinc-400 font-mono">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
