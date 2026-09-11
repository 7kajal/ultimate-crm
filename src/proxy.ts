import { NextResponse, type NextRequest } from "next/server"

const SESSION_COOKIE = "better-auth.session_token"
const PUBLIC_PATHS = ["/login", "/pay"]

function applySecurityHeaders(res: NextResponse) {
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("X-Frame-Options", "SAMEORIGIN")
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  return res
}

export function proxy(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID()
  const { pathname, search } = request.nextUrl
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE))
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  let response: NextResponse

  if (!hasSession && !isPublic) {
    const loginUrl = new URL("/login", request.url)
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", `${pathname}${search}`)
    }
    response = NextResponse.redirect(loginUrl)
  } else {
    // Note: authenticated users visiting /login are redirected by the login
    // page itself (real session verification), not here — a presence-only
    // check here causes redirect loops with stale cookies.
    response = NextResponse.next()
  }

  // Correlation id flows to route handlers, server actions and log lines.
  response.headers.set("x-request-id", requestId)
  return applySecurityHeaders(response)
}

export const config = {
  matcher: [
    // Everything except API routes (webhooks must stay public + unthrottled),
    // Next internals and static assets.
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|css|js|json|map|woff2?|webmanifest)$).*)",
  ],
}