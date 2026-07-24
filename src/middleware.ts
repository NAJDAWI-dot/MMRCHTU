import { NextResponse, type NextRequest } from "next/server";

// Edge-compatible fast path: verifies the session cookie's HMAC signature
// (no DB access on Edge) and redirects obviously-unauthenticated requests to
// login. The real authorization boundary is requireAdmin()/requireAdminApi()
// in src/lib/auth.ts, which additionally confirms the AdminUser still exists.
async function verifySignatureEdge(cookieValue: string | undefined, secret: string): Promise<boolean> {
  if (!cookieValue) return false;
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = Buffer.from(sigBuffer).toString("base64url");
  return expected === signature;
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const secret = process.env.SESSION_SECRET;
  const cookieValue = request.cookies.get("mmrc_admin_session")?.value;
  const valid = secret ? await verifySignatureEdge(cookieValue, secret) : false;

  if (!valid) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
