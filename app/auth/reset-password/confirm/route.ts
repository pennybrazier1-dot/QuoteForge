import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { establishSessionFromLinkParams } from "@/lib/auth/establish-session-from-link";

function errorRedirect(request: NextRequest, reason: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/confirm/error";
  url.search = "";
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

/**
 * Password-recovery verification must run in a Route Handler so Supabase SSR
 * can write the auth session cookies. Server Components cannot set cookies.
 */
export async function GET(request: NextRequest) {
  const successUrl = request.nextUrl.clone();
  successUrl.pathname = "/auth/reset-password";
  successUrl.search = "";
  const successRedirect = NextResponse.redirect(successUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            successRedirect.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const result = await establishSessionFromLinkParams(
    supabase,
    request.nextUrl.searchParams
  );

  if (!result.ok) {
    return errorRedirect(request, result.reason);
  }

  // Recovery emails use type=recovery; some templates use a PKCE code instead.
  if (result.type !== "recovery" && result.type !== "code") {
    return errorRedirect(request, "invalid");
  }

  return successRedirect;
}
