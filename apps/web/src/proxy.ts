import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateSessionToken, DEFAULT_LOCAL_USER } from "./lib/auth/session";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  let userId = DEFAULT_LOCAL_USER.id;
  const token = request.cookies.get("aiva_session")?.value;
  if (token) {
    const user = validateSessionToken(token);
    if (user) {
      userId = user.id;
    }
  }

  requestHeaders.set("x-user-id", userId);
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