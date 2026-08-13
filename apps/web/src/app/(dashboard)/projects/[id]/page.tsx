"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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
} from "lucide-react";

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

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/projects/${projectId}`);
      const data = await res.json();
      if (data.status === "success" && data.data) {
        setProject(data.data);
      }
    } catch (err) {
      console.error("Failed to load project details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResumePipeline = async () => {
    try {
      setResuming(true);
      const res = await fetch(`/api/v1/projects/${projectId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: true }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setProject((prev) => (prev ? { ...prev, status: "queued" } : prev));
      }
    } catch (err) {
      console.error("Pipeline resume failed:", err);
    } finally {
      setResuming(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400">
        Loading Project Details...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center text-red-400">
        Project not found or failed to load.
      </div>
    );
  }

  const isCompleted = project.status === "completed";
  const isFailed = project.status === "failed";
  const isGenerating = project.status === "generating" || project.status === "queued";

  const videoDownloadUrl = `/api/v1/storage/projects/${project.id}/composition.mp4?download=true`;
  const subtitlesDownloadUrl = `/api/v1/storage/projects/${project.id}/subtitles.srt?download=true`;
  const checkpointDownloadUrl = `/api/v1/storage/projects/${project.id}/revisions/v1/checkpoint_03_script.json?download=true`;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 text-gray-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-800 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Film className="w-7 h-7 text-indigo-400" /> {project.title}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1 border ${
                isCompleted
                  ? "bg-emerald-950/70 text-emerald-300 border-emerald-800"
                  : isFailed
                  ? "bg-red-950/70 text-red-300 border-red-800"
                  : "bg-indigo-950/70 text-indigo-300 border-indigo-800 animate-pulse"
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : isFailed ? (
                <AlertTriangle className="w-3.5 h-3.5" />
              ) : (
                <Clock className="w-3.5 h-3.5" />
              )}
              {project.status}
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">Topic: "{project.topic}"</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/projects/${project.id}/timeline`}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm font-medium rounded-lg flex items-center gap-2 transition text-white"
          >
            <Sparkles className="w-4 h-4" /> Timeline Studio
          </Link>
          <button
            onClick={() => fetchProject()}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium rounded-lg flex items-center gap-2 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Failure Diagnostic Alert & Resume Button */}
      {isFailed && (
        <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-red-300 font-semibold text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" /> Execution Interrupted
            </h3>
            <p className="text-xs text-red-200/80">
              Pipeline encountered an error during generation. Disk stage checkpoints are saved.
            </p>
          </div>
          <button
            onClick={handleResumePipeline}
            disabled={resuming}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition disabled:opacity-50 shrink-0"
          >
            <RotateCcw className="w-4 h-4" /> Resume Pipeline ($0.00 Cached Cost)
          </button>
        </div>
      )}

      {/* Main Preview Player & Details grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Video Player */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden aspect-video flex items-center justify-center relative shadow-2xl">
            {isCompleted ? (
              <video
                src={`/api/v1/storage/projects/${project.id}/composition.mp4`}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center space-y-3 p-6">
                <div className="w-16 h-16 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-full flex items-center justify-center mx-auto">
                  <Play className="w-8 h-8 ml-1" />
                </div>
                <p className="text-gray-400 text-sm">
                  {isGenerating
                    ? "Generating Video Pipeline..."
                    : "Video Composition Ready upon Completion"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Export & Download Actions Card */}
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-white text-base flex items-center gap-2 border-b border-gray-800 pb-3">
              <Download className="w-5 h-5 text-indigo-400" /> Export & Assets
            </h3>

            <div className="space-y-2.5">
              <a
                href={videoDownloadUrl}
                download
                className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-medium flex items-center justify-between text-gray-100 transition"
              >
                <span className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-indigo-400" /> Final MP4 Video
                </span>
                <Download className="w-3.5 h-3.5 text-gray-400" />
              </a>

              <a
                href={subtitlesDownloadUrl}
                download
                className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-medium flex items-center justify-between text-gray-100 transition"
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" /> Subtitles (.srt)
                </span>
                <Download className="w-3.5 h-3.5 text-gray-400" />
              </a>

              <a
                href={checkpointDownloadUrl}
                download
                className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-medium flex items-center justify-between text-gray-100 transition"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Script Checkpoint (.json)
                </span>
                <Download className="w-3.5 h-3.5 text-gray-400" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
