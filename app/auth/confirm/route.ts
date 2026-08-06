import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  mapVerifyOtpError,
  parseConfirmLinkParams,
} from "@/lib/auth/confirm-link";
import { userHasProfileForClient } from "@/lib/onboarding/status";
import { createClient } from "@/lib/supabase/server";

function errorRedirect(request: NextRequest, reason: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/confirm/error";
  url.search = "";
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

async function destinationForUser(
  request: NextRequest,
  userId: string
): Promise<URL> {
  const supabase = await createClient();
  const hasProfile = await userHasProfileForClient(supabase, userId);
  const url = request.nextUrl.clone();
  url.pathname = hasProfile ? "/dashboard" : "/onboarding";
  url.search = "";
  return url;
}

export async function GET(request: NextRequest) {
  const params = parseConfirmLinkParams(request.nextUrl.searchParams);

  const supabase = await createClient();

  // Preferred SSR email template flow: token_hash + type
  if (params.tokenHash && params.type) {
    const { error } = await supabase.auth.verifyOtp({
      type: params.type as EmailOtpType,
      token_hash: params.tokenHash,
    });

    if (error) {
      return errorRedirect(request, mapVerifyOtpError(error.message));
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorRedirect(request, "invalid");
    }

    return NextResponse.redirect(await destinationForUser(request, user.id));
  }

  // PKCE / code exchange fallback (some templates still use ?code=)
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      return errorRedirect(request, mapVerifyOtpError(error.message));
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorRedirect(request, "invalid");
    }

    return NextResponse.redirect(await destinationForUser(request, user.id));
  }

  return errorRedirect(request, "missing");
}
