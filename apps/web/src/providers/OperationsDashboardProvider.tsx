'use client'

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@aiva/shared-types'
import { ProjectRow, JobRow } from '../types/telemetry'

interface EnhancedProject extends ProjectRow {
  job?: JobRow | null
}

interface OperationsContextType {
  projects: EnhancedProject[]
  isLoading: boolean
  refresh: () => Promise<void>
}

const OperationsContext = createContext<OperationsContextType | null>(null)

export function OperationsDashboardProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<EnhancedProject[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const loadProjects = async () => {
    setIsLoading(true)
    const { data: projectData } = await supabase
      .from('projects')
      .select('*, jobs(*)')
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (projectData) {
      const enhanced = projectData.map(p => ({
        ...p,
        job: (Array.isArray(p.jobs) ? p.jobs[0] : p.jobs) as JobRow | null
      }))
      setProjects(enhanced as EnhancedProject[])
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadProjects()
  }, [supabase])

  useEffect(() => {
    const projectsSub = supabase
      .channel('public:projects')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setProjects(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...(payload.new as ProjectRow) } : p))
          } else if (payload.eventType === 'INSERT') {
            setProjects(prev => [{ ...(payload.new as ProjectRow) }, ...prev])
          }
        }
      )
      .subscribe()

    const jobsSub = supabase
      .channel('public:jobs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setProjects(prev => prev.map(p => p.id === payload.new.project_id ? { ...p, job: { ...p.job, ...(payload.new as JobRow) } } : p))
          } else if (payload.eventType === 'INSERT') {
            setProjects(prev => prev.map(p => p.id === payload.new.project_id ? { ...p, job: payload.new as JobRow } : p))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(projectsSub)
      supabase.removeChannel(jobsSub)
    }
  }, [supabase])

  return (
    <OperationsContext.Provider value={{ projects, isLoading, refresh: loadProjects }}>
      {children}
    </OperationsContext.Provider>
  )
}

export function useOperations() {
  const context = useContext(OperationsContext)
  if (!context) {
    throw new Error('useOperations must be used within OperationsDashboardProvider')
  }
  return context
}
