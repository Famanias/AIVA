'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Play, Pause, Square, Layers, Loader2 } from 'lucide-react';
import { useOperations } from '@/providers/OperationsDashboardProvider';
import { QueueItem } from './QueueItem';
import { Button } from '@/components/ui/button';

function CollapsibleSection({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-2.5 transition-colors font-semibold text-body-sm cursor-pointer"
      >
        {isOpen ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
        <span>{title}</span>
        <span className="text-text-muted text-caption font-normal bg-bg-input px-2 py-0.5 rounded-full border border-border">
          {count}
        </span>
      </button>
      {isOpen && (
        <div className="space-y-2.5 pl-2 border-l border-border/80 ml-2">
          {children}
        </div>
      )}
    </div>
  );
}

export function OperationsConsole() {
  const { projects, isLoading, refresh } = useOperations();
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const handleToggleSelect = (id: string) => {
    setSelectedProjects((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const executeAction = async (endpoint: string, payload: any) => {
    setIsProcessingAction(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Action failed');
      }
      setSelectedProjects([]);
      await refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handlePause = (id: string) =>
    executeAction('/api/v1/jobs/pause', {
      action: 'single',
      jobId: projects.find((p) => p.id === id)?.job?.id,
      projectId: id,
    });

  const handleResume = (id: string) =>
    executeAction('/api/v1/jobs/resume', {
      action: 'single',
      jobId: projects.find((p) => p.id === id)?.job?.id,
      projectId: id,
    });

  const handleStop = (id: string) =>
    executeAction('/api/v1/jobs/stop', {
      action: 'single',
      jobId: projects.find((p) => p.id === id)?.job?.id,
      projectId: id,
    });

  const handleBulkAction = (
    type: 'stop' | 'pause' | 'resume',
    filter: 'selected' | 'queued' | 'processing'
  ) => {
    if (filter === 'selected') {
      const jobIds = projects
        .filter((p) => selectedProjects.includes(p.id))
        .map((p) => p.job?.id)
        .filter(Boolean);
      if (jobIds.length === 0) return alert('No active jobs found for the selected projects.');
      executeAction(`/api/v1/jobs/${type}`, { action: 'selected', jobIds });
    } else {
      executeAction(`/api/v1/jobs/${type}`, { action: 'all', filter });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-text-muted">
        <Loader2 className="w-5 h-5 animate-spin text-primary" /> Loading operations data…
      </div>
    );
  }

  const active = projects.filter((p) => ['queued', 'generating'].includes(p.status));
  const paused = projects.filter((p) => p.status === 'paused');
  const failed = projects.filter((p) => p.status === 'failed');
  const completed = projects.filter((p) => p.status === 'completed');
  const cancelled = projects.filter((p) => ['cancelled', 'cancelling'].includes(p.status));

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-heading-md font-display font-bold text-text-primary flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" /> Queue Control
          </h2>
          <p className="text-body-sm text-text-secondary mt-0.5">
            Monitor and manage live pipeline execution.
          </p>
        </div>

        {selectedProjects.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-caption text-text-muted mr-1">
              {selectedProjects.length} selected
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleBulkAction('pause', 'selected')}
              disabled={isProcessingAction}
              className="text-amber-400 border-amber-500/20 hover:bg-amber-950/30"
            >
              <Pause className="w-3.5 h-3.5 mr-1" /> Pause
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleBulkAction('resume', 'selected')}
              disabled={isProcessingAction}
              className="text-emerald-400 border-emerald-500/20 hover:bg-emerald-950/30"
            >
              <Play className="w-3.5 h-3.5 mr-1" /> Resume
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleBulkAction('stop', 'selected')}
              disabled={isProcessingAction}
            >
              <Square className="w-3.5 h-3.5 mr-1 fill-current" /> Stop
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <CollapsibleSection title="Active Jobs" count={active.length}>
          {active.map((p) => (
            <QueueItem
              key={p.id}
              project={p}
              isSelected={selectedProjects.includes(p.id)}
              onToggleSelect={handleToggleSelect}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStop}
            />
          ))}
        </CollapsibleSection>

        <CollapsibleSection title="Paused Jobs" count={paused.length}>
          {paused.map((p) => (
            <QueueItem
              key={p.id}
              project={p}
              isSelected={selectedProjects.includes(p.id)}
              onToggleSelect={handleToggleSelect}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStop}
            />
          ))}
        </CollapsibleSection>

        <CollapsibleSection title="Failed Jobs" count={failed.length} defaultOpen={false}>
          {failed.map((p) => (
            <QueueItem
              key={p.id}
              project={p}
              isSelected={selectedProjects.includes(p.id)}
              onToggleSelect={handleToggleSelect}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStop}
            />
          ))}
        </CollapsibleSection>

        <CollapsibleSection title="Completed Jobs" count={completed.length} defaultOpen={false}>
          {completed.map((p) => (
            <QueueItem
              key={p.id}
              project={p}
              isSelected={selectedProjects.includes(p.id)}
              onToggleSelect={handleToggleSelect}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStop}
            />
          ))}
        </CollapsibleSection>

        <CollapsibleSection title="Cancelled Jobs" count={cancelled.length} defaultOpen={false}>
          {cancelled.map((p) => (
            <QueueItem
              key={p.id}
              project={p}
              isSelected={selectedProjects.includes(p.id)}
              onToggleSelect={handleToggleSelect}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStop}
            />
          ))}
        </CollapsibleSection>

        {projects.length === 0 && (
          <div className="text-text-muted text-body-sm py-8 text-center border border-dashed border-border rounded-xl">
            No jobs found in the system. Create a video to get started.
          </div>
        )}
      </div>
    </div>
  );
}
