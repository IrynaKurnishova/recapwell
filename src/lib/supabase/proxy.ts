import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { LAST_ORG_COOKIE } from "@/lib/orgs-shared";
import { safeNextPath } from "@/lib/safe-redirect";

const PROTECTED_PREFIXES = ["/app"];
const AUTH_PAGES = ["/login"];

/**
 * Refreshes the Supabase session cookie on every request and
 * guards protected routes before they render.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl(), env.supabaseKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not put code between createServerClient and getClaims():
  // getClaims() validates the JWT and refreshes the session if needed.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (isProtected && !isSignedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return redirectWithCookies(url, response);
  }

  // Remember the last opened workspace so /app can send the user back to it.
  const orgSlug = pathname.match(/^\/app\/([a-z0-9-]+)(?:\/|$)/)?.[1];
  if (isSignedIn && orgSlug && orgSlug !== "onboarding") {
    response.cookies.set(LAST_ORG_COOKIE, orgSlug, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  if (isAuthPage && isSignedIn) {
    const url = request.nextUrl.clone();
    const target = new URL(safeNextPath(request.nextUrl.searchParams.get("next")), request.url);
    url.pathname = target.pathname;
    url.search = target.search;
    return redirectWithCookies(url, response);
  }

  return response;
}

// Keep any refreshed auth cookies when redirecting.
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
