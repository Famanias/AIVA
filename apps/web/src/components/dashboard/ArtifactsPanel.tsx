'use client'

import React from 'react'
import { useDashboard } from '../../providers/DashboardProvider'
import { Box, FileText, FileAudio, Clapperboard, Layers, Image as ImageIcon } from 'lucide-react'

export function ArtifactsPanel() {
  const { telemetry } = useDashboard()
  const { artifacts } = telemetry

  const artifactsList = [
    { key: 'research', label: 'Research Output', icon: FileText, status: artifacts.research },
    { key: 'outline', label: 'Structured Outline', icon: Layers, status: artifacts.outline },
    { key: 'script', label: 'Script & Direction', icon: FileText, status: artifacts.script },
    { key: 'voiceover', label: 'Voiceover Audio', icon: FileAudio, status: artifacts.voiceover },
    { key: 'assets', label: 'Visual Assets', icon: ImageIcon, status: artifacts.assets },
    { key: 'finalVideo', label: 'Final Render', icon: Clapperboard, status: artifacts.finalVideo },
  ]

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-zinc-400 mb-4 flex items-center gap-2">
        <Box className="w-4 h-4" /> Generated Artifacts
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {artifactsList.map((art) => {
          const Icon = art.icon
          const isReady = art.status === 'ready'
          const isGen = art.status === 'generating'
          
          return (
            <div 
              key={art.key}
              className={`p-3 rounded-lg border flex items-start gap-3 transition-colors ${
                isReady 
                  ? 'bg-emerald-950/20 border-emerald-900/50 hover:bg-emerald-900/30 cursor-pointer' 
                  : isGen
                    ? 'bg-blue-950/20 border-blue-900/50'
                    : 'bg-zinc-950/50 border-zinc-800 opacity-60'
              }`}
            >
              <div className={`p-2 rounded-md ${
                isReady ? 'bg-emerald-900/50 text-emerald-400' :
                isGen ? 'bg-blue-900/50 text-blue-400' : 'bg-zinc-800 text-zinc-500'
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className={`text-xs font-medium truncate ${isReady ? 'text-zinc-200' : 'text-zinc-400'}`}>
                  {art.label}
                </h4>
                <div className="mt-1 flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    isReady ? 'bg-emerald-500' :
                    isGen ? 'bg-blue-500 animate-pulse' : 'bg-zinc-600'
                  }`} />
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                    {art.status}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
