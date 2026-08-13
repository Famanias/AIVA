import { NextRequest, NextResponse } from "next/server";
import { getAppSetting, setAppSetting, query } from "@aiva/database";

const SETTINGS_KEYS = [
  "llm_provider",
  "tts_provider",
  "image_provider",
  "broll_provider",
  "gemini_api_key",
  "groq_api_key",
  "openai_api_key",
  "elevenlabs_api_key",
  "pexels_api_key",
  "cloudflare_api_key",
  "ollama_base_url",
  "ollama_model",
];

const ENCRYPTED_KEYS = [
  "gemini_api_key",
  "groq_api_key",
  "openai_api_key",
  "elevenlabs_api_key",
  "pexels_api_key",
  "cloudflare_api_key",
];

function maskApiKey(key: string | null): string {
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

const DEFAULT_SETTINGS: Record<string, string> = {
  llm_provider: "gemini",
  tts_provider: "edge_tts",
  image_provider: "sdxl",
  broll_provider: "pexels",
  ollama_base_url: "http://localhost:11434",
  ollama_model: "llama3.1:8b",
};

export async function GET() {
  try {
    const settings: Record<string, string> = {};

    for (const key of SETTINGS_KEYS) {
      const val = await getAppSetting(key);
      if (ENCRYPTED_KEYS.includes(key)) {
        settings[key] = maskApiKey(val);
        settings[`${key}_configured`] = Boolean(val && val.length > 0) ? "true" : "false";
      } else {
        settings[key] = val || DEFAULT_SETTINGS[key] || "";
      }
    }

    return NextResponse.json({ status: "success", data: settings });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    for (const key of SETTINGS_KEYS) {
      if (body[key] !== undefined) {
        const val = body[key];
        // Don't overwrite encrypted keys with masked placeholders (e.g. "sk-••••••••1234")
        if (ENCRYPTED_KEYS.includes(key) && val.includes("••••")) {
          continue;
        }
        const isEncrypted = ENCRYPTED_KEYS.includes(key);
        const category = key.includes("ollama") ? "local_ai" : isEncrypted ? "api_keys" : "providers";
        await setAppSetting(key, val, isEncrypted, category);
      }
    }

    return NextResponse.json({
      status: "success",
      message: "Settings updated successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: (error as Error).message },
      { status: 500 }
    );
  }
}
