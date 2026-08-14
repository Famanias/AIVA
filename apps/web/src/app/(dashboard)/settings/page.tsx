"use client";

import React, { useState, useEffect } from "react";
import {
  Key,
  Cpu,
  Save,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Server,
  Layers,
} from "lucide-react";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingOllama, setTestingOllama] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [ollamaStatus, setOllamaStatus] = useState<{
    connected: boolean;
    models: string[];
    message: string;
  } | null>(null);

  const [form, setForm] = useState({
    llm_provider: "openai_compatible",
    llm_base_url: "",
    llm_api_key: "",
    llm_model: "",
    tts_provider: "edge_tts",
    image_provider: "sdxl",
    broll_provider: "pexels",
    elevenlabs_api_key: "",
    pexels_api_key: "",
    cloudflare_api_key: "",
    ollama_base_url: "http://localhost:11434",
    ollama_model: "llama3.2",
  });

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/settings");
      const data = await res.json();
      if (data.status === "success" && data.data) {
        setForm((prev) => ({ ...prev, ...data.data }));
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSettings();
  }, []);

  const handleFetchModels = async () => {
    setFetchingModels(true);
    try {
      const res = await fetch("/api/v1/settings/models");
      const data = await res.json();
      if (data.models) {
        setAvailableModels(data.models);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingModels(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/v1/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.status === "success") {
        setStatusMessage({
          type: "success",
          text: "Settings saved and encrypted in database!",
        });
      } else {
        setStatusMessage({
          type: "error",
          text: data.message || "Failed to save settings.",
        });
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: (err as Error).message || "An error occurred while saving.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestOllama = async () => {
    setTestingOllama(true);
    setOllamaStatus(null);

    try {
      const res = await fetch("/api/v1/settings/test-ollama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ollama_base_url: form.ollama_base_url }),
      });
      const data = await res.json();
      setOllamaStatus({
        connected: data.connected,
        models: data.models || [],
        message: data.message,
      });
    } catch (err) {
      setOllamaStatus({
        connected: false,
        models: [],
        message: (err as Error).message,
      });
    } finally {
      setTestingOllama(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400">
        <RefreshCw className="animate-spin w-8 h-8 mx-auto mb-2" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 text-gray-100">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Server className="w-8 h-8 text-indigo-400" /> System & Provider Settings
        </h1>
        <p className="text-gray-400 mt-1">
          Configure active AI models, credentials (encrypted with AES-256), and local offline inference endpoints.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 border ${
            statusMessage.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              : "bg-rose-950/40 border-rose-500/40 text-rose-300"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Active Providers Selection */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
            <Layers className="w-5 h-5 text-indigo-400" /> Active Stage Providers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                LLM Provider (Scripting & Outline)
              </label>
              <select
                name="llm_provider"
                value={form.llm_provider}
                onChange={handleChange}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="openai_compatible">OpenAI-Compatible Endpoint</option>
                <option value="ollama">Ollama (100% Offline Local Model)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                TTS Provider (Voiceover)
              </label>
              <select
                name="tts_provider"
                value={form.tts_provider}
                onChange={handleChange}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="edge_tts">EdgeTTS (Free Cloud Neural Voices)</option>
                <option value="kokoro">Kokoro-82M (Self-Hosted Local TTS)</option>
                <option value="elevenlabs">ElevenLabs (High-Quality API)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Image Generator
              </label>
              <select
                name="image_provider"
                value={form.image_provider}
                onChange={handleChange}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="sdxl">Cloudflare Workers AI (SDXL)</option>
                <option value="pexels">Pexels Stock Photos</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                B-Roll Video Provider
              </label>
              <select
                name="broll_provider"
                value={form.broll_provider}
                onChange={handleChange}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="pexels">Pexels Video API</option>
                <option value="pixabay">Pixabay Video API</option>
              </select>
            </div>
          </div>
        </section>

        {/* Unified LLM Configuration */}
        {form.llm_provider === "openai_compatible" && (
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
              <Server className="w-5 h-5 text-indigo-400" /> OpenAI-Compatible LLM Configuration
            </h2>
            
            <div className="flex flex-wrap gap-2 mb-2 items-center">
              <span className="text-sm text-gray-400">Presets:</span>
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, llm_base_url: "https://openrouter.ai/api/v1" }))}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 rounded border border-gray-700 transition"
              >
                Cloud / Direct (OpenRouter)
              </button>
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, llm_base_url: "http://localhost:20128/v1" }))}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 rounded border border-gray-700 transition"
              >
                Local Gateway (OmniRoute)
              </button>
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, llm_base_url: "http://localhost:11434/v1" }))}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 rounded border border-gray-700 transition"
              >
                Local Hardware (Ollama /v1)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Base URL
                </label>
                <input
                  type="text"
                  name="llm_base_url"
                  value={form.llm_base_url}
                  onChange={handleChange}
                  placeholder="https://openrouter.ai/api/v1"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  name="llm_api_key"
                  value={form.llm_api_key}
                  onChange={handleChange}
                  placeholder="sk-..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 font-mono text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Model ID
                </label>
                <div className="flex gap-3">
                  {availableModels.length > 0 ? (
                    <select
                      name="llm_model"
                      value={form.llm_model}
                      onChange={handleChange}
                      className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                    >
                      {availableModels.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      name="llm_model"
                      value={form.llm_model}
                      onChange={handleChange}
                      placeholder="google/gemini-flash-1.5"
                      className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                    />
                  )}
                  <button
                    type="button"
                    onClick={handleFetchModels}
                    disabled={fetchingModels || !form.llm_base_url}
                    className="px-4 py-2.5 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 rounded-lg text-sm flex items-center gap-2 transition disabled:opacity-50"
                  >
                    {fetchingModels ? <RefreshCw className="animate-spin w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                    Fetch Models
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Local AI Models (Ollama) */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-400" /> Local Offline AI Models (Ollama)
            </h2>
            <button
              type="button"
              onClick={handleTestOllama}
              disabled={testingOllama}
              className="px-3.5 py-1.5 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 rounded-lg text-sm flex items-center gap-2 transition"
            >
              {testingOllama && <RefreshCw className="animate-spin w-4 h-4" />}
              Test Connection
            </button>
          </div>

          {ollamaStatus && (
            <div
              className={`p-3.5 rounded-lg text-sm flex items-center gap-3 border ${
                ollamaStatus.connected
                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                  : "bg-amber-950/40 border-amber-500/40 text-amber-300"
              }`}
            >
              {ollamaStatus.connected ? (
                <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
              )}
              <div>
                <p className="font-medium">{ollamaStatus.message}</p>
                {ollamaStatus.models.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Available models: {ollamaStatus.models.join(", ")}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Ollama Host URL
              </label>
              <input
                type="text"
                name="ollama_base_url"
                value={form.ollama_base_url}
                onChange={handleChange}
                placeholder="http://localhost:11434"
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Target Model Name
              </label>
              <input
                type="text"
                name="ollama_model"
                value={form.ollama_model}
                onChange={handleChange}
                placeholder="llama3.2 or deepseek-r1"
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </section>

        {/* Cloud API Keys (AES-256 Encrypted) */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
            <Key className="w-5 h-5 text-indigo-400" /> Cloud API Keys (AES-256 Encrypted)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                ElevenLabs API Key
              </label>
              <input
                type="password"
                name="elevenlabs_api_key"
                value={form.elevenlabs_api_key}
                onChange={handleChange}
                placeholder="eleven_..."
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Pexels API Key
              </label>
              <input
                type="password"
                name="pexels_api_key"
                value={form.pexels_api_key}
                onChange={handleChange}
                placeholder="Pexels API Key"
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cloudflare Workers AI Account / Key
              </label>
              <input
                type="password"
                name="cloudflare_api_key"
                value={form.cloudflare_api_key}
                onChange={handleChange}
                placeholder="Cloudflare Token"
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 font-mono text-sm"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="animate-spin w-5 h-5" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
