'use client'

import React, { useState } from 'react'
import { useDashboard } from '../../providers/DashboardProvider'
import { Box, FileText, FileAudio, Clapperboard, Layers, Image as ImageIcon, Play, ChevronDown, ChevronUp } from 'lucide-react'

export function ArtifactsPanel() {
  const { telemetry } = useDashboard()
  const { artifacts, job } = telemetry
  const state = job?.state_payload as any || {}

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggleExpand = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const renderPreview = (key: string, isReady: boolean) => {
    if (!isReady) return null
    
    const isExp = expanded[key]

    if (key === 'research' && state.research?.researchSummary) {
      return (
        <div className="mt-2 text-xs text-zinc-400 bg-zinc-950 p-2 rounded overflow-hidden">
          <p className={`whitespace-pre-wrap ${!isExp && 'line-clamp-2'}`}>{state.research.researchSummary}</p>
          <button onClick={(e) => { e.stopPropagation(); toggleExpand(key); }} className="text-red-500 hover:text-red-400 mt-1 flex items-center gap-1">
            {isExp ? <><ChevronUp className="w-3 h-3"/> Less</> : <><ChevronDown className="w-3 h-3"/> More</>}
          </button>
        </div>
      )
    }

    if (key === 'outline' && state.outline) {
      return (
        <div className="mt-2 text-xs text-zinc-400 bg-zinc-950 p-2 rounded">
          <p>{state.outline.length} Scenes Outline Generated</p>
        </div>
      )
    }

    if (key === 'script' && state.scenes) {
      return (
        <div className="mt-2 text-xs text-zinc-400 bg-zinc-950 p-2 rounded">
          <p>{state.scenes.length} Directed Scenes with Text</p>
          <button onClick={(e) => { e.stopPropagation(); toggleExpand(key); }} className="text-red-500 hover:text-red-400 mt-1 flex items-center gap-1">
             {isExp ? <><ChevronUp className="w-3 h-3"/> Hide Details</> : <><ChevronDown className="w-3 h-3"/> Preview Script</>}
          </button>
          {isExp && (
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
              {state.scenes.map((s: any, idx: number) => (
                <div key={idx} className="border-l-2 border-zinc-700 pl-2">
                  <span className="font-semibold text-zinc-300">Scene {idx + 1}:</span> {s.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (key === 'voiceover' && state.voice?.audioUrl) {
      return (
        <div className="mt-2 w-full" onClick={(e) => e.stopPropagation()}>
          <audio controls src={`/api/media?path=${encodeURIComponent(state.voice.audioUrl)}`} className="w-full h-8 opacity-80 rounded"></audio>
        </div>
      )
    }

    if (key === 'assets' && state.scenes) {
      const visualScenes = state.scenes.filter((s: any) => s.assetUrl)
      if (visualScenes.length === 0) return null
      return (
        <div className="mt-2 flex gap-2 overflow-x-auto custom-scrollbar py-1" onClick={(e) => e.stopPropagation()}>
          {visualScenes.map((s: any) => (
            <img key={s.id} src={`/api/media?path=${encodeURIComponent(s.assetUrl)}`} alt="Asset" className="h-12 w-auto rounded border border-zinc-700 object-cover" />
          ))}
        </div>
      )
    }

    if (key === 'finalVideo' && state.composition?.outputUrl) {
      return (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <video controls src={`/api/media?path=${encodeURIComponent(state.composition.outputUrl)}`} className="w-full rounded border border-zinc-700"></video>
        </div>
      )
    }

    return null
  }

  const artifactsList = [
    { key: 'research', label: 'Research', icon: FileText, status: artifacts.research },
    { key: 'outline', label: 'Outline', icon: Layers, status: artifacts.outline },
    { key: 'script', label: 'Script', icon: FileText, status: artifacts.script },
    { key: 'voiceover', label: 'Voiceover', icon: FileAudio, status: artifacts.voiceover },
    { key: 'assets', label: 'Assets', icon: ImageIcon, status: artifacts.assets },
    { key: 'finalVideo', label: 'Video', icon: Clapperboard, status: artifacts.finalVideo },
  ]

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-zinc-100 mb-4 flex items-center gap-2">
        <Box className="w-4 h-4 text-red-600" /> Pipeline Artifacts
      </h3>
      
      <div className="mb-4 text-xs text-zinc-500 font-mono">
        Debug keys: {Object.keys(state).join(', ')}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {artifactsList.map((art) => {
          const Icon = art.icon
          const isReady = art.status === 'ready'
          const isGen = art.status === 'generating'
          
          return (
            <div 
              key={art.key}
              className={`p-3 rounded-lg border flex flex-col transition-colors ${
                isReady 
                  ? 'bg-zinc-950/50 border-zinc-700 hover:border-zinc-600' 
                  : isGen
                    ? 'bg-zinc-950/20 border-red-900/50'
                    : 'bg-zinc-950/20 border-zinc-800 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => isReady && toggleExpand(art.key)}>
                <div className={`p-2 rounded-md shrink-0 ${
                  isReady ? 'bg-zinc-800 text-zinc-200' :
                  isGen ? 'bg-red-900/20 text-red-500' : 'bg-zinc-900 text-zinc-600'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className={`text-xs font-medium truncate ${isReady ? 'text-zinc-200' : 'text-zinc-500'}`}>
                    {art.label}
                  </h4>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      isReady ? 'bg-emerald-500' :
                      isGen ? 'bg-red-500 animate-pulse' : 'bg-zinc-700'
                    }`} />
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                      {art.status}
                    </span>
                  </div>
                </div>
              </div>

              {renderPreview(art.key, isReady)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
