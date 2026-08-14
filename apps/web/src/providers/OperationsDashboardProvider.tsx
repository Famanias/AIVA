'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
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

  const loadProjects = async (isInitial = false) => {
    if (isInitial) setIsLoading(true)
    try {
      const res = await fetch('/api/v1/projects?limit=50')
      const data = await res.json()
      if (data.status === 'success' && Array.isArray(data.data)) {
        setProjects(data.data as EnhancedProject[])
      }
    } catch (err) {
      console.error('[OperationsDashboardProvider] Failed to fetch projects:', err)
    } finally {
      if (isInitial) setIsLoading(false)
    }
  }

  useEffect(() => {
    loadProjects(true)
    const interval = setInterval(() => {
      loadProjects(false)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <OperationsContext.Provider value={{ projects, isLoading, refresh: () => loadProjects(false) }}>
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
