import { notFound, redirect } from "next/navigation";
import { NextResponse } from "next/server";
import {
  generateFreshProposalPdfBuffer,
  loadProposalPdfContext,
} from "@/lib/proposals/load-proposal-pdf";
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

  const loaded = await loadProposalPdfContext(supabase, id, user.id);

  if (!loaded.ok) {
    notFound();
  }

  const { proposal, workspace } = loaded;

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateFreshProposalPdfBuffer(proposal, workspace);
  } catch (error) {
    console.error("Failed to generate proposal PDF:", error);
    return NextResponse.json(
      { error: "Could not generate PDF. Please try again." },
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
