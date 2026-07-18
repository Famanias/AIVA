'use client'

import React from 'react'
import { useDashboard } from '../../providers/DashboardProvider'
import { FileText, Clock, Calendar } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

export function JobMetadataPanel() {
  const { telemetry } = useDashboard()
  const { job, project } = telemetry

  if (!job || !project) return null

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-zinc-400 mb-4 flex items-center gap-2">
        <FileText className="w-4 h-4" /> Job Metadata
      </h3>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Project ID</label>
            <code className="text-xs text-zinc-300 bg-zinc-800 px-2 py-1 rounded select-all">
              {project.id}
            </code>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Job ID</label>
            <code className="text-xs text-zinc-300 bg-zinc-800 px-2 py-1 rounded select-all">
              {job.id}
            </code>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Topic</label>
            <span className="text-sm text-zinc-200">{project.topic}</span>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Style</label>
            <span className="text-sm text-zinc-200 capitalize">{project.video_style}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-800">
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Created
            </label>
            <span className="text-sm text-zinc-400">
              {format(new Date(job.created_at), 'MMM d, HH:mm:ss')}
            </span>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Last Updated
            </label>
            <span className="text-sm text-zinc-400">
              {formatDistanceToNow(new Date(job.updated_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
