import { createClient } from "@/lib/supabase/server";
import { resolvePostAuthPathForUser } from "@/lib/onboarding/status";
import { NextResponse } from "next/server";

/**
 * Legacy PKCE callback. Prefer /auth/confirm for email verification links.
 * Kept so older emails that still point here continue to work.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const destination = await resolvePostAuthPathForUser(supabase, user);
        return NextResponse.redirect(`${origin}${destination}`);
      }
    }
  }

  return NextResponse.redirect(
    `${origin}/auth/confirm/error?reason=invalid`
  );
}
