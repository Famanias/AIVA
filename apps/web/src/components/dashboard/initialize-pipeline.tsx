'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, MessageSquare, Wand2, Send, Zap, Film, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function InitializePipeline() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'briefing' | 'quick_launch'>('briefing');

  // Briefing Chat State
  const [topic, setTopic] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Quick-Launch State
  const [customScript, setCustomScript] = useState('');

  // Common Video Parameters
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [voiceId, setVoiceId] = useState('en-US-AriaNeural');
  const [persona, setPersona] = useState('Informative');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatLoading]);

  // Start Briefing Conversation
  const handleStartBriefing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    const initialUserMsg: ChatMessage = {
      role: 'user',
      content: `I want to create a video about: "${topic}". What creative direction and angle do you suggest?`
    };

    setMessages([initialUserMsg]);
    setIsChatLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/studio/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          messages: [initialUserMsg]
        })
      });

      const data = await res.json();
      if (!res.ok || data.status === 'error') {
        throw new Error(data.error || 'Failed to connect to AI Studio Producer.');
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Send Follow-up Message in Briefing Chat
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setChatInput('');
    setIsChatLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/studio/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          messages: updatedMessages
        })
      });

      const data = await res.json();
      if (!res.ok || data.status === 'error') {
        throw new Error(data.error || 'Failed to receive reply from AI Studio Producer.');
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Launch Video Generation Pipeline
  const handleLaunchPipeline = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // Gather briefing context if in briefing mode
      let briefingContext = '';
      if (activeTab === 'briefing' && messages.length > 0) {
        briefingContext = messages
          .map((m) => `${m.role === 'user' ? 'Creator' : 'AI Director'}: ${m.content}`)
          .join('\n\n');
      }

      const payload = {
        input_mode: activeTab === 'briefing' ? 'topic' : 'custom_script',
        topic: activeTab === 'briefing' ? topic : (topic || customScript.slice(0, 40)),
        custom_script: activeTab === 'quick_launch' ? customScript : '',
        briefing_context: briefingContext,
        style: 'documentary', // Default template family
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div>
          <h2 className="text-heading-md font-display font-bold text-text-primary flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> AI Production Studio
          </h2>
          <p className="text-body-sm text-text-secondary mt-0.5">
            Collaborate with the AI Creative Director or launch instant custom scripts.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-bg-input rounded-xl border border-border self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('briefing')}
            className={`flex items-center gap-1.5 py-1.5 px-3 text-body-sm rounded-lg font-medium transition-all duration-fast cursor-pointer ${
              activeTab === 'briefing'
                ? 'bg-bg-elevated text-primary shadow-sm font-semibold border border-border/40'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Studio Briefing
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quick_launch')}
            className={`flex items-center gap-1.5 py-1.5 px-3 text-body-sm rounded-lg font-medium transition-all duration-fast cursor-pointer ${
              activeTab === 'quick_launch'
                ? 'bg-bg-elevated text-primary shadow-sm font-semibold border border-border/40'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Zap className="w-4 h-4" /> Quick Script Launch
          </button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Mode 1: Interactive Studio Briefing Chat */}
      {activeTab === 'briefing' && (
        <div className="space-y-4">
          {messages.length === 0 ? (
            /* Step 1: Initial Topic Input */
            <form onSubmit={handleStartBriefing} className="space-y-4">
              <div className="p-6 rounded-2xl bg-gradient-to-b from-bg-elevated to-bg-card border border-border shadow-card space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 mt-0.5">
                    <Wand2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-body-md font-semibold text-text-primary">What is your video concept?</h3>
                    <p className="text-body-sm text-text-secondary mt-0.5">
                      Enter a topic or rough idea. The AI Director will analyze the angle and ask 2–3 creative questions before generating.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Input
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Why Ancient Roman Concrete was Indestructible, or The Dark Secrets of Deep Sea Creatures..."
                    className="text-body-md py-3"
                  />
                </div>

                {/* Common Specs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <Label htmlFor="aspect-ratio-brief" className="mb-1.5 block text-xs">Format / Aspect</Label>
                    <select
                      id="aspect-ratio-brief"
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value as any)}
                      className="w-full h-9 px-2.5 rounded-lg bg-bg-input border border-border text-text-primary text-xs focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="9:16">Vertical 9:16 (Shorts/Reels)</option>
                      <option value="16:9">Horizontal 16:9 (YouTube)</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="voice-brief" className="mb-1.5 block text-xs">Voiceover</Label>
                    <select
                      id="voice-brief"
                      value={voiceId}
                      onChange={(e) => setVoiceId(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg bg-bg-input border border-border text-text-primary text-xs focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="en-US-AriaNeural">en-US Aria (Female)</option>
                      <option value="en-US-GuyNeural">en-US Guy (Male)</option>
                      <option value="en-GB-SoniaNeural">en-GB Sonia (British)</option>
                      <option value="en-AU-Neural">en-AU News (Australian)</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="duration-brief" className="mb-1.5 block text-xs">Target Duration</Label>
                    <select
                      id="duration-brief"
                      value={durationSeconds}
                      onChange={(e) => setDurationSeconds(Number(e.target.value))}
                      className="w-full h-9 px-2.5 rounded-lg bg-bg-input border border-border text-text-primary text-xs focus:outline-none focus:border-primary cursor-pointer"
                    >
                      <option value={30}>30s (Hook)</option>
                      <option value={60}>60s (Standard Short)</option>
                      <option value={90}>90s (Extended)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="submit" disabled={!topic.trim() || isChatLoading} size="lg">
                    {isChatLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Connecting to Director…
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-4 h-4 mr-2" /> Start Briefing Chat
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            /* Step 2: Interactive Briefing Chatroom */
            <div className="space-y-4">
              {/* Chat Thread Container */}
              <div className="p-4 sm:p-5 rounded-2xl bg-bg-card border border-border shadow-card min-h-[320px] max-h-[460px] overflow-y-auto space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-border/60 text-body-xs text-text-secondary">
                  <span className="flex items-center gap-1.5 font-medium text-text-primary">
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> Topic: {topic}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMessages([]);
                      setTopic('');
                    }}
                    className="flex items-center gap-1 hover:text-text-primary transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Reset
                  </button>
                </div>

                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="text-[11px] font-semibold text-text-tertiary mb-1 px-1">
                      {msg.role === 'user' ? 'You (Creator)' : 'AI Creative Director'}
                    </div>
                    <div
                      className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-body-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-primary text-white rounded-tr-sm shadow-sm'
                          : 'bg-bg-elevated border border-border text-text-primary rounded-tl-sm shadow-card'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {isChatLoading && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-bg-elevated border border-border text-text-secondary text-body-sm w-fit animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    AI Director is formulating scene direction…
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Follow-up Input & Action Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <form onSubmit={handleSendMessage} className="flex-1 flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Reply with your choices or add visual notes..."
                    disabled={isChatLoading || isSubmitting}
                    className="flex-1"
                  />
                  <Button type="submit" variant="secondary" disabled={!chatInput.trim() || isChatLoading || isSubmitting}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>

                <Button
                  type="button"
                  onClick={() => handleLaunchPipeline()}
                  disabled={isSubmitting || isChatLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold whitespace-nowrap shadow-md"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Initializing Video…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Generate Video with this Brief
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Quick Script Launch */}
      {activeTab === 'quick_launch' && (
        <form onSubmit={handleLaunchPipeline} className="space-y-4">
          <div className="p-6 rounded-2xl bg-bg-card border border-border shadow-card space-y-4">
            <div>
              <Label htmlFor="custom-script" className="mb-1.5 block font-semibold">
                Narration Script
              </Label>
              <Textarea
                id="custom-script"
                required
                rows={5}
                value={customScript}
                onChange={(e) => setCustomScript(e.target.value)}
                placeholder="Paste your full narration script segment here... The AI Director will automatically break it into visual scenes, search Pexels stock video, generate AI art, and composite the final video."
              />
            </div>

            {/* Formatting & Voice Specs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <Label htmlFor="aspect-ratio-ql" className="mb-1.5 block text-xs">Format / Aspect</Label>
                <select
                  id="aspect-ratio-ql"
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as any)}
                  className="w-full h-9 px-2.5 rounded-lg bg-bg-input border border-border text-text-primary text-xs focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="9:16">Vertical 9:16 (Shorts/Reels)</option>
                  <option value="16:9">Horizontal 16:9 (YouTube)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="voice-ql" className="mb-1.5 block text-xs">Voice Selection</Label>
                <select
                  id="voice-ql"
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg bg-bg-input border border-border text-text-primary text-xs focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="en-US-AriaNeural">en-US Aria (Female)</option>
                  <option value="en-US-GuyNeural">en-US Guy (Male)</option>
                  <option value="en-GB-SoniaNeural">en-GB Sonia (British)</option>
                  <option value="en-AU-Neural">en-AU News (Australian)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="persona-ql" className="mb-1.5 block text-xs">Tone / Persona</Label>
                <select
                  id="persona-ql"
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg bg-bg-input border border-border text-text-primary text-xs focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="Informative">Informative</option>
                  <option value="Dramatic">Dramatic Storytelling</option>
                  <option value="Energetic">High-Energy Explainer</option>
                </select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !customScript.trim()}
              className="w-full mt-2"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Initializing Generation…
                </>
              ) : (
                <>
                  <Film className="w-4 h-4 mr-2" /> Launch 1-Click Video Generation
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
