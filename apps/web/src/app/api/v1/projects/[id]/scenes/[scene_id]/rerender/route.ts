import { NextRequest, NextResponse } from "next/server";
import { query } from "@aiva/database";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scene_id: string }> }
) {
  try {
    const { id: projectId, scene_id: sceneId } = await params;

    // Update scene render status to queued
    await query(
      "UPDATE public.scenes SET render_status = 'queued' WHERE id = $1 AND project_id = $2",
      [sceneId, projectId]
    );

    return NextResponse.json({
      status: "success",
      message: `Scene ${sceneId} queued for partial re-rendering`,
      projectId,
      sceneId,
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: (error as Error).message },
      { status: 500 }
    );
  }
}
