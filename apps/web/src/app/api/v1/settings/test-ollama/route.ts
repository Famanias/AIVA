import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { ollama_base_url } = await request.json();
    const rawUrl = ollama_base_url || "http://localhost:11434";

    // Validate URL syntax and restrict protocol
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid protocol. Only HTTP and HTTPS are permitted.");
      }
    } catch {
      return NextResponse.json({
        status: "error",
        connected: false,
        models: [],
        message: "Invalid Ollama base URL format provided.",
      });
    }

    const baseUrl = parsedUrl.origin;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({
        status: "error",
        connected: false,
        message: `Ollama returned HTTP error status ${res.status}`,
      });
    }

    const data = await res.json();
    const models = (data.models || []).map((m: any) => m.name);

    return NextResponse.json({
      status: "success",
      connected: true,
      models,
      message: `Connected to Ollama. Found ${models.length} model(s).`,
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      connected: false,
      models: [],
      message: `Failed to connect to Ollama: ${(error as Error).message}. Make sure Ollama is running locally.`,
    });
  }
}
