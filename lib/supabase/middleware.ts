import { createServerClient } from "@supabase/ssr";
import {
  isPlatformAdminAllowlisted,
  resolveAuthEmail,
} from "@/lib/admin/platform-admin";
import { ensurePlatformAdminBootstrap } from "@/lib/admin/ensure-platform-admin-bootstrap";
import { decideSignedInAuthPageAccess } from "@/lib/auth/signed-in-auth-page";
import { resolvePostAuthPathForUser } from "@/lib/onboarding/status";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/more") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/proposals") ||
    pathname.startsWith("/customers") ||
    pathname.startsWith("/enquiries") ||
    pathname.startsWith("/visits") ||
    pathname.startsWith("/site-visit") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/admin");

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const email = resolveAuthEmail(user);
    const isAllowlistedAdmin = isPlatformAdminAllowlisted(email);

    // Platform admins: bootstrap FIRST, never send to trader onboarding.
    if (isAllowlistedAdmin) {
      await ensurePlatformAdminBootstrap(supabase, user);

      if (
        pathname === "/login" ||
        pathname === "/signup" ||
        pathname === "/check-email" ||
        pathname === "/forgot-password" ||
        pathname.startsWith("/onboarding")
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
      }

      return supabaseResponse;
    }

    const homePath = await resolvePostAuthPathForUser(supabase, user);
    const hasProfile = homePath !== "/onboarding";

    // Auth pages: do not treat "has a session" as "must finish onboarding".
    // Login stays Login when setup is incomplete so existing users can sign in.
    const authPageDecision = decideSignedInAuthPageAccess({
      pathname,
      homePath,
    });

    if (authPageDecision?.kind === "redirect") {
      const url = request.nextUrl.clone();
      url.pathname = authPageDecision.path;
      return NextResponse.redirect(url);
    }

    if (authPageDecision?.kind === "show_page") {
      if (authPageDecision.clearIncompleteSession) {
        await supabase.auth.signOut();
      }
      return supabaseResponse;
    }

    const needsProfile =
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/proposals") ||
      pathname.startsWith("/customers") ||
      pathname.startsWith("/enquiries") ||
      pathname.startsWith("/visits") ||
      pathname.startsWith("/site-visit") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/calendar") ||
      pathname.startsWith("/more");

    if (needsProfile && !hasProfile) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/onboarding") && hasProfile) {
      const url = request.nextUrl.clone();
      url.pathname = homePath;
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
