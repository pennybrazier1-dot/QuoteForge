import { notFound, redirect } from "next/navigation";
import { NextResponse } from "next/server";
import {
  buildProposalPdfData,
  generateProposalPdf,
} from "@/lib/proposals/generate-proposal-pdf";
import { userHasProfile } from "@/lib/onboarding/status";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!(await userHasProfile(user.id))) {
    redirect("/onboarding");
  }

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select(
      "id, proposal_number, created_at, customer_name, customer_address, rough_notes, optional_extras, things_to_confirm, estimated_duration, payment_terms, total_amount"
    )
    .eq("id", id)
    .maybeSingle();

  if (proposalError || !proposal) {
    notFound();
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    notFound();
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("business_name, default_payment_terms")
    .eq("id", profile.workspace_id)
    .single();

  if (workspaceError || !workspace) {
    notFound();
  }

  const pdfData = buildProposalPdfData(proposal, workspace);

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateProposalPdf(pdfData);
  } catch (error) {
    console.error("Failed to generate proposal PDF:", error);
    return NextResponse.json(
      { error: "Could not generate PDF. Please try again." },
      { status: 500 }
    );
  }

  if (!pdfBuffer.length) {
    return NextResponse.json(
      { error: "Generated PDF was empty." },
      { status: 500 }
    );
  }

  const filename = `${proposal.proposal_number.replace(/\s+/g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
      "Cache-Control": "no-store",
    },
  });
}
