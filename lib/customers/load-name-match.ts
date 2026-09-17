import type { createClient } from "@/lib/supabase/server";
import type { CustomerNameMatchOption } from "@/lib/customers/name-match";

const CUSTOMER_NAME_MATCH_SELECT =
  "id, name, email, phone, address_line_1, address_line_2, town, county, postcode, archived_at, anonymised_at, deletion_requested_at";

export async function loadCustomersForNameMatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string
): Promise<CustomerNameMatchOption[]> {
  const { data } = await supabase
    .from("customers")
    .select(CUSTOMER_NAME_MATCH_SELECT)
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  return (data ?? []) as CustomerNameMatchOption[];
}
