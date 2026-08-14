'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Download,
  Film,
  FileText,
  RotateCcw,
  Sparkles,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface ProjectDetails {
  id: string;
  title: string;
  topic: string;
  status: string;
  style_preset_id?: string;
  duration_target_seconds?: number;
  created_at: string;
  scenes?: any[];
}

export default function ProjectOverviewPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [resuming, setResuming] = useState(false);

  const fetchProject = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await fetch(`/api/v1/projects/${projectId}`);
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        setProject(data.data);
      }
    } catch (err) {
      console.error('Failed to load project details:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject(true);

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/projects/${projectId}`);
        const data = await res.json();
        if (data.status === 'success' && data.data) {
          setProject(data.data);
          if (data.data.status === 'completed' || data.data.status === 'failed') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [projectId, fetchProject]);

  const handleResumePipeline = async () => {
    try {
      setResuming(true);
      const res = await fetch(`/api/v1/projects/${projectId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume: true }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setProject((prev) => (prev ? { ...prev, status: 'queued' } : prev));
      }
    } catch (err) {
      console.error('Pipeline resume failed:', err);
    } finally {
      setResuming(false);
    }
  };

  if (loading) {
    return <ProjectOverviewSkeleton />;
  }

  if (!project) {
    return (
      <div className="p-12 text-center">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>Project not found or failed to load.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isCompleted = project.status === 'completed';
  const isFailed = project.status === 'failed';
  const isGenerating = project.status === 'generating' || project.status === 'queued';

  const videoDownloadUrl = `/api/v1/storage/projects/${project.id}/composition.mp4?download=true`;
  const subtitlesDownloadUrl = `/api/v1/storage/projects/${project.id}/subtitles.srt?download=true`;
  const checkpointDownloadUrl = `/api/v1/storage/projects/${project.id}/revisions/v1/checkpoint_03_script.json?download=true`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-display-sm font-display font-bold text-text-primary flex items-center gap-2.5">
              <Film className="w-7 h-7 text-primary" /> {project.title || project.topic || 'Untitled'}
            </h1>
            <Badge
              variant={
                isCompleted
                  ? 'success'
                  : isFailed
                  ? 'destructive'
                  : isGenerating
                  ? 'default'
                  : 'secondary'
              }
              className="gap-1.5 uppercase tracking-wider"
            >
              {isCompleted ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : isFailed ? (
                <AlertTriangle className="w-3.5 h-3.5" />
              ) : (
                <Clock className="w-3.5 h-3.5" />
              )}
              {project.status}
            </Badge>
          </div>
          <p className="text-body-sm text-text-secondary mt-1 max-w-2xl">
            Topic: &ldquo;{project.topic}&rdquo;
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href={`/projects/${project.id}/timeline`}>
            <Button variant="primary">
              <Sparkles className="w-4 h-4 mr-2" /> Timeline Studio
            </Button>
          </Link>
          <Button variant="secondary" onClick={() => fetchProject()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Failure Diagnostic Alert & Resume Button */}
      {isFailed && (
        <Alert variant="destructive" className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <AlertTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Generation Interrupted
            </AlertTitle>
            <AlertDescription>
              Pipeline encountered an error during generation. Checkpoints are preserved on disk.
            </AlertDescription>
          </div>
          <Button
            onClick={handleResumePipeline}
            disabled={resuming}
            variant="destructive"
            size="sm"
            className="shrink-0"
          >
            {resuming ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RotateCcw className="w-4 h-4 mr-2" />
            )}
            Resume Pipeline ($0.00 Cached)
          </Button>
        </Alert>
      )}

      {/* Main Grid: Player & Assets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Video Player */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden bg-black/60 border-border">
            <div className="aspect-video w-full flex items-center justify-center relative bg-bg-input">
              {isCompleted ? (
                <video
                  src={`/api/v1/storage/projects/${project.id}/composition.mp4`}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center space-y-3 p-8">
                  <div className="w-16 h-16 bg-primary/20 text-primary border border-primary/30 rounded-2xl flex items-center justify-center mx-auto shadow-glow-subtle">
                    <Play className="w-8 h-8 ml-1" />
                  </div>
                  <p className="text-body-sm text-text-secondary">
                    {isGenerating
                      ? 'Automated Video Pipeline Generating…'
                      : 'Video composition will appear here upon completion.'}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right: Export & Assets */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-heading-sm">
                <Download className="w-4 h-4 text-primary" /> Export & Assets
              </CardTitle>
              <CardDescription>
                Download generated production assets and stage checkpoints.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <a
                href={videoDownloadUrl}
                download
                className="w-full px-4 py-3 bg-bg-input hover:bg-bg-elevated border border-border hover:border-border-strong rounded-xl text-body-sm font-medium flex items-center justify-between text-text-primary transition-all group"
              >
                <span className="flex items-center gap-2.5">
                  <Film className="w-4 h-4 text-primary" /> Final MP4 Video
                </span>
                <Download className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
              </a>

              <a
                href={subtitlesDownloadUrl}
                download
                className="w-full px-4 py-3 bg-bg-input hover:bg-bg-elevated border border-border hover:border-border-strong rounded-xl text-body-sm font-medium flex items-center justify-between text-text-primary transition-all group"
              >
                <span className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-emerald-400" /> Subtitles (.srt)
                </span>
                <Download className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
              </a>

              <a
                href={checkpointDownloadUrl}
                download
                className="w-full px-4 py-3 bg-bg-input hover:bg-bg-elevated border border-border hover:border-border-strong rounded-xl text-body-sm font-medium flex items-center justify-between text-text-primary transition-all group"
              >
                <span className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Script Checkpoint (.json)
                </span>
                <Download className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ProjectOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Skeleton className="aspect-video w-full" />
        </div>
        <div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
