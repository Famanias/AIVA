'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Toast } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Key,
  Cpu,
  Server,
  Layers,
  Save,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface SettingsFormState {
  llm_provider: string;
  llm_base_url: string;
  llm_api_key: string;
  llm_model: string;
  tts_provider: string;
  image_provider: string;
  broll_provider: string;
  elevenlabs_api_key: string;
  pexels_api_key: string;
  cloudflare_api_key: string;
  ollama_base_url: string;
  ollama_model: string;
}

interface OllamaStatus {
  connected: boolean;
  models: string[];
  message: string;
}

interface FetchStatus {
  connected: boolean;
  message: string;
}

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

const SETTINGS_TABS = [
  { id: 'providers', label: 'Providers', icon: Layers },
  { id: 'llm', label: 'LLM Config', icon: Server },
  { id: 'ollama', label: 'Ollama', icon: Cpu },
  { id: 'api-keys', label: 'API Keys', icon: Key },
] as const;

const PRESET_URLS = [
  { label: 'Cloud / Direct (OpenRouter)', url: 'https://openrouter.ai/api/v1' },
  { label: 'Local Gateway (OmniRoute)', url: 'http://localhost:20128/v1' },
  { label: 'Local Hardware (Ollama /v1)', url: 'http://localhost:11434/v1' },
];

const FALLBACK_LLM_MODELS = [
  'google/gemini-flash-1.5',
  'google/gemini-2.0-flash',
  'anthropic/claude-3.5-sonnet',
  'meta-llama/llama-3.3-70b-instruct',
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'deepseek/deepseek-chat',
];

const FALLBACK_OLLAMA_MODELS = [
  'llama3.2',
  'llama3.1:8b',
  'deepseek-r1',
  'mistral',
  'qwen2.5:7b',
];

const defaultForm: SettingsFormState = {
  llm_provider: 'openai_compatible',
  llm_base_url: 'https://openrouter.ai/api/v1',
  llm_api_key: '',
  llm_model: 'google/gemini-flash-1.5',
  tts_provider: 'edge_tts',
  image_provider: 'sdxl',
  broll_provider: 'pexels',
  elevenlabs_api_key: '',
  pexels_api_key: '',
  cloudflare_api_key: '',
  ollama_base_url: 'http://localhost:11434',
  ollama_model: 'llama3.2',
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('providers');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SettingsFormState>(defaultForm);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [testingOllama, setTestingOllama] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>(FALLBACK_LLM_MODELS);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchModelsStatus, setFetchModelsStatus] = useState<FetchStatus | null>(null);
  const [customModelMode, setCustomModelMode] = useState(false);
  const [customOllamaModelMode, setCustomOllamaModelMode] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const handleFetchModels = async (
    targetBaseUrl?: string,
    targetApiKey?: string,
    currentModel?: string
  ) => {
    const baseUrl = targetBaseUrl !== undefined ? targetBaseUrl : form.llm_base_url;
    const apiKey = targetApiKey !== undefined ? targetApiKey : form.llm_api_key;
    const activeModel = currentModel !== undefined ? currentModel : form.llm_model;

    if (!baseUrl) return;

    setFetchingModels(true);
    setFetchModelsStatus(null);
    try {
      const res = await fetch('/api/v1/settings/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llm_base_url: baseUrl,
          llm_api_key: apiKey,
        }),
      });
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.models) && data.models.length > 0) {
        setAvailableModels(data.models);
        setFetchModelsStatus({
          connected: true,
          message: data.message || `Found ${data.models.length} model(s).`,
        });
        setCustomModelMode(false);
        setForm((prev) => {
          const modelToUse =
            activeModel && data.models.includes(activeModel)
              ? activeModel
              : prev.llm_model && data.models.includes(prev.llm_model)
              ? prev.llm_model
              : data.models[0];
          return { ...prev, llm_model: modelToUse };
        });
      } else {
        setAvailableModels((prev) => (prev.length > 0 ? prev : FALLBACK_LLM_MODELS));
        setFetchModelsStatus({
          connected: false,
          message: data.message || 'No models returned. Using standard model list.',
        });
      }
    } catch (err: any) {
      setAvailableModels((prev) => (prev.length > 0 ? prev : FALLBACK_LLM_MODELS));
      setFetchModelsStatus({
        connected: false,
        message: err.message || 'Failed to fetch models. Using standard model list.',
      });
    } finally {
      setFetchingModels(false);
    }
  };

  const handleTestOllama = async (
    targetBaseUrl?: string,
    currentModel?: string
  ) => {
    setTestingOllama(true);
    setOllamaStatus(null);

    const baseUrl =
      targetBaseUrl !== undefined
        ? targetBaseUrl
        : form.ollama_base_url || 'http://localhost:11434';
    const activeModel = currentModel !== undefined ? currentModel : form.ollama_model;

    try {
      const res = await fetch('/api/v1/settings/test-ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ollama_base_url: baseUrl }),
      });
      const data = await res.json();
      const detectedModels =
        Array.isArray(data.models) && data.models.length > 0 ? data.models : [];

      setOllamaStatus({
        connected: data.connected,
        models: detectedModels,
        message: data.message,
      });

      if (data.connected && detectedModels.length > 0) {
        setCustomOllamaModelMode(false);
        setForm((prev) => {
          const modelToUse =
            activeModel && detectedModels.includes(activeModel)
              ? activeModel
              : prev.ollama_model && detectedModels.includes(prev.ollama_model)
              ? prev.ollama_model
              : detectedModels[0];
          return { ...prev, ollama_model: modelToUse };
        });
      } else {
        setForm((prev) => ({
          ...prev,
          ollama_model: prev.ollama_model || activeModel || 'llama3.2',
        }));
      }
    } catch (err: any) {
      setOllamaStatus({
        connected: false,
        models: [],
        message: err.message,
      });
      setForm((prev) => ({
        ...prev,
        ollama_model: prev.ollama_model || activeModel || 'llama3.2',
      }));
    } finally {
      setTestingOllama(false);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/settings');
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        const fetched = { ...data.data };
        if (fetched.llm_provider && fetched.llm_provider !== 'ollama') {
          fetched.llm_provider = 'openai_compatible';
        }
        if (!fetched.llm_base_url) fetched.llm_base_url = 'https://openrouter.ai/api/v1';
        if (!fetched.llm_model) fetched.llm_model = 'google/gemini-flash-1.5';
        if (!fetched.ollama_base_url) fetched.ollama_base_url = 'http://localhost:11434';
        if (!fetched.ollama_model) fetched.ollama_model = 'llama3.2';

        setForm((prev) => ({ ...prev, ...fetched }));

        // Automatically detect models for both endpoints on mount
        handleFetchModels(fetched.llm_base_url, fetched.llm_api_key, fetched.llm_model);
        handleTestOllama(fetched.ollama_base_url, fetched.ollama_model);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setToast(null);

    const payload = {
      ...form,
      llm_base_url: form.llm_base_url || 'https://openrouter.ai/api/v1',
      llm_model:
        form.llm_model || availableModels[0] || 'google/gemini-flash-1.5',
      ollama_base_url: form.ollama_base_url || 'http://localhost:11434',
      ollama_model:
        form.ollama_model ||
        (ollamaStatus?.models && ollamaStatus.models[0]) ||
        'llama3.2',
    };

    try {
      const res = await fetch('/api/v1/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setForm(payload);
        setToast({
          type: 'success',
          message: 'Settings saved and encrypted in database!',
        });
      } else {
        setToast({
          type: 'error',
          message: data.message || 'Failed to save settings.',
        });
      }
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'An error occurred while saving.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SettingsSkeleton />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-display-md text-text-primary flex items-center gap-3">
            <Server className="w-8 h-8 text-primary" /> Settings
          </h1>
          <p className="text-body text-text-secondary mt-1">
            Configure AI models, credentials, and local inference endpoints.
          </p>
        </div>
        <Button onClick={() => handleSave()} disabled={saving} size="lg" variant="primary">
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>

      {/* Toast Feedback */}
      {toast && (
        <Toast
          type={toast.type}
          title={toast.type === 'success' ? 'Saved' : 'Error'}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto p-1.5 gap-1">
          {SETTINGS_TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="flex items-center justify-center gap-2 py-2.5 text-body-sm font-medium"
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Providers Tab */}
        <TabsContent value="providers" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" /> Active Stage Providers
              </CardTitle>
              <CardDescription>
                Select the active provider engine for each pipeline stage.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ProviderSelect
                label="LLM Provider (Scripting & Outline)"
                name="llm_provider"
                value={form.llm_provider}
                onChange={handleChange}
                options={[
                  { value: 'openai_compatible', label: 'OpenAI-Compatible Endpoint' },
                  { value: 'ollama', label: 'Ollama (100% Offline Local Model)' },
                ]}
              />
              <ProviderSelect
                label="TTS Provider (Voiceover)"
                name="tts_provider"
                value={form.tts_provider}
                onChange={handleChange}
                options={[
                  { value: 'edge_tts', label: 'EdgeTTS (Free Cloud Neural Voices)' },
                  { value: 'kokoro', label: 'Kokoro-82M (Self-Hosted Local TTS)' },
                  { value: 'elevenlabs', label: 'ElevenLabs (High-Quality API)' },
                ]}
              />
              <ProviderSelect
                label="Image Generator"
                name="image_provider"
                value={form.image_provider}
                onChange={handleChange}
                options={[
                  { value: 'sdxl', label: 'Cloudflare Workers AI (SDXL)' },
                  { value: 'pexels', label: 'Pexels Stock Photos' },
                ]}
              />
              <ProviderSelect
                label="B-Roll Video Provider"
                name="broll_provider"
                value={form.broll_provider}
                onChange={handleChange}
                options={[
                  { value: 'pexels', label: 'Pexels Video API' },
                  { value: 'pixabay', label: 'Pixabay Video API' },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* LLM Config Tab */}
        <TabsContent value="llm" className="space-y-6 mt-6">
          {form.llm_provider !== 'ollama' ? (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-primary" /> OpenAI-Compatible LLM Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure your OpenAI-compatible endpoint and discover available models.
                  </CardDescription>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleFetchModels()}
                  disabled={fetchingModels || !form.llm_base_url}
                >
                  {fetchingModels ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Fetching…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" /> Fetch Models
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {fetchModelsStatus && (
                  <Alert variant={fetchModelsStatus.connected ? 'success' : 'destructive'}>
                    <AlertDescription className="flex items-center gap-2">
                      {fetchModelsStatus.connected ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span>{fetchModelsStatus.message}</span>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Preset URLs */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-body-sm text-text-muted mr-1">Presets:</span>
                  {PRESET_URLS.map(({ label, url }) => (
                    <Button
                      key={url}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setForm((p) => ({ ...p, llm_base_url: url }));
                        setFetchModelsStatus(null);
                        handleFetchModels(url, form.llm_api_key);
                      }}
                      className="text-caption h-7 px-2.5"
                    >
                      {label}
                    </Button>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Base URL"
                    name="llm_base_url"
                    type="url"
                    placeholder="https://openrouter.ai/api/v1"
                    value={form.llm_base_url}
                    onChange={handleChange}
                    onBlur={() => handleFetchModels(form.llm_base_url, form.llm_api_key)}
                    autoComplete="off"
                  />
                  <Input
                    label="API Key"
                    name="llm_api_key"
                    type="password"
                    placeholder="sk-…"
                    value={form.llm_api_key}
                    onChange={handleChange}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="llm-model-input">Model ID</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCustomModelMode(!customModelMode)}
                      className="h-7 text-caption text-primary hover:text-red-300 p-0"
                    >
                      {customModelMode ? 'Select from list' : 'Enter custom model ID'}
                    </Button>
                  </div>
                  {!customModelMode ? (
                    <select
                      id="llm-model-input"
                      name="llm_model"
                      value={form.llm_model}
                      onChange={handleChange}
                      className="w-full h-10 px-3 rounded-lg bg-bg-input border border-border text-text-primary text-body-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    >
                      {form.llm_model &&
                        !availableModels.includes(form.llm_model) &&
                        !FALLBACK_LLM_MODELS.includes(form.llm_model) && (
                          <option value={form.llm_model}>{form.llm_model} (current)</option>
                        )}
                      {(availableModels.length > 0 ? availableModels : FALLBACK_LLM_MODELS).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id="llm-model-input"
                      name="llm_model"
                      type="text"
                      placeholder="google/gemini-flash-1.5"
                      value={form.llm_model}
                      onChange={handleChange}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-text-muted">
                Ollama is currently selected as active LLM provider. See the Ollama tab.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Ollama Tab */}
        <TabsContent value="ollama" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-primary" /> Local Offline AI Models (Ollama)
                </CardTitle>
                <CardDescription>
                  Connect to a local Ollama instance for fully offline script and outline generation.
                </CardDescription>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleTestOllama()}
                disabled={testingOllama}
              >
                {testingOllama ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Testing…
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" /> Test Connection
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {ollamaStatus && (
                <Alert variant={ollamaStatus.connected ? 'success' : 'destructive'}>
                  <AlertDescription className="flex items-center gap-2">
                    {ollamaStatus.connected ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span>{ollamaStatus.message}</span>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Ollama Host URL"
                  name="ollama_base_url"
                  type="url"
                  placeholder="http://localhost:11434"
                  value={form.ollama_base_url}
                  onChange={handleChange}
                  onBlur={() => handleTestOllama(form.ollama_base_url)}
                />
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="ollama-model-input">Detected Models</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCustomOllamaModelMode(!customOllamaModelMode)}
                      className="h-7 text-caption text-primary hover:text-red-300 p-0"
                    >
                      {customOllamaModelMode
                        ? 'Select from detected list'
                        : 'Enter custom model name'}
                    </Button>
                  </div>
                  {!customOllamaModelMode ? (
                    <select
                      id="ollama-model-input"
                      name="ollama_model"
                      value={form.ollama_model}
                      onChange={handleChange}
                      className="w-full h-10 px-3 rounded-lg bg-bg-input border border-border text-text-primary text-body-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    >
                      {form.ollama_model &&
                        ollamaStatus?.models &&
                        !ollamaStatus.models.includes(form.ollama_model) &&
                        !FALLBACK_OLLAMA_MODELS.includes(form.ollama_model) && (
                          <option value={form.ollama_model}>{form.ollama_model} (current)</option>
                        )}
                      {(ollamaStatus?.models && ollamaStatus.models.length > 0
                        ? ollamaStatus.models
                        : FALLBACK_OLLAMA_MODELS
                      ).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id="ollama-model-input"
                      name="ollama_model"
                      type="text"
                      placeholder="llama3.2 or deepseek-r1"
                      value={form.ollama_model}
                      onChange={handleChange}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" /> Cloud API Keys (AES-256 Encrypted)
              </CardTitle>
              <CardDescription>
                Credentials are encrypted at rest with AES-256 and never exposed in plaintext.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <Input
                label="ElevenLabs API Key"
                name="elevenlabs_api_key"
                type="password"
                placeholder="eleven_…"
                value={form.elevenlabs_api_key}
                onChange={handleChange}
                autoComplete="off"
                spellCheck={false}
              />
              <Input
                label="Pexels API Key"
                name="pexels_api_key"
                type="password"
                placeholder="Pexels API Key"
                value={form.pexels_api_key}
                onChange={handleChange}
                autoComplete="off"
                spellCheck={false}
              />
              <Input
                label="Cloudflare Workers AI Token"
                name="cloudflare_api_key"
                type="password"
                placeholder="Cloudflare Token"
                value={form.cloudflare_api_key}
                onChange={handleChange}
                autoComplete="off"
                spellCheck={false}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProviderSelect({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <Label htmlFor={name} className="mb-1.5 block">{label}</Label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full h-10 px-3 rounded-lg bg-bg-input border border-border text-text-primary text-body-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
