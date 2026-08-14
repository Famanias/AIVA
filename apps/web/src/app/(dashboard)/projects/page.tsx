'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Plus,
  Film,
  ExternalLink,
  Trash2,
  MoreHorizontal,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  PauseCircle,
  XCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown';
import { formatDistanceToNow } from 'date-fns';
import {
  OperationsDashboardProvider,
  useOperations,
} from '@/providers/OperationsDashboardProvider';
import { ProjectRow } from '@/types/telemetry';

export default function ProjectsPage() {
  return (
    <OperationsDashboardProvider>
      <ProjectsListContent />
    </OperationsDashboardProvider>
  );
}

function ProjectsListContent() {
  const { projects, isLoading, refresh } = useOperations();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete project');
      await refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) return <ProjectsSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-display-md text-text-primary">
            Projects
          </h1>
          <p className="text-body text-text-secondary mt-1">
            Browse and manage your video generation projects.
          </p>
        </div>
        <Link href="/">
          <Button size="lg" variant="primary">
            <Plus className="w-4 h-4 mr-2" /> New Project
          </Button>
        </Link>
      </div>

      {/* Grid */}
      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create your first video project to initialize the automated production pipeline."
          action={{ label: 'Create Project', href: '/' }}
          icon={Film}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={handleDelete}
              deleting={deletingId === project.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type ProjectItem = ProjectRow & {
  thumbnail_url?: string | null;
  duration_target_seconds?: number | null;
};

function ProjectCard({
  project,
  onDelete,
  deleting,
}: {
  project: ProjectItem;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const statusConfig = {
    completed: {
      label: 'Completed',
      variant: 'success' as const,
      icon: <CheckCircle className="w-3 h-3" />,
    },
    failed: {
      label: 'Failed',
      variant: 'destructive' as const,
      icon: <AlertCircle className="w-3 h-3" />,
    },
    generating: {
      label: 'Generating',
      variant: 'default' as const,
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
    },
    queued: {
      label: 'Queued',
      variant: 'secondary' as const,
      icon: <Clock className="w-3 h-3" />,
    },
    paused: {
      label: 'Paused',
      variant: 'warning' as const,
      icon: <PauseCircle className="w-3 h-3" />,
    },
    cancelled: {
      label: 'Cancelled',
      variant: 'outline' as const,
      icon: <XCircle className="w-3 h-3" />,
    },
  } as const;

  const config =
    statusConfig[project.status as keyof typeof statusConfig] ||
    statusConfig.queued;

  return (
    <Card className="group overflow-hidden flex flex-col h-full transition-all duration-base hover:-translate-y-1">
      {/* Thumbnail / Preview placeholder */}
      <div className="relative aspect-video bg-bg-input overflow-hidden border-b border-border">
        {project.thumbnail_url ? (
          <img
            src={project.thumbnail_url}
            alt=""
            className="w-full h-full object-cover transition-transform duration-slow group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted bg-gradient-to-br from-bg-input to-bg-card">
            <Film className="w-10 h-10 opacity-40 group-hover:text-primary group-hover:opacity-80 transition-all" />
          </div>
        )}
        <div className="absolute top-3 right-3">
          <Badge variant={config.variant} className="gap-1 shadow-sm">
            {config.icon} {config.label}
          </Badge>
        </div>
      </div>

      <CardContent className="flex-1 flex flex-col p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-semibold text-text-primary truncate text-heading-sm">
            {project.title || project.topic || 'Untitled'}
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-text-muted hover:text-text-primary"
              >
                <MoreHorizontal className="w-4 h-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4 text-primary" /> View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={`/projects/${project.id}/timeline`}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Film className="w-4 h-4 text-primary" /> Timeline Studio
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(project.id)}
                disabled={deleting}
                className="flex items-center gap-2 text-error focus:text-error cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="text-body-sm text-text-secondary line-clamp-2">
          {project.topic || 'No description provided.'}
        </p>

        <div className="flex items-center gap-3 text-caption text-text-muted mt-auto pt-2 border-t border-border">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-text-muted" />
            {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
          </span>
          {project.duration_target_seconds && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-text-muted" /> {project.duration_target_seconds}s
            </span>
          )}
        </div>

        <Link href={`/projects/${project.id}`} className="mt-2 block">
          <Button variant="secondary" className="w-full" size="sm">
            Open Project
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="aspect-video w-full" />
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-9 w-full mt-auto" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
