"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Play, RotateCcw, Image, Mic, Film, CheckCircle2, Sparkles, Video } from "lucide-react";

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
  const [projectTitle, setProjectTitle] = useState("Project Timeline");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [rerenderingSceneId, setRerenderingSceneId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState<{ [key: string]: string }>({});
  const [editedPrompt, setEditedPrompt] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchProjectTimeline();
  }, [projectId]);

  const fetchProjectTimeline = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/projects/${projectId}`);
      const data = await res.json();
      if (data.status === "success" && data.data) {
        setProjectTitle(data.data.title || "Project Timeline");
        const loadedScenes = data.data.scenes || [];
        setScenes(loadedScenes);
        const textMap: { [key: string]: string } = {};
        const promptMap: { [key: string]: string } = {};
        loadedScenes.forEach((s: Scene) => {
          textMap[s.id] = s.script_segment || "";
          promptMap[s.id] = s.visual_prompt || "";
        });
        setEditedText(textMap);
        setEditedPrompt(promptMap);
      }
    } catch (err) {
      console.error("Failed to load timeline:", err);
    } finally {
      setLoading(false);
    }
  };

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
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (data.status === "success") {
        setScenes((prev) =>
          prev.map((s) =>
            s.id === sceneId
              ? {
                  ...s,
                  script_segment: payload.script_segment || s.script_segment,
                  visual_prompt: payload.visual_prompt || s.visual_prompt,
                  render_status: "queued",
                }
              : s
          )
        );
        setEditingSceneId(null);
      }
    } catch (err) {
      console.error("Re-render failed:", err);
    } finally {
      setRerenderingSceneId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400">
        Loading Timeline Studio...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 text-gray-100">
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Film className="w-7 h-7 text-indigo-400" /> Timeline Studio
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">{projectTitle}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => fetchProjectTimeline()}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm font-medium rounded-lg flex items-center gap-2 transition"
          >
            Refresh Timeline
          </button>
        </div>
      </div>

      {/* Main Preview Player Placeholder */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden aspect-video max-h-[380px] flex items-center justify-center relative shadow-2xl">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-full flex items-center justify-center mx-auto">
            <Play className="w-8 h-8 ml-1" />
          </div>
          <p className="text-gray-400 text-sm">
            @remotion/player Preview Canvas
          </p>
        </div>
      </div>

      {/* Multitrack Scene Editor */}
      <div className="space-y-4">
        <h2 className="font-semibold text-lg text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" /> Scene Breakdown ({scenes.length} Scenes)
        </h2>

        <div className="space-y-3">
          {scenes.length === 0 ? (
            <div className="p-8 border border-dashed border-gray-800 rounded-xl text-center text-gray-400">
              No scenes generated yet. Execute project generation from Dashboard.
            </div>
          ) : (
            scenes.map((scene) => {
              const isEditing = editingSceneId === scene.id;
              const isReRendering = rerenderingSceneId === scene.id;

              return (
                <div
                  key={scene.id}
                  className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition flex flex-col md:flex-row gap-4 justify-between items-start"
                >
                  <div className="flex gap-3 items-start flex-1 w-full">
                    <span className="w-7 h-7 bg-indigo-950 text-indigo-300 font-bold rounded-lg text-xs flex items-center justify-center shrink-0 border border-indigo-500/30 mt-0.5">
                      #{scene.sequence_number}
                    </span>
                    <div className="space-y-2 flex-1 w-full">
                      {isEditing ? (
                        <div className="space-y-2">
                          <label className="text-xs text-indigo-300 font-semibold block">
                            Script Segment (Narration):
                          </label>
                          <textarea
                            value={editedText[scene.id] || ""}
                            onChange={(e) =>
                              setEditedText({ ...editedText, [scene.id]: e.target.value })
                            }
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                            rows={2}
                          />
                          <label className="text-xs text-indigo-300 font-semibold block">
                            Visual Prompt:
                          </label>
                          <input
                            type="text"
                            value={editedPrompt[scene.id] || ""}
                            onChange={(e) =>
                              setEditedPrompt({ ...editedPrompt, [scene.id]: e.target.value })
                            }
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-gray-200 font-medium">
                            "{scene.script_segment}"
                          </p>
                          {scene.visual_prompt && (
                            <p className="text-xs text-gray-400 italic">
                              Visual: {scene.visual_prompt}
                            </p>
                          )}
                        </>
                      )}

                      <div className="flex flex-wrap gap-2 text-xs text-gray-400 pt-1">
                        <span className="bg-gray-950 px-2 py-0.5 rounded border border-gray-800 flex items-center gap-1">
                          <Image className="w-3 h-3 text-indigo-400" /> {scene.visual_type}
                        </span>
                        <span className="bg-gray-950 px-2 py-0.5 rounded border border-gray-800 flex items-center gap-1">
                          <Mic className="w-3 h-3 text-emerald-400" /> {scene.duration || 0}s
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded border text-[11px] flex items-center gap-1 ${
                            scene.render_status === "completed"
                              ? "bg-emerald-950/50 text-emerald-300 border-emerald-800"
                              : "bg-amber-950/50 text-amber-300 border-amber-800"
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" /> Status: {scene.render_status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => setEditingSceneId(null)}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs font-medium rounded-lg text-gray-300 transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleRerenderScene(scene.id)}
                          disabled={isReRendering}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-medium rounded-lg flex items-center gap-1.5 text-white transition disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Save & Re-render
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditingSceneId(scene.id)}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs font-medium rounded-lg text-gray-300 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRerenderScene(scene.id)}
                          disabled={isReRendering}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs font-medium rounded-lg flex items-center gap-1.5 text-gray-200 transition disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-indigo-400" /> Re-render
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
