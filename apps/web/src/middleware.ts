import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  // Single-user self-hosted local mode: inject default user and workspace sessions
  requestHeaders.set("x-user-id", "00000000-0000-0000-0000-000000000000");
  requestHeaders.set("x-workspace-id", "00000000-0000-0000-0000-000000000000");

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
