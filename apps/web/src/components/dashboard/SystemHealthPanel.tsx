'use client'

import React from 'react'
import { useDashboard } from '../../providers/DashboardProvider'
import { Activity, Server, Database, Brain, Mic, Globe } from 'lucide-react'

export function SystemHealthPanel() {
  const { telemetry } = useDashboard()
  const { health } = telemetry

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'connected':
      case 'online':
      case 'configured':
        return <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      case 'disconnected':
      case 'offline':
      case 'missing_keys':
        return <div className="w-2 h-2 rounded-full bg-red-500" />
      default:
        return <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-zinc-400 mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4" /> System Health
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Infrastructure */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Infrastructure</h4>
          
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-zinc-300">
              <Database className="w-4 h-4 text-zinc-500" /> Redis
            </span>
            <span className="flex items-center gap-2 text-zinc-400">
              {health.infrastructure.redis} <StatusIcon status={health.infrastructure.redis} />
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-zinc-300">
              <Server className="w-4 h-4 text-zinc-500" /> Supabase
            </span>
            <span className="flex items-center gap-2 text-zinc-400">
              {health.infrastructure.supabase} <StatusIcon status={health.infrastructure.supabase} />
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-zinc-300">
              <Activity className="w-4 h-4 text-zinc-500" /> Python Worker
            </span>
            <span className="flex items-center gap-2 text-zinc-400">
              {health.infrastructure.worker} <StatusIcon status={health.infrastructure.worker} />
            </span>
          </div>
        </div>

        {/* Providers */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Providers</h4>
          
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-zinc-300">
              <Brain className="w-4 h-4 text-zinc-500" /> LLM API
            </span>
            <span className="flex items-center gap-2 text-zinc-400">
              {health.providers.llm} <StatusIcon status={health.providers.llm} />
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-zinc-300">
              <Mic className="w-4 h-4 text-zinc-500" /> Edge-TTS
            </span>
            <span className="flex items-center gap-2 text-zinc-400">
              {health.providers.tts} <StatusIcon status={health.providers.tts} />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
