"use server";

import { holdConversationDate } from "@/lib/proposals/date-workflow-actions";
import type { ConfirmScheduleState } from "@/lib/proposals/schedule/confirm-schedule-action";

/**
 * Saves a provisional calendar hold. Does not create a job or confirm a date.
 */
export async function confirmCalendarHold(
  prev: ConfirmScheduleState,
  formData: FormData
): Promise<ConfirmScheduleState> {
  return holdConversationDate(prev, formData);
}
