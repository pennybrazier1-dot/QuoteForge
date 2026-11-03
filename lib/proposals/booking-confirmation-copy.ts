/**
 * Manual-review procedure when booking confirmation is unknown:
 * 1. Do not resend — a timeout can mean the provider already accepted the email.
 * 2. Check the provider dashboard / email history for this customer and time.
 * 3. If a provider message id is found, record it without resending.
 *    Provider acceptance is not the same as customer delivery.
 * 4. If the provider shows no message, keep the attempt blocked and ask support
 *    to review logs. Do not unlock retry from the trader UI alone.
 * Resend idempotency keys last 24 hours and are not used on this path today,
 * so a blind retry after an unknown outcome is not considered safe.
 */
export const BOOKING_CONFIRM_UNKNOWN_REVIEW_COPY =
  "This confirmation attempt is blocked pending review. A timeout can mean the email provider already accepted the send even when Reanvil has no message id. Check the provider dashboard. If you find a message id, record it below without resending. Do not retry from here — retrying could duplicate the customer email.";
