import React from 'react'
import { useRouter } from 'next/navigation'
import { Video, ArrowRight, Play, Pause, Square, AlertTriangle } from 'lucide-react'
import { ProjectRow, JobRow } from '../../types/telemetry'

interface QueueItemProps {
  project: ProjectRow & { job?: JobRow | null }
  isSelected: boolean
  onToggleSelect: (id: string) => void
  onPause: (id: string) => void
  onResume: (id: string) => void
  onStop: (id: string) => void
}

export function QueueItem({ project, isSelected, onToggleSelect, onPause, onResume, onStop }: QueueItemProps) {
  const router = useRouter()
  
  const statusColors: Record<string, string> = {
    failed: 'text-red-400 bg-red-400/10 border-red-400/20',
    cancelled: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    cancelling: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    completed: 'text-green-400 bg-green-400/10 border-green-400/20',
    paused: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    generating: 'text-blue-400 bg-blue-400/10 border-blue-400/20 animate-pulse',
    queued: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20'
  }

  const colorClass = statusColors[project.status] || 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20'

  return (
    <div
      className={`group w-full flex flex-col p-4 border rounded-xl transition-all duration-200 text-left ${
        isSelected 
          ? 'bg-zinc-800 border-zinc-600 shadow-md' 
          : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900 hover:-translate-y-0.5 hover:shadow-lg'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <input 
            type="checkbox" 
            checked={isSelected}
            onChange={() => onToggleSelect(project.id)}
            className="w-4 h-4 mt-1 rounded border-zinc-700 bg-zinc-900 text-white accent-blue-500 cursor-pointer"
          />
          <button 
            onClick={() => router.push(`/projects/${project.id}`)}
            className="flex items-start gap-3 flex-1 text-left"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${colorClass.split(' ').slice(1).join(' ')}`}>
              <Video className={`w-5 h-5 ${colorClass.split(' ')[0]}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold text-zinc-100 line-clamp-1 truncate">
                {project.topic || 'Untitled'}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs">
                <span className={`px-2 py-0.5 rounded-full border capitalize font-medium ${colorClass}`}>
                  {project.status}
                </span>
                
                {project.job?.current_step && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded text-[11px] uppercase tracking-wider font-medium">
                      Stage: {project.job.current_step.replace(/_/g, ' ')}
                    </span>
                  </>
                )}
                
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-500">
                  Updated: {new Date(project.updated_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </button>
        </div>
        
        {/* Quick Actions (visible on hover) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {['queued', 'generating'].includes(project.status) && (
            <button 
              onClick={(e) => { e.stopPropagation(); onPause(project.id); }}
              className="p-2 text-yellow-400/70 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-colors"
              title="Pause Job"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
          
          {project.status === 'paused' && (
            <button 
              onClick={(e) => { e.stopPropagation(); onResume(project.id); }}
              className="p-2 text-green-400/70 hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
              title="Resume Job"
            >
              <Play className="w-4 h-4" />
            </button>
          )}

          {['queued', 'generating', 'paused', 'cancelling'].includes(project.status) && (
            <button 
              onClick={(e) => { e.stopPropagation(); onStop(project.id); }}
              className="p-2 text-red-400/70 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
              title="Stop Job"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          )}

          <div className="w-px h-6 bg-zinc-800 mx-1"></div>

          <button 
            onClick={() => router.push(`/projects/${project.id}`)}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium"
          >
            Dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Progress Bar for Active Jobs */}
      {['generating', 'cancelling'].includes(project.status) && project.job && (
        <div className="mt-4 w-full bg-zinc-900 rounded-full h-1.5 border border-zinc-800 overflow-hidden">
          <div 
            className="bg-blue-500 h-1.5 transition-all duration-500 ease-out" 
            style={{ width: `${Math.max(5, project.job.progress || 0)}%` }}
          ></div>
        </div>
      )}
    </div>
  )
}
