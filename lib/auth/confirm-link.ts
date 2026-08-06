import type { EmailOtpType } from "@supabase/supabase-js";

const OTP_TYPES: EmailOtpType[] = [
  "signup",
  "email",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
];

export type ConfirmLinkParams = {
  tokenHash: string | null;
  type: EmailOtpType | null;
  code: string | null;
};

export function parseConfirmLinkParams(
  searchParams: URLSearchParams
): ConfirmLinkParams {
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const type =
    rawType && OTP_TYPES.includes(rawType as EmailOtpType)
      ? (rawType as EmailOtpType)
      : null;

  return {
    tokenHash,
    type,
    code: searchParams.get("code"),
  };
}

export function confirmLinkErrorMessage(
  reason: string | null | undefined
): string {
  switch (reason) {
    case "expired":
      return "This verification link has expired. Request a new email and try again.";
    case "invalid":
      return "This verification link is invalid. Request a new email and try again.";
    case "missing":
      return "This verification link is incomplete. Open the latest email from Reanvil and use that link.";
    default:
      return "We could not verify your email. Request a new verification email and try again.";
  }
}

export function mapVerifyOtpError(message: string): "expired" | "invalid" {
  const lower = message.toLowerCase();
  if (lower.includes("expired") || lower.includes("otp_expired")) {
    return "expired";
  }
  return "invalid";
}
