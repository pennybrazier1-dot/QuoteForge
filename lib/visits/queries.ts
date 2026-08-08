import type { SupabaseClient } from "@supabase/supabase-js";
import {
  VISIT_SELECT,
  type VisitRecord,
  type VisitStatus,
} from "@/lib/visits/types";

export async function listVisits(
  supabase: SupabaseClient,
  workspaceId: string,
  options?: { status?: VisitStatus | "open" }
): Promise<VisitRecord[]> {
  let query = supabase
    .from("visits")
    .select(VISIT_SELECT)
    .eq("workspace_id", workspaceId)
    .order("visit_date", { ascending: true })
    .order("visit_time", { ascending: true });

  if (options?.status === "open") {
    query = query.in("status", ["scheduled", "confirmed"]);
  } else if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data } = await query;
  return (data ?? []) as VisitRecord[];
}

export async function listVisitsForCustomer(
  supabase: SupabaseClient,
  workspaceId: string,
  customerId: string
): Promise<VisitRecord[]> {
  const { data } = await supabase
    .from("visits")
    .select(VISIT_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("customer_id", customerId)
    .order("visit_date", { ascending: false });

  return (data ?? []) as VisitRecord[];
}

export async function getVisit(
  supabase: SupabaseClient,
  workspaceId: string,
  visitId: string
): Promise<VisitRecord | null> {
  const { data } = await supabase
    .from("visits")
    .select(VISIT_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("id", visitId)
    .maybeSingle();

  return (data as VisitRecord | null) ?? null;
}

export async function listCalendarVisits(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<VisitRecord[]> {
  const { data } = await supabase
    .from("visits")
    .select(VISIT_SELECT)
    .eq("workspace_id", workspaceId)
    .in("status", ["scheduled", "confirmed", "completed"])
    .order("visit_date", { ascending: true });

  return (data ?? []) as VisitRecord[];
}
