// TODO (milestone 5 — before launch): add rate limiting for guest form submissions.
// Proposed location: here in proxy.ts, using Vercel's @vercel/kv or a lightweight
// in-memory sliding-window check on the IP for POST requests to the RPC paths
// (/rest/v1/rpc/insert_response and /rest/v1/rpc/update_response_by_token).
// The brief requires max 30 submissions per minute per IP.
// Alternative: a Postgres function counting recent inserts from request.headers['x-forwarded-for']
// stored in a rate_limit table — simpler but adds a DB round-trip per submission.
// Decision to make at milestone 5 based on whether Vercel KV is in scope.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // Carry the incoming request so cookie mutations accumulate correctly.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write to both the request (for downstream handlers) and the response
          // (so the browser receives the refreshed session cookie).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: use getUser() not getSession(). getSession() reads the JWT from
  // the cookie without verifying it server-side; getUser() validates with Supabase
  // Auth servers and refreshes the token when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protect /dashboard/* — redirect unauthenticated users to /login?next=<path>
  if (!user && pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // If already authenticated, skip the login page and go to the intended destination
  if (user && pathname === "/login") {
    const next = request.nextUrl.searchParams.get("next") ?? "/dashboard";
    const url = request.nextUrl.clone();
    url.pathname = next;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // Run on every request except Next.js internals and static assets.
  // This is required so the session refresh (getUser call above) runs on
  // every navigation, preventing silent logouts.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
