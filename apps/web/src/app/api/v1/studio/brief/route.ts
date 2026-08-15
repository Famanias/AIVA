import { NextRequest, NextResponse } from "next/server";
import { getAppSetting } from "@aiva/database";

const SYSTEM_PROMPT = `You are AIVA's Lead Creative Producer and Video Director.
Your job is to collaborate with creators to develop compelling, high-retention video productions.

When the creator presents a topic or rough idea:
1. Enthusiastically validate and sharpen the hook in 1-2 concise sentences.
2. Ask 2 to 3 high-impact creative questions with suggested options to nail down:
   - **Tone & Mood** (e.g., Dramatic & Cinematic, Fast-Paced Explainer, Humorous & Punchy)
   - **Visual Direction** (e.g., Real-World HD Stock Footage, Surreal AI Imagery, Hybrid Dynamic Motion)
   - **Audience / Hook Angle** (What makes the viewer stop scrolling in the first 3 seconds?)

When the creator answers your questions or refines the concept:
- Synthesize a concise 3-bullet **Creative Production Brief** (Theme, Visual Style, Pacing).
- Confirm that the brief is dialed in and ready for the generation engine!

Keep your tone engaging, crisp, and professional. Avoid lengthy filler text. Format with markdown bolding and bullet points.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages = [], topic = "", custom_script = "" } = body;

    let baseUrl = (await getAppSetting("llm_base_url")) || "http://localhost:20128/v1";
    let apiKey = (await getAppSetting("llm_api_key")) || "";
    let model = (await getAppSetting("llm_model")) || "auto/best-free";

    const isLocal = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1") || baseUrl.includes("::1");
    const effectiveKey = apiKey || (isLocal ? "local" : "");

    const cleanBase = baseUrl.replace(/\/$/, "");
    const endpoint = cleanBase.endsWith("/v1") ? `${cleanBase}/chat/completions` : `${cleanBase}/v1/chat/completions`;

    // Construct conversation payload
    const formattedMessages = [
      { role: "system", content: SYSTEM_PROMPT }
    ];

    if (topic && (!messages || messages.length === 0)) {
      formattedMessages.push({
        role: "user",
        content: `I want to create a video about: "${topic}". What creative direction and angle do you suggest?`
      });
    } else if (custom_script && (!messages || messages.length === 0)) {
      formattedMessages.push({
        role: "user",
        content: `Here is my script:\n\n"${custom_script}"\n\nHow should we direct the visuals and pacing?`
      });
    } else if (Array.isArray(messages)) {
      for (const m of messages) {
        if (m.role && m.content) {
          formattedMessages.push({ role: m.role, content: m.content });
        }
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
    if (effectiveKey) {
      headers["Authorization"] = `Bearer ${effectiveKey}`;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 600
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LLM Error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "Let's bring this concept to life! What visual tone would you prefer?";

    return NextResponse.json({
      status: "success",
      reply
    });
  } catch (error: any) {
    console.error("[StudioBriefRoute] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error.message || "Failed to generate studio briefing."
      },
      { status: 500 }
    );
  }
}
