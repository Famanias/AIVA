'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Play,
  RotateCcw,
  Image as ImageIcon,
  Mic,
  Film,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  ArrowLeft,
  Clock,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea, Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Toast } from '@/components/ui/toast';

interface Scene {
  id: string;
  sequence_number: number;
  script_segment: string;
  visual_type: string;
  visual_prompt: string;
  duration: number;
  render_status: string;
  voiceover_url?: string;
  preview_url?: string;
}

export default function TimelineStudioPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [projectTitle, setProjectTitle] = useState('Project Timeline');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [rerenderingSceneId, setRerenderingSceneId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState<{ [key: string]: string }>({});
  const [editedPrompt, setEditedPrompt] = useState<{ [key: string]: string }>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchProjectTimeline = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/projects/${projectId}`);
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        setProjectTitle(data.data.title || data.data.topic || 'Project Timeline');
        const loadedScenes = data.data.scenes || [];
        setScenes(loadedScenes);
        const textMap: { [key: string]: string } = {};
        const promptMap: { [key: string]: string } = {};
        loadedScenes.forEach((s: Scene) => {
          textMap[s.id] = s.script_segment || '';
          promptMap[s.id] = s.visual_prompt || '';
        });
        setEditedText(textMap);
        setEditedPrompt(promptMap);
      }
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectTimeline();
  }, [fetchProjectTimeline]);

  const handleRerenderScene = async (sceneId: string) => {
    try {
      setRerenderingSceneId(sceneId);
      const payload = {
        script_segment: editedText[sceneId],
        visual_prompt: editedPrompt[sceneId],
      };

      const res = await fetch(
        `/api/v1/projects/${projectId}/scenes/${sceneId}/rerender`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (data.status === 'success') {
        setScenes((prev) =>
          prev.map((s) =>
            s.id === sceneId
              ? {
                  ...s,
                  script_segment: payload.script_segment || s.script_segment,
                  visual_prompt: payload.visual_prompt || s.visual_prompt,
                  render_status: 'queued',
                }
              : s
          )
        );
        setEditingSceneId(null);
        setToast({
          type: 'success',
          message: 'Scene queued for re-rendering.',
        });
      } else {
        setToast({
          type: 'error',
          message: data.error || 'Failed to re-render scene',
        });
      }
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'Failed to re-render scene',
      });
    } finally {
      setRerenderingSceneId(null);
    }
  };

  if (loading) {
    return <TimelineSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-display-sm font-display font-bold text-text-primary flex items-center gap-2.5">
              <Film className="w-7 h-7 text-primary" /> Timeline Studio
            </h1>
            <p className="text-body-sm text-text-secondary mt-0.5">{projectTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => fetchProjectTimeline()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh Timeline
          </Button>
        </div>
      </div>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Main Preview Player Canvas */}
      <Card className="overflow-hidden bg-black/60 border-border">
        <div className="aspect-video max-h-[360px] w-full flex items-center justify-center relative bg-bg-input">
          <div className="text-center space-y-3 p-6">
            <div className="w-16 h-16 bg-primary/20 text-primary border border-primary/30 rounded-2xl flex items-center justify-center mx-auto shadow-glow-subtle">
              <Play className="w-8 h-8 ml-1" />
            </div>
            <p className="text-body-sm text-text-secondary">
              @remotion/player Interactive Timeline Canvas
            </p>
          </div>
        </div>
      </Card>

      {/* Multitrack Scene Editor */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-heading-md text-text-primary flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> Scene Breakdown ({scenes.length} Scenes)
          </h2>
        </div>

        <div className="space-y-3">
          {scenes.length === 0 ? (
            <Card className="border-dashed p-8 text-center text-text-muted">
              No scenes generated yet. Initialize and start video generation from the Dashboard.
            </Card>
          ) : (
            scenes.map((scene) => {
              const isEditing = editingSceneId === scene.id;
              const isReRendering = rerenderingSceneId === scene.id;

              return (
                <Card
                  key={scene.id}
                  className="p-5 transition-all duration-base hover:border-border-strong flex flex-col md:flex-row gap-4 justify-between items-start"
                >
                  <div className="flex gap-4 items-start flex-1 w-full min-w-0">
                    <span className="w-8 h-8 bg-bg-elevated text-primary font-display font-bold rounded-xl text-body-sm flex items-center justify-center shrink-0 border border-border shadow-sm mt-0.5">
                      #{scene.sequence_number}
                    </span>

                    <div className="space-y-3 flex-1 w-full min-w-0">
                      {isEditing ? (
                        <div className="space-y-3 w-full">
                          <div>
                            <Label className="text-caption font-semibold text-primary mb-1.5 block">
                              Script Segment (Narration)
                            </Label>
                            <Textarea
                              value={editedText[scene.id] || ''}
                              onChange={(e) =>
                                setEditedText({ ...editedText, [scene.id]: e.target.value })
                              }
                              rows={2}
                            />
                          </div>

                          <div>
                            <Label className="text-caption font-semibold text-primary mb-1.5 block">
                              Visual Prompt
                            </Label>
                            <Input
                              type="text"
                              value={editedPrompt[scene.id] || ''}
                              onChange={(e) =>
                                setEditedPrompt({ ...editedPrompt, [scene.id]: e.target.value })
                              }
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-body font-medium text-text-primary">
                            &ldquo;{scene.script_segment}&rdquo;
                          </p>
                          {scene.visual_prompt && (
                            <p className="text-body-sm text-text-muted italic">
                              Visual: {scene.visual_prompt}
                            </p>
                          )}
                        </>
                      )}

                      <div className="flex flex-wrap gap-2 text-caption text-text-muted pt-1">
                        <span className="bg-bg-input px-2.5 py-1 rounded-lg border border-border flex items-center gap-1.5 font-medium">
                          <ImageIcon className="w-3.5 h-3.5 text-primary" /> {scene.visual_type}
                        </span>
                        <span className="bg-bg-input px-2.5 py-1 rounded-lg border border-border flex items-center gap-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5 text-emerald-400" /> {scene.duration || 0}s
                        </span>
                        <Badge
                          variant={
                            scene.render_status === 'completed'
                              ? 'success'
                              : 'warning'
                          }
                          className="gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Status: {scene.render_status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {isEditing ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditingSceneId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleRerenderScene(scene.id)}
                          disabled={isReRendering}
                        >
                          {isReRendering ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          )}
                          Save &amp; Re-render
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditingSceneId(scene.id)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRerenderScene(scene.id)}
                          disabled={isReRendering}
                        >
                          {isReRendering ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5 text-primary mr-1" />
                          )}
                          Re-render
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-36" />
      </div>
      <Skeleton className="aspect-video max-h-[360px] w-full" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}
