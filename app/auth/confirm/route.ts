import { NextResponse, type NextRequest } from "next/server";
import { establishSessionFromLinkParams } from "@/lib/auth/establish-session-from-link";
import { resolvePostAuthPathForUser } from "@/lib/onboarding/status";
import { createClient } from "@/lib/supabase/server";

function errorRedirect(request: NextRequest, reason: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/confirm/error";
  url.search = "";
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const result = await establishSessionFromLinkParams(
    supabase,
    request.nextUrl.searchParams
  );

  if (!result.ok) {
    return errorRedirect(request, result.reason);
  }

  // Password recovery links create a session, then the user sets a new password.
  if (result.type === "recovery") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/reset-password";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorRedirect(request, "invalid");
  }

  const destination = await resolvePostAuthPathForUser(supabase, user);
  const url = request.nextUrl.clone();
  url.pathname = destination;
  url.search = "";
  return NextResponse.redirect(url);
}
