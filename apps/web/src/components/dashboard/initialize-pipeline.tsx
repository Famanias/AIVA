'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function InitializePipeline() {
  const router = useRouter();
  const [inputMode, setInputMode] = useState<'topic' | 'custom_script'>('topic');
  const [topic, setTopic] = useState('');
  const [customScript, setCustomScript] = useState('');
  const [style, setStyle] = useState('stickman_animation');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [voiceId, setVoiceId] = useState('en-US-AriaNeural');
  const [persona, setPersona] = useState('Informative');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

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
      };

      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.status === 'error') {
        throw new Error(data.error || 'Failed to create project');
      }

      router.push(`/projects/${data.project.id}`);
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-heading-md font-display font-bold text-text-primary flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-primary" /> Create Video Brief
        </h2>
        <p className="text-body-sm text-text-secondary mt-1">
          Configure video brief parameters to initialize the generation pipeline.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Input Mode Selector */}
        <div>
          <Label className="mb-2 block">Input Mode</Label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-bg-input rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setInputMode('topic')}
              className={`py-2 px-3 text-body-sm rounded-lg font-medium transition-all duration-fast cursor-pointer ${
                inputMode === 'topic'
                  ? 'bg-bg-elevated text-primary shadow-sm font-semibold border border-border/40'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Topic Brief (AI Research)
            </button>
            <button
              type="button"
              onClick={() => setInputMode('custom_script')}
              className={`py-2 px-3 text-body-sm rounded-lg font-medium transition-all duration-fast cursor-pointer ${
                inputMode === 'custom_script'
                  ? 'bg-bg-elevated text-primary shadow-sm font-semibold border border-border/40'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Custom Script Paste
            </button>
          </div>
        </div>

        {/* Topic Input or Custom Script Textarea */}
        {inputMode === 'topic' ? (
          <div>
            <Input
              label="Topic"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. The Untold History of Ancient Rome"
            />
          </div>
        ) : (
          <div>
            <Textarea
              label="Custom Script"
              required
              rows={4}
              value={customScript}
              onChange={(e) => setCustomScript(e.target.value)}
              placeholder="Paste your full narration script segment here..."
            />
          </div>
        )}

        {/* Aspect Ratio & Format */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="aspect-ratio" className="mb-1.5 block">Format / Aspect Ratio</Label>
            <select
              id="aspect-ratio"
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as any)}
              className="w-full h-10 px-3 rounded-lg bg-bg-input border border-border text-text-primary text-body-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="9:16">Vertical 9:16 (Shorts/Reels)</option>
              <option value="16:9">Horizontal 16:9 (YouTube)</option>
            </select>
          </div>

          <div>
            <Label htmlFor="duration-target" className="mb-1.5 block">Duration Target</Label>
            <select
              id="duration-target"
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-lg bg-bg-input border border-border text-text-primary text-body-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value={30}>30 Seconds (Quick Hook)</option>
              <option value={60}>60 Seconds (Standard Short)</option>
              <option value={90}>90 Seconds (Extended)</option>
              <option value={180}>180 Seconds (3 Minutes)</option>
            </select>
          </div>
        </div>

        {/* Template Style & Voice Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="template-style" className="mb-1.5 block">Template Style</Label>
            <select
              id="template-style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-bg-input border border-border text-text-primary text-body-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="stickman_animation">Stickman Animation</option>
              <option value="documentary">Ken-Burns Documentary</option>
            </select>
          </div>

          <div>
            <Label htmlFor="voice-selection" className="mb-1.5 block">Voice Selection</Label>
            <select
              id="voice-selection"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-bg-input border border-border text-text-primary text-body-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
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
          <Label htmlFor="persona-tone" className="mb-1.5 block">Persona / Tone</Label>
          <select
            id="persona-tone"
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-bg-input border border-border text-text-primary text-body-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="Informative">Informative & Educational</option>
            <option value="Dramatic">Dramatic & Story-driven</option>
            <option value="Energetic">Energetic & Fast-paced</option>
            <option value="Humorous">Humorous & Lighthearted</option>
          </select>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting || (inputMode === 'topic' ? !topic.trim() : !customScript.trim())}
          className="w-full mt-2"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Initializing Brief…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" /> Start Pipeline Generation
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
