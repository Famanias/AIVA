import { NextRequest, NextResponse } from "next/server";
import { getAppSetting } from "@aiva/database";

async function resolveModels(rawBaseUrl?: string, rawApiKey?: string) {
  let baseUrl = rawBaseUrl?.trim();
  let apiKey = rawApiKey?.trim();

  if (!baseUrl) {
    baseUrl = (await getAppSetting("llm_base_url")) || "https://openrouter.ai/api/v1";
  }

  // If apiKey is masked (e.g. "••••••••" or "sk-•••..."), read actual unmasked key from DB
  if (!apiKey || apiKey.includes("••••")) {
    apiKey = (await getAppSetting("llm_api_key")) || "";
  }

  const cleanBase = baseUrl.replace(/\/$/, "");
  
  // Construct candidate URLs
  // If baseUrl ends in /v1 (e.g. https://openrouter.ai/api/v1), primary is /models
  // If baseUrl is http://localhost:11434, primary is /v1/models
  const candidateUrls = cleanBase.endsWith("/v1")
    ? [`${cleanBase}/models`, `${cleanBase}/v1/models`]
    : [`${cleanBase}/v1/models`, `${cleanBase}/models`, `${cleanBase}/api/tags`];

  let lastError = "";

  for (const targetUrl of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const headers: Record<string, string> = {
        "Accept": "application/json",
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const res = await fetch(targetUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        lastError = `Endpoint returned HTTP ${res.status} (${res.statusText})`;
        continue;
      }

      const data = await res.json();

      // Standard OpenAI format: { data: [{ id: "model-name" }] }
      if (Array.isArray(data.data)) {
        const models = data.data
          .map((m: { id?: string; name?: string }) => m.id || m.name)
          .filter((id: string | undefined): id is string => Boolean(id));
        return {
          status: "success",
          connected: true,
          models,
          message: `Successfully connected. Found ${models.length} model(s).`,
        };
      }

      // Ollama native format: { models: [{ name: "model:tag" }] }
      if (Array.isArray(data.models)) {
        const models = data.models
          .map((m: { name?: string; id?: string }) => m.name || m.id)
          .filter((name: string | undefined): name is string => Boolean(name));
        return {
          status: "success",
          connected: true,
          models,
          message: `Successfully connected. Found ${models.length} model(s).`,
        };
      }
    } catch (err) {
      const error = err as Error;
      if (error.name === "AbortError") {
        lastError = `Connection to ${targetUrl} timed out after 6 seconds.`;
      } else {
        lastError = error.message || "Failed to connect.";
      }
    }
  }

  return {
    status: "error",
    connected: false,
    models: [],
    message: lastError || "Failed to fetch models from the configured endpoint.",
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const baseUrl = searchParams.get("baseUrl") || undefined;
  const apiKey = searchParams.get("apiKey") || undefined;
  const result = await resolveModels(baseUrl, apiKey);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await resolveModels(body.llm_base_url, body.llm_api_key);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      status: "error",
      connected: false,
      models: [],
      message: (error as Error).message || "Invalid request payload.",
    });
  }
}
