import type { SupabaseClient } from "@supabase/supabase-js";

export type ProposalCustomerMessage = {
  id: string;
  kind: "question" | "change_request" | "accept_note";
  body: string;
  created_at: string;
};

export async function loadProposalCustomerMessages(
  supabase: SupabaseClient,
  proposalId: string
): Promise<ProposalCustomerMessage[]> {
  const { data } = await supabase
    .from("proposal_customer_messages")
    .select("id, kind, body, created_at")
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: false });

  return (data as ProposalCustomerMessage[] | null) ?? [];
}
