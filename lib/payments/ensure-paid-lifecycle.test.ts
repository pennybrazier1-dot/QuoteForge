import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ensurePaidInvoiceAndJob } from "@/lib/payments/ensure-paid-lifecycle";
import { markRemainingPaymentKey } from "@/lib/payments/invoice-payment-ledger";

function createSupabase(options: {
  invoice?: Record<string, unknown> | null;
  voidCount?: number;
  rpcResult?: Record<string, unknown> | null;
  rpcError?: { message: string } | null;
  jobUpdateError?: { message: string } | null;
  proposalUpdateError?: { message: string } | null;
}) {
  const invoiceUpdates: Record<string, unknown>[] = [];
  const jobUpdates: Record<string, unknown>[] = [];
  const proposalUpdates: Record<string, unknown>[] = [];
  const rpcCalls: Record<string, unknown>[] = [];

  function invoiceSelect(_cols?: string, opts?: { count?: string; head?: boolean }) {
    // loadProposalInvoicePresence cancelled-history count
    if (opts?.head) {
      const countChain = {
        eq() {
          return countChain;
        },
        then: undefined as undefined,
      };
      return {
        eq() {
          return {
            eq() {
              return {
                eq: async () => ({
                  count: options.voidCount ?? 0,
                  error: null,
                }),
              };
            },
          };
        },
      };
    }

    // loadCurrentInvoiceForProposal / by-id refresh: eq → eq → in|eq → maybeSingle
    const terminal = {
      maybeSingle: async () => ({
        data: options.invoice ?? null,
        error: null,
      }),
      in() {
        return terminal;
      },
      eq() {
        return terminal;
      },
    };
    return {
      eq() {
        return {
          eq() {
            return terminal;
          },
        };
      },
    };
  }

  return {
    invoiceUpdates,
    jobUpdates,
    proposalUpdates,
    rpcCalls,
    from(table: string) {
      if (table === "invoices") {
        return {
          select: invoiceSelect,
          update(values: Record<string, unknown>) {
            invoiceUpdates.push(values);
            throw new Error("Direct invoice balance updates are forbidden");
          },
        };
      }
      if (table === "jobs") {
        return {
          update(values: Record<string, unknown>) {
            jobUpdates.push(values);
            return {
              eq: async () => ({
                error: options.jobUpdateError ?? null,
              }),
            };
          },
        };
      }
      if (table === "proposals") {
        return {
          update(values: Record<string, unknown>) {
            proposalUpdates.push(values);
            return {
              eq() {
                return {
                  eq() {
                    return {
                      in() {
                        return {
                          is() {
                            return {
                              select() {
                                return {
                                  maybeSingle: async () => ({
                                    data: options.proposalUpdateError
                                      ? null
                                      : {
                                          id: "prop-1",
                                          payment_status: "paid",
                                        },
                                    error: options.proposalUpdateError ?? null,
                                  }),
                                };
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
    async rpc(name: string, args: Record<string, unknown>) {
      expect(name).toBe("record_invoice_payment");
      rpcCalls.push(args);
      if (options.rpcError) {
        return { data: null, error: options.rpcError };
      }
      return { data: options.rpcResult ?? null, error: null };
    },
  };
}

describe("ensurePaidInvoiceAndJob (9I.3c Part 3)", () => {
  it("records remaining balance via ledger RPC (not direct invoice update)", async () => {
    const supabase = createSupabase({
      invoice: {
        id: "inv-1",
        workspace_id: "ws-1",
        proposal_id: "prop-1",
        customer_id: null,
        job_id: null,
        invoice_number: "INV-1",
        status: "approved",
        currency: "GBP",
        business_name: null,
        issued_address_line_1: null,
        issued_address_line_2: null,
        issued_town: null,
        issued_county: null,
        issued_postcode: null,
        issued_phone: null,
        issued_email: null,
        issued_vat_number: null,
        issued_website: null,
        issued_company_number: null,
        issued_logo_path: null,
        business_snapshot_at: null,
        customer_name: null,
        customer_email: null,
        customer_phone: null,
        customer_address: null,
        job_title: "Job",
        job_address: null,
        work_description: null,
        line_items: [],
        flags: {},
        notes: null,
        subtotal_amount: 240000,
        vat_amount: 0,
        total_amount: 240000,
        amount_paid: 60000,
        balance_due: 180000,
        agreed_total_amount: 240000,
        source_vat_amount: 0,
        adjustment_confirmed: true,
        tax_confirmed: true,
        created_by: null,
        approved_by: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        approved_at: "2026-01-01T00:00:00.000Z",
      },
      rpcResult: {
        ok: true,
        already_recorded: false,
        payment_id: "pay-1",
        amount_recorded: 180000,
        amount_paid: 240000,
        balance_due: 0,
        fully_settled: true,
        proposal_payment_status: "paid",
        job_status: "paid",
      },
    });

    const result = await ensurePaidInvoiceAndJob({
      supabase: supabase as never,
      workspaceId: "ws-1",
      proposalId: "prop-1",
      paymentMethodsIssued: ["bank_transfer"],
    });

    expect(result.invoiceSettled).toBe(true);
    expect(result.paymentRecorded).toBe(true);
    expect(result.error).toBeUndefined();
    expect(supabase.invoiceUpdates).toHaveLength(0);
    expect(supabase.rpcCalls).toEqual([
      {
        p_invoice_id: "inv-1",
        p_amount_pence: 180000,
        p_method: "bank_transfer",
        p_paid_on: expect.any(String),
        p_reference: null,
        p_note: "Marked as paid (remaining balance)",
        p_idempotency_key: markRemainingPaymentKey("inv-1"),
      },
    ]);
  });

  it("is a financial no-op when already settled (no RPC, no invented ledger)", async () => {
    const supabase = createSupabase({
      invoice: {
        id: "inv-1",
        workspace_id: "ws-1",
        proposal_id: "prop-1",
        customer_id: null,
        job_id: null,
        invoice_number: "INV-1",
        status: "approved",
        currency: "GBP",
        business_name: null,
        issued_address_line_1: null,
        issued_address_line_2: null,
        issued_town: null,
        issued_county: null,
        issued_postcode: null,
        issued_phone: null,
        issued_email: null,
        issued_vat_number: null,
        issued_website: null,
        issued_company_number: null,
        issued_logo_path: null,
        business_snapshot_at: null,
        customer_name: null,
        customer_email: null,
        customer_phone: null,
        customer_address: null,
        job_title: "Job",
        job_address: null,
        work_description: null,
        line_items: [],
        flags: {},
        notes: null,
        subtotal_amount: 45000,
        vat_amount: 0,
        total_amount: 45000,
        amount_paid: 45000,
        balance_due: 0,
        agreed_total_amount: 45000,
        source_vat_amount: 0,
        adjustment_confirmed: true,
        tax_confirmed: true,
        created_by: null,
        approved_by: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        approved_at: "2026-01-01T00:00:00.000Z",
      },
    });

    const result = await ensurePaidInvoiceAndJob({
      supabase: supabase as never,
      workspaceId: "ws-1",
      proposalId: "prop-1",
    });

    expect(result.invoiceAlreadySettled).toBe(true);
    expect(result.paymentRecorded).toBe(false);
    expect(supabase.rpcCalls).toHaveLength(0);
    expect(supabase.invoiceUpdates).toHaveLength(0);
    expect(supabase.jobUpdates).toEqual([{ status: "paid" }]);
  });

  it("still syncs job when there is no approved invoice", async () => {
    const supabase = createSupabase({ invoice: null, voidCount: 0 });
    const result = await ensurePaidInvoiceAndJob({
      supabase: supabase as never,
      workspaceId: "ws-1",
      proposalId: "prop-1",
    });
    expect(result.invoiceSettled).toBe(false);
    expect(result.jobSynced).toBe(true);
    expect(supabase.rpcCalls).toHaveLength(0);
    expect(supabase.jobUpdates).toEqual([{ status: "paid" }]);
    expect(supabase.proposalUpdates[0]).toMatchObject({
      payment_status: "paid",
    });
  });

  it("refuses mid-replace cancelled invoice plus draft (no legacy paid path)", async () => {
    const supabase = createSupabase({
      invoice: {
        id: "inv-draft",
        workspace_id: "ws-1",
        proposal_id: "prop-1",
        customer_id: null,
        job_id: null,
        invoice_number: "INV-R",
        status: "draft",
        currency: "GBP",
        business_name: null,
        issued_address_line_1: null,
        issued_address_line_2: null,
        issued_town: null,
        issued_county: null,
        issued_postcode: null,
        issued_phone: null,
        issued_email: null,
        issued_vat_number: null,
        issued_website: null,
        issued_company_number: null,
        issued_logo_path: null,
        business_snapshot_at: null,
        customer_name: null,
        customer_email: null,
        customer_phone: null,
        customer_address: null,
        job_title: "Job",
        job_address: null,
        work_description: null,
        line_items: [],
        flags: {},
        notes: null,
        subtotal_amount: 100000,
        vat_amount: 0,
        total_amount: 100000,
        amount_paid: 0,
        balance_due: 100000,
        agreed_total_amount: 100000,
        source_vat_amount: 0,
        adjustment_confirmed: false,
        tax_confirmed: false,
        created_by: null,
        approved_by: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        approved_at: null,
      },
      voidCount: 1,
    });

    const result = await ensurePaidInvoiceAndJob({
      supabase: supabase as never,
      workspaceId: "ws-1",
      proposalId: "prop-1",
    });

    expect(result.paymentRecorded).toBe(false);
    expect(result.invoiceSettled).toBe(false);
    expect(result.error).toMatch(/cancelled|Approve/i);
    expect(supabase.rpcCalls).toHaveLength(0);
    expect(supabase.proposalUpdates).toHaveLength(0);
  });

  it("never writes closed status and never updates invoice balances directly", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/payments/ensure-paid-lifecycle.ts"),
      "utf8"
    );
    expect(source).not.toContain('"closed"');
    expect(source).toContain("record_invoice_payment");
    expect(source).toContain("markRemainingPaymentKey");
    expect(source).not.toContain("amount_paid:");
    expect(source).not.toContain("balance_due:");
  });
});
