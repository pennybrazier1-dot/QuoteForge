"use server";

import {
  buildCheckEmailPath,
  getAuthConfirmUrl,
  isDuplicateSignupUser,
} from "@/lib/auth/email-redirect";
import { createClient } from "@/lib/supabase/server";
import { getPostAuthRedirectPath } from "@/lib/onboarding/status";
import { redirect } from "next/navigation";

export type AuthActionState = {
  error?: string;
  success?: string;
};

export async function login(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect(await getPostAuthRedirectPath());
}

export async function signup(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || !password) {
    return { error: "Name, email and password are required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const emailRedirectTo = getAuthConfirmUrl();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (isDuplicateSignupUser(data.user)) {
    return {
      error:
        "An account with this email already exists. Try signing in, or use Resend on the check-email page if you still need to verify.",
    };
  }

  // Email confirmation required — no session yet. Never send them to /login.
  if (!data.session) {
    redirect(buildCheckEmailPath(email));
  }

  // Confirm-email is off in this Supabase project — go straight into the app.
  redirect(await getPostAuthRedirectPath());
}

export type ResendVerificationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function resendSignupVerification(
  email: string
): Promise<ResendVerificationResult> {
  const trimmed = email.trim();
  if (!trimmed) {
    return { ok: false, error: "Email is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: trimmed,
    options: {
      emailRedirectTo: getAuthConfirmUrl(),
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
