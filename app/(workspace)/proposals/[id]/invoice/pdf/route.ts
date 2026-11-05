import { generateTraderInvoicePdfBuffer } from "@/lib/invoices/pdf/load-invoice-pdf";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Sign in required.", { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.workspace_id) {
    return new Response("Workspace not found.", { status: 403 });
  }

  const result = await generateTraderInvoicePdfBuffer(
    supabase,
    proposalId,
    profile.workspace_id,
    { allowDraft: true }
  );

  if (!result.ok) {
    return new Response(result.error, { status: result.status ?? 404 });
  }

  return new Response(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${result.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
