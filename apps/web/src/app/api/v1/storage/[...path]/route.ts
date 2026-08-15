import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json",
  ".srt": "application/x-subrip",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  
  // Resolve storage path relative to workspace root (storage/...)
  const storageRoot = path.resolve(process.cwd(), "../../storage");
  const filePath = path.resolve(storageRoot, ...pathSegments);

  // Security check: prevent path traversal outside storage root
  if (!filePath.startsWith(storageRoot)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  const range = request.headers.get("range");

  if (range) {
    if (stat.size === 0) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": "bytes */0" },
      });
    }

    const match = range.trim().match(/^bytes=(\d*)-(\d*)$/);
    if (!match) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${stat.size}` },
      });
    }

    const [, startStr, endStr] = match;
    let start: number;
    let end: number;

    if (startStr === "" && endStr !== "") {
      // Suffix range: bytes=-500 (last 500 bytes)
      const suffix = parseInt(endStr, 10);
      if (isNaN(suffix) || suffix <= 0) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${stat.size}` },
        });
      }
      start = Math.max(0, stat.size - suffix);
      end = stat.size - 1;
    } else if (startStr !== "" && endStr === "") {
      // Open-ended range: bytes=100-
      start = parseInt(startStr, 10);
      end = stat.size - 1;
    } else if (startStr !== "" && endStr !== "") {
      // Explicit range: bytes=100-200
      start = parseInt(startStr, 10);
      end = parseInt(endStr, 10);
    } else {
      // Invalid: bytes=-
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${stat.size}` },
      });
    }

    if (isNaN(start) || isNaN(end) || start < 0 || start >= stat.size || end >= stat.size || start > end) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${stat.size}`,
        },
      });
    }

    const chunksize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });
    const stream = nodeStreamToReadable(fileStream);

    return new NextResponse(stream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize.toString(),
        "Content-Type": contentType,
      },
    });
  }

  // Full file response (200 OK)
  const isDownload = request.nextUrl.searchParams.get("download") === "true";
  const fileStream = fs.createReadStream(filePath);
  const stream = nodeStreamToReadable(fileStream);

  const headers: Record<string, string> = {
    "Content-Length": stat.size.toString(),
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
  };

  if (isDownload) {
    const filename = path.basename(filePath);
    headers["Content-Disposition"] = `attachment; filename="${filename}"`;
  }

  return new NextResponse(stream, {
    status: 200,
    headers,
  });
}

function nodeStreamToReadable(fileStream: fs.ReadStream): ReadableStream {
  return new ReadableStream({
    start(controller) {
      fileStream.on("data", (chunk) => controller.enqueue(chunk));
      fileStream.on("end", () => controller.close());
      fileStream.on("error", (err) => controller.error(err));
    },
  });
}
