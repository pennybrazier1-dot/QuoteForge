export type ProposalStatusEventRecord = {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export function getSenderNameFromEventMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const senderName = metadata?.sender_name;

  if (typeof senderName === "string" && senderName.trim()) {
    return senderName.trim();
  }

  return null;
}
