import { generatePublicInvoicePdfBuffer } from "@/lib/invoices/pdf/load-invoice-pdf";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const result = await generatePublicInvoicePdfBuffer(token);

  if (!result.ok) {
    return new Response(result.error, { status: result.status ?? 404 });
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
