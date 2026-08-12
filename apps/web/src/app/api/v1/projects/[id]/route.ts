import { NextRequest, NextResponse } from "next/server";
import { query } from "@aiva/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const projectRes = await query(
      "SELECT * FROM public.projects WHERE id = $1 LIMIT 1",
      [projectId]
    );

    if (projectRes.rows.length === 0) {
      return NextResponse.json(
        { status: "error", message: "Project not found" },
        { status: 404 }
      );
    }

    const project = projectRes.rows[0];

    const scenesRes = await query(
      `SELECT s.*, sv.script_segment, sv.visual_type, sv.visual_prompt
       FROM public.scenes s
       LEFT JOIN public.scene_versions sv ON s.current_version_id = sv.id
       WHERE s.project_id = $1
       ORDER BY s.sequence_number ASC`,
      [projectId]
    );

    return NextResponse.json({
      status: "success",
      data: {
        ...project,
        scenes: scenesRes.rows,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: (error as Error).message },
      { status: 500 }
    );
  }
}
