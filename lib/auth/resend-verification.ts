/** Cooldown between verification email resends (seconds). */
export const RESEND_COOLDOWN_SECONDS = 60;

export function formatResendCooldownLabel(secondsRemaining: number): string {
  if (secondsRemaining <= 0) {
    return "Resend verification email";
  }
  return `Resend in ${secondsRemaining}s`;
}

export function nextCooldownEndsAt(fromMs = Date.now()): number {
  return fromMs + RESEND_COOLDOWN_SECONDS * 1000;
}

export function secondsUntil(endsAtMs: number, nowMs = Date.now()): number {
  return Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));
}

export function resendSuccessMessage(): string {
  return "We've sent another verification email.";
}
