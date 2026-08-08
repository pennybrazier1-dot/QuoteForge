import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ProposalMessageDirection,
  ProposalMessageKind,
} from "@/lib/proposals/customer-portal/message-kinds";

export type ProposalCustomerMessage = {
  id: string;
  kind: ProposalMessageKind;
  direction: ProposalMessageDirection;
  body: string;
  created_at: string;
  created_by: string | null;
};

function mapMessageRows(
  data: ProposalCustomerMessage[] | null
): ProposalCustomerMessage[] {
  return (data ?? []).map((row) => ({
    ...row,
    direction:
      row.direction ??
      (row.kind === "trader_reply" ? "trader" : "customer"),
    created_by: row.created_by ?? null,
  }));
}

export async function loadProposalCustomerMessages(
  supabase: SupabaseClient,
  proposalId: string
): Promise<ProposalCustomerMessage[]> {
  const { data } = await supabase
    .from("proposal_customer_messages")
    .select("id, kind, direction, body, created_at, created_by")
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: true });

  return mapMessageRows(data as ProposalCustomerMessage[] | null);
}
