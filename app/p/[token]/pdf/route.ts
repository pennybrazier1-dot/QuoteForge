import { generatePublicProposalPdfBuffer } from "@/lib/proposals/customer-portal/load-public-proposal";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const result = await generatePublicProposalPdfBuffer(token);

  if (!result.ok) {
    return new Response(result.error, { status: 404 });
  }

  return new Response(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
