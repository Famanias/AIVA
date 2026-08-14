import React from 'react';
import { useRouter } from 'next/navigation';
import { Video, ArrowRight, Play, Pause, Square } from 'lucide-react';
import { ProjectRow, JobRow } from '../../types/telemetry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/components/ui/utils';

interface QueueItemProps {
  project: ProjectRow & { job?: JobRow | null };
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onStop: (id: string) => void;
}

export function QueueItem({
  project,
  isSelected,
  onToggleSelect,
  onPause,
  onResume,
  onStop,
}: QueueItemProps) {
  const router = useRouter();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'paused':
        return <Badge variant="warning">Paused</Badge>;
      case 'generating':
        return (
          <Badge variant="default" className="animate-pulse">
            Generating
          </Badge>
        );
      case 'cancelling':
      case 'cancelled':
        return <Badge variant="outline">Cancelled</Badge>;
      case 'queued':
      default:
        return <Badge variant="secondary">Queued</Badge>;
    }
  };

  return (
    <div
      className={cn(
        'group w-full flex flex-col p-4 rounded-xl border transition-all duration-base text-left',
        isSelected
          ? 'bg-bg-elevated border-primary/40 shadow-glow-subtle'
          : 'bg-bg-card/70 border-border hover:border-border-strong hover:bg-bg-card hover:-translate-y-0.5 hover:shadow-md'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <div className="pt-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(project.id)}
              aria-label={`Select project ${project.topic || 'Untitled'}`}
            />
          </div>

          <button
            onClick={() => router.push(`/projects/${project.id}`)}
            className="flex items-start gap-3 flex-1 min-w-0 text-left cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-bg-elevated border border-border text-primary group-hover:border-primary/40 transition-colors">
              <Video className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-body font-semibold text-text-primary truncate">
                {project.topic || project.title || 'Untitled'}
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-caption text-text-muted flex-wrap">
                {getStatusBadge(project.status)}

                {project.job?.current_step && (
                  <>
                    <span>•</span>
                    <span className="bg-bg-input px-2 py-0.5 rounded text-[11px] uppercase tracking-wider font-medium text-text-secondary border border-border">
                      Stage: {project.job.current_step.replace(/_/g, ' ')}
                    </span>
                  </>
                )}

                <span>•</span>
                <span>
                  Updated: {new Date(project.updated_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Quick Actions (visible on hover or focus) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {['queued', 'generating'].includes(project.status) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onPause(project.id);
              }}
              title="Pause Job"
              className="h-8 w-8 text-amber-400 hover:text-amber-300 hover:bg-amber-950/30"
            >
              <Pause className="w-4 h-4" />
            </Button>
          )}

          {project.status === 'paused' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onResume(project.id);
              }}
              title="Resume Job"
              className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30"
            >
              <Play className="w-4 h-4" />
            </Button>
          )}

          {['queued', 'generating', 'paused', 'cancelling'].includes(project.status) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onStop(project.id);
              }}
              title="Stop Job"
              className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-950/30"
            >
              <Square className="w-4 h-4 fill-current" />
            </Button>
          )}

          <div className="w-px h-5 bg-border mx-1" />

          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/projects/${project.id}`)}
            className="h-8 text-caption gap-1 px-2.5"
          >
            Overview
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Progress Bar for Active Jobs */}
      {['generating', 'cancelling'].includes(project.status) && project.job && (
        <div className="mt-3 w-full bg-bg-input rounded-full h-1.5 border border-border overflow-hidden">
          <div
            className="bg-primary h-1.5 transition-all duration-500 ease-out shadow-glow-subtle"
            style={{ width: `${Math.max(5, project.job.progress || 0)}%` }}
          />
        </div>
      )}
    </div>
  );
}
