import { NextRequest, NextResponse } from "next/server";
import { query } from "@aiva/database";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scene_id: string }> }
) {
  try {
    const { id: projectId, scene_id: sceneId } = await params;
    const body = await request.json().catch(() => ({}));
    const { script_segment, visual_prompt } = body;

    // Optional prompt / text update before re-rendering
    if (script_segment || visual_prompt) {
      const sceneRes = await query(
        "SELECT current_version_id FROM public.scenes WHERE id = $1 AND project_id = $2",
        [sceneId, projectId]
      );
      if (sceneRes.rows.length > 0 && sceneRes.rows[0].current_version_id) {
        const versionId = sceneRes.rows[0].current_version_id;
        if (script_segment) {
          await query(
            "UPDATE public.scene_versions SET script_segment = $1 WHERE id = $2",
            [script_segment, versionId]
          );
        }
        if (visual_prompt) {
          await query(
            "UPDATE public.scene_versions SET visual_prompt = $1 WHERE id = $2",
            [visual_prompt, versionId]
          );
        }
      }
    }

    // Update scene render status to queued
    await query(
      "UPDATE public.scenes SET render_status = 'queued' WHERE id = $1 AND project_id = $2",
      [sceneId, projectId]
    );

    // Dispatch worker scene re-render request
    const workerUrl = process.env.WORKER_API_URL || "http://localhost:8000";
    let workerData: any = null;
    try {
      const workerRes = await fetch(`${workerUrl}/pipeline/rerender_scene`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trace_id: projectId,
          project_id: projectId,
          scene_id: sceneId,
          revision: 1,
        }),
      });
      if (workerRes.ok) {
        workerData = await workerRes.json();
      } else {
        console.warn(`[Rerender Route] Worker returned HTTP ${workerRes.status}`);
      }
    } catch (err: any) {
      console.warn("[Rerender Route] Warning: Worker invocation failed:", err.message);
    }

    return NextResponse.json({
      status: "success",
      message: `Scene ${sceneId} partial re-rendering processed`,
      projectId,
      sceneId,
      updatedFields: { script_segment, visual_prompt },
      worker: workerData?.data || workerData || null,
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: (error as Error).message },
      { status: 500 }
    );
  }
}
