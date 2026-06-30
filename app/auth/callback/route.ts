import { createClient } from "@/lib/supabase/server";
import { userHasProfileForClient } from "@/lib/onboarding/status";
import { NextResponse } from "next/server";

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
        const hasProfile = await userHasProfileForClient(supabase, user.id);
        const destination = hasProfile ? "/dashboard" : "/onboarding";
        return NextResponse.redirect(`${origin}${destination}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
