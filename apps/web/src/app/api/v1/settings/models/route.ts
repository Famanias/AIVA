import { NextResponse } from "next/server";
import { getAppSetting } from "@aiva/database";

export async function GET() {
  const baseUrl = await getAppSetting("llm_base_url");
  const apiKey = await getAppSetting("llm_api_key");
  if (!baseUrl) return NextResponse.json({ models: [] });
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) return NextResponse.json({ models: [] });
    const data = await res.json();
    return NextResponse.json({ models: (data.data ?? []).map((m: { id: string }) => m.id) });
  } catch {
    return NextResponse.json({ models: [] });
  }
}
