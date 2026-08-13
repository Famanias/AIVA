'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { OperationsDashboardProvider, useOperations } from '../providers/OperationsDashboardProvider'
import { QueueItem } from '../components/dashboard/QueueItem'
import { OperationsSummaryHeader } from '../components/dashboard/OperationsSummaryHeader'

function InitializePipeline() {
  const router = useRouter()
  const [inputMode, setInputMode] = useState<'topic' | 'custom_script'>('topic')
  const [topic, setTopic] = useState('')
  const [customScript, setCustomScript] = useState('')
  const [style, setStyle] = useState('stickman_animation')
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16')
  const [durationSeconds, setDurationSeconds] = useState(60)
  const [voiceId, setVoiceId] = useState('en-US-AriaNeural')
  const [persona, setPersona] = useState('Informative')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const payload = {
        input_mode: inputMode,
        topic: inputMode === 'topic' ? topic : (topic || customScript.slice(0, 30)),
        custom_script: inputMode === 'custom_script' ? customScript : '',
        style,
        aspect_ratio: aspectRatio,
        duration_target_seconds: durationSeconds,
        voice_id: voiceId,
        persona,
      }

      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      
      if (!res.ok || data.status === 'error') {
        throw new Error(data.error || 'Failed to create project')
      }

      router.push(`/projects/${data.project.id}`)
    } catch (err: any) {
      setError(err.message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 h-fit space-y-4">
      <div>
        <h2 className="text-xl font-bold mb-1">Create Video Brief</h2>
        <p className="text-zinc-400 text-xs">
          Configure video brief parameters to initialize the generation pipeline.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-950/50 border border-red-900 text-red-400 rounded text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Input Mode Selector */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Input Mode</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setInputMode('topic')}
              className={`py-1.5 px-3 text-xs rounded-lg font-medium border transition ${
                inputMode === 'topic'
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              Topic Brief (AI Research)
            </button>
            <button
              type="button"
              onClick={() => setInputMode('custom_script')}
              className={`py-1.5 px-3 text-xs rounded-lg font-medium border transition ${
                inputMode === 'custom_script'
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              Custom Script Paste
            </button>
          </div>
        </div>

        {/* Topic Input or Custom Script Textarea */}
        {inputMode === 'topic' ? (
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Topic</label>
            <input
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. History of the Roman Empire"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Custom Script</label>
            <textarea
              required
              rows={4}
              value={customScript}
              onChange={(e) => setCustomScript(e.target.value)}
              placeholder="Paste your full narration script segment here..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        )}

        {/* Aspect Ratio & Format */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Format / Aspect Ratio</label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as any)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="9:16">Vertical 9:16 (Shorts/Reels)</option>
              <option value="16:9">Horizontal 16:9 (YouTube)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Duration Target</label>
            <select
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value={30}>30 Seconds (Quick Hook)</option>
              <option value={60}>60 Seconds (Standard Short)</option>
              <option value={90}>90 Seconds (Extended)</option>
              <option value={180}>180 Seconds (3 Minutes)</option>
            </select>
          </div>
        </div>

        {/* Template Style & Voice Selection */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Template Style</label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="stickman_animation">Stickman Animation</option>
              <option value="documentary">Ken-Burns Documentary</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Voice Selection</label>
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="en-US-AriaNeural">en-US Aria (Female)</option>
              <option value="en-US-GuyNeural">en-US Guy (Male)</option>
              <option value="en-GB-SoniaNeural">en-GB Sonia (British)</option>
              <option value="en-AU-Neural">en-AU News (Australian)</option>
            </select>
          </div>
        </div>

        {/* Persona / Tone */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">Persona / Tone</label>
          <select
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="Informative">Informative & Educational</option>
            <option value="Dramatic">Dramatic & Story-driven</option>
            <option value="Energetic">Energetic & Fast-paced</option>
            <option value="Humorous">Humorous & Lighthearted</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || (inputMode === 'topic' ? !topic.trim() : !customScript.trim())}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Initializing Brief...</>
          ) : (
            'Start Pipeline Generation'
          )}
        </button>
      </form>
    </div>
  )
}

function CollapsibleSection({ title, count, children, defaultOpen = true }: { title: string, count: number, children: React.ReactNode, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (count === 0) return null

  return (
    <div className="mb-6">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-zinc-300 hover:text-white mb-3 transition-colors font-semibold"
      >
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {title} <span className="text-zinc-500 text-sm font-normal">({count})</span>
      </button>
      {isOpen && (
        <div className="space-y-3 pl-2 border-l border-zinc-800 ml-2">
          {children}
        </div>
      )}
    </div>
  )
}

function OperationsConsole() {
  const { projects, isLoading, refresh } = useOperations()
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [isProcessingAction, setIsProcessingAction] = useState(false)

  const handleToggleSelect = (id: string) => {
    setSelectedProjects(prev => prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id])
  }

  const executeAction = async (endpoint: string, payload: any) => {
    setIsProcessingAction(true)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Action failed')
      }
      setSelectedProjects([])
      await refresh()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsProcessingAction(false)
    }
  }

  const handlePause = (id: string) => executeAction('/api/v1/jobs/pause', { action: 'single', jobId: projects.find(p => p.id === id)?.job?.id, projectId: id })
  const handleResume = (id: string) => executeAction('/api/v1/jobs/resume', { action: 'single', jobId: projects.find(p => p.id === id)?.job?.id, projectId: id })
  const handleStop = (id: string) => executeAction('/api/v1/jobs/stop', { action: 'single', jobId: projects.find(p => p.id === id)?.job?.id, projectId: id })

  const handleBulkAction = (type: 'stop' | 'pause' | 'resume', filter: 'selected' | 'queued' | 'processing') => {
    if (filter === 'selected') {
      const jobIds = projects.filter(p => selectedProjects.includes(p.id)).map(p => p.job?.id).filter(Boolean)
      if (jobIds.length === 0) return alert('No active jobs found for the selected projects.')
      executeAction(`/api/v1/jobs/${type}`, { action: 'selected', jobIds })
    } else {
      executeAction(`/api/v1/jobs/${type}`, { action: 'all', filter })
    }
  }

  if (isLoading) {
    return <div className="flex items-center gap-2 text-zinc-500 justify-center py-12"><Loader2 className="w-5 h-5 animate-spin"/> Loading operations data...</div>
  }

  const active = projects.filter(p => ['queued', 'generating'].includes(p.status))
  const paused = projects.filter(p => p.status === 'paused')
  const failed = projects.filter(p => p.status === 'failed')
  const completed = projects.filter(p => p.status === 'completed')
  const cancelled = projects.filter(p => ['cancelled', 'cancelling'].includes(p.status))

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:col-span-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-bold mb-1">Queue Control</h2>
          <p className="text-zinc-400 text-sm">Manage pipeline execution.</p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {selectedProjects.length > 0 && (
            <>
              <button 
                onClick={() => handleBulkAction('pause', 'selected')} disabled={isProcessingAction}
                className="px-3 py-1.5 bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-400 border border-yellow-400/20 disabled:opacity-50 text-sm rounded transition-colors"
              >
                Pause Selected
              </button>
              <button 
                onClick={() => handleBulkAction('resume', 'selected')} disabled={isProcessingAction}
                className="px-3 py-1.5 bg-green-400/10 hover:bg-green-400/20 text-green-400 border border-green-400/20 disabled:opacity-50 text-sm rounded transition-colors"
              >
                Resume Selected
              </button>
              <button 
                onClick={() => handleBulkAction('stop', 'selected')} disabled={isProcessingAction}
                className="px-3 py-1.5 bg-red-400/10 hover:bg-red-400/20 text-red-400 border border-red-400/20 disabled:opacity-50 text-sm rounded transition-colors"
              >
                Stop Selected
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <CollapsibleSection title="Active Jobs" count={active.length}>
          {active.map(p => (
            <QueueItem 
              key={p.id} project={p} 
              isSelected={selectedProjects.includes(p.id)} 
              onToggleSelect={handleToggleSelect}
              onPause={handlePause} onResume={handleResume} onStop={handleStop}
            />
          ))}
        </CollapsibleSection>

        <CollapsibleSection title="Paused Jobs" count={paused.length}>
          {paused.map(p => (
            <QueueItem 
              key={p.id} project={p} 
              isSelected={selectedProjects.includes(p.id)} 
              onToggleSelect={handleToggleSelect}
              onPause={handlePause} onResume={handleResume} onStop={handleStop}
            />
          ))}
        </CollapsibleSection>

        <CollapsibleSection title="Failed Jobs" count={failed.length} defaultOpen={false}>
          {failed.map(p => (
            <QueueItem 
              key={p.id} project={p} 
              isSelected={selectedProjects.includes(p.id)} 
              onToggleSelect={handleToggleSelect}
              onPause={handlePause} onResume={handleResume} onStop={handleStop}
            />
          ))}
        </CollapsibleSection>

        <CollapsibleSection title="Completed Jobs" count={completed.length} defaultOpen={false}>
          {completed.map(p => (
            <QueueItem 
              key={p.id} project={p} 
              isSelected={selectedProjects.includes(p.id)} 
              onToggleSelect={handleToggleSelect}
              onPause={handlePause} onResume={handleResume} onStop={handleStop}
            />
          ))}
        </CollapsibleSection>

        <CollapsibleSection title="Cancelled Jobs" count={cancelled.length} defaultOpen={false}>
          {cancelled.map(p => (
            <QueueItem 
              key={p.id} project={p} 
              isSelected={selectedProjects.includes(p.id)} 
              onToggleSelect={handleToggleSelect}
              onPause={handlePause} onResume={handleResume} onStop={handleStop}
            />
          ))}
        </CollapsibleSection>
        
        {projects.length === 0 && (
          <div className="text-zinc-500 text-sm py-4">No jobs found in the system.</div>
        )}
      </div>
    </div>
  )
}

function DashboardContent() {
  const { projects } = useOperations()
  
  return (
    <main className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto space-y-8 mt-12">
      <OperationsSummaryHeader projects={projects} />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <InitializePipeline />
        <OperationsConsole />
      </div>
    </main>
  )
}

export default function Home() {
  return (
    <OperationsDashboardProvider>
      <DashboardContent />
    </OperationsDashboardProvider>
  )
}
