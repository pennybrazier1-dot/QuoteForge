import { describe, expect, it, vi } from "vitest";
import { sendProposalToCustomer } from "@/lib/proposals/send-proposal-to-customer";

const existingToken = "existingPortalToken123";
const portalUrl = `https://app.reanvil.com/p/${existingToken}`;

const proposal = {
  id: "prop-1",
  proposal_number: "P-100",
  status: "waiting_for_customer",
  created_at: "2026-09-01T10:00:00.000Z",
  customer_id: "cust-1",
  customer_name: "Emma Carter",
  customer_email: "emma@example.com",
  customer_phone: null,
  customer_address: null,
  rough_notes: null,
  optional_extras: [],
  things_to_confirm: null,
  estimated_duration: "2 days",
  payment_terms: null,
  total_amount: 125000,
  job_summary: "Kitchen installation",
  scope_of_work: null,
  materials: [],
  labour_description: null,
  ai_optional_extras: [],
  things_to_confirm_items: [],
  planned_start_date_text: null,
  planned_start_date: "2026-09-24",
  planned_start_time: "14:30",
  title: "Kitchen installation",
};

const workspace = {
  business_name: "Carter & Sons",
  trade_type: "Kitchen fitter",
  contact_email: "hello@carter.test",
  phone: null,
  default_payment_terms: "Due on completion",
};

function createSupabase(options?: {
  updateError?: { message: string } | null;
  insertError?: { message: string } | null;
  createdCustomers?: unknown[];
  createdProposals?: unknown[];
  createdJobs?: unknown[];
}) {
  const createdCustomers = options?.createdCustomers ?? [];
  const createdProposals = options?.createdProposals ?? [];
  const createdJobs = options?.createdJobs ?? [];
  const updates: Record<string, unknown>[] = [];

  return {
    updates,
    createdCustomers,
    createdProposals,
    createdJobs,
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => {
                  if (table === "customers") {
                    return { data: { email: "emma@example.com" }, error: null };
                  }
                  if (table === "profiles") {
                    return { data: { full_name: "Trader" }, error: null };
                  }
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        update(values: Record<string, unknown>) {
          if (table === "proposals") {
            updates.push(values);
          }
          return {
            eq() {
              return Promise.resolve({
                error: options?.updateError ?? null,
              });
            },
          };
        },
        insert(values: Record<string, unknown>) {
          if (table === "customers") createdCustomers.push(values);
          if (table === "proposals") createdProposals.push(values);
          if (table === "jobs") createdJobs.push(values);
          return Promise.resolve({ error: options?.insertError ?? null });
        },
      };
    },
  };
}

vi.mock("@/lib/proposals/load-proposal-pdf", () => ({
  loadProposalPdfContext: vi.fn(),
  generateFreshProposalPdfBuffer: vi.fn(),
}));

vi.mock("@/lib/proposals/customer-portal/ensure-token", () => ({
  ensureProposalCustomerAccessToken: vi.fn(),
}));

vi.mock("@/lib/env/site-url", () => ({
  getSiteUrl: () => "https://app.reanvil.com",
}));

const { loadProposalPdfContext, generateFreshProposalPdfBuffer } = await import(
  "@/lib/proposals/load-proposal-pdf"
);
const { ensureProposalCustomerAccessToken } = await import(
  "@/lib/proposals/customer-portal/ensure-token"
);

describe("sendProposalToCustomer resend", () => {
  it("resends an existing proposal email and reuses the portal token", async () => {
    vi.mocked(loadProposalPdfContext).mockResolvedValue({
      ok: true,
      proposal,
      workspace,
      workspaceId: "ws-1",
    });
    vi.mocked(ensureProposalCustomerAccessToken).mockResolvedValue({
      ok: true,
      token: existingToken,
    });
    vi.mocked(generateFreshProposalPdfBuffer).mockResolvedValue(
      Buffer.from("%PDF-1.4")
    );
    const supabase = createSupabase();
    const sendEmail = vi.fn(async (input: { ctaUrl?: string | null }) => {
      expect(input.ctaUrl).toBe(portalUrl);
      return { ok: true as const, messageId: "msg_resend_1" };
    });

    const result = await sendProposalToCustomer(
      supabase as never,
      {
        proposalId: "prop-1",
        userId: "user-1",
        kind: "reminder",
      },
      { sendEmail }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.portalUrl).toBe(portalUrl);
      expect(result.recipient).toBe("emma@example.com");
    }
    expect(ensureProposalCustomerAccessToken).toHaveBeenCalledWith(
      supabase,
      "prop-1"
    );
    expect(supabase.createdCustomers).toHaveLength(0);
    expect(supabase.createdProposals).toHaveLength(0);
    expect(supabase.createdJobs).toHaveLength(0);
    expect(supabase.updates[0]).toEqual({ sent_at: expect.any(String) });
    expect(supabase.updates[0]).not.toHaveProperty("status");
    expect(supabase.updates[0]).not.toHaveProperty("accepted_at");
    expect(supabase.updates[0]).not.toHaveProperty("booking_confirmation");
  });

  it("does not crash the page when the email provider fails", async () => {
    vi.mocked(loadProposalPdfContext).mockResolvedValue({
      ok: true,
      proposal,
      workspace,
      workspaceId: "ws-1",
    });
    vi.mocked(ensureProposalCustomerAccessToken).mockResolvedValue({
      ok: true,
      token: existingToken,
    });
    vi.mocked(generateFreshProposalPdfBuffer).mockResolvedValue(
      Buffer.from("%PDF-1.4")
    );
    const supabase = createSupabase();
    const sendEmail = vi.fn(async () => {
      throw new Error("provider down https://app.reanvil.com/p/existingPortalToken123");
    });

    const result = await sendProposalToCustomer(
      supabase as never,
      {
        proposalId: "prop-1",
        userId: "user-1",
        kind: "reminder",
      },
      { sendEmail }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.emailSent).toBe(false);
      expect(result.error).toMatch(/try again/i);
    }
    expect(supabase.updates).toHaveLength(0);
    expect(supabase.createdCustomers).toHaveLength(0);
    expect(supabase.createdProposals).toHaveLength(0);
    expect(supabase.createdJobs).toHaveLength(0);
  });

  it("leaves existing data untouched when the provider returns a failure", async () => {
    vi.mocked(loadProposalPdfContext).mockResolvedValue({
      ok: true,
      proposal,
      workspace,
      workspaceId: "ws-1",
    });
    vi.mocked(ensureProposalCustomerAccessToken).mockResolvedValue({
      ok: true,
      token: existingToken,
    });
    vi.mocked(generateFreshProposalPdfBuffer).mockResolvedValue(
      Buffer.from("%PDF-1.4")
    );
    const supabase = createSupabase();
    const result = await sendProposalToCustomer(
      supabase as never,
      {
        proposalId: "prop-1",
        userId: "user-1",
        kind: "reminder",
      },
      {
        sendEmail: async () => ({
          ok: false,
          error: "Resend rejected the message.",
        }),
      }
    );

    expect(result.ok).toBe(false);
    expect(supabase.updates).toHaveLength(0);
    expect(supabase.createdCustomers).toHaveLength(0);
  });
});
