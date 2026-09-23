import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canOfferProposalResend,
  logResendFailure,
  planProposalResend,
  redactResendLogText,
  reminderResendMustReusePortalToken,
  RESEND_FAILURE_COPY,
  RESEND_SUCCESS_COPY,
  resendKeepsTraderOnSamePage,
} from "@/lib/proposals/resend-proposal-email";
import { reminderResendSideEffects } from "@/lib/proposals/proposal-email-delivery";
import { buildProposalEmailHtml } from "@/lib/email/proposal-email-html";
import { formatSlotLabel } from "@/lib/proposals/revision/conversation-agreements";

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("proposal resend", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("offers resend only for waiting and needs-attention proposals", () => {
    expect(canOfferProposalResend("waiting_for_customer")).toBe(true);
    expect(canOfferProposalResend("needs_attention")).toBe(true);
    expect(canOfferProposalResend("ready_to_send")).toBe(false);
    expect(canOfferProposalResend("booked")).toBe(false);
    expect(canOfferProposalResend("completed")).toBe(false);
    expect(canOfferProposalResend("closed")).toBe(false);
  });

  it("keeps the trader on the same page and reuses the portal token", () => {
    const plan = planProposalResend("waiting_for_customer");
    expect(plan.allowed).toBe(true);
    expect(plan.kind).toBe("reminder");
    expect(plan.staysOnPage).toBe(true);
    expect(resendKeepsTraderOnSamePage()).toBe(true);
    expect(plan.rotatesPortalToken).toBe(false);
    expect(reminderResendMustReusePortalToken()).toBe(true);
    expect(reminderResendSideEffects().rotatesPortalToken).toBe(false);
  });

  it("does not create another customer, proposal, or job", () => {
    const plan = planProposalResend("waiting_for_customer");
    const sideEffects = reminderResendSideEffects();
    expect(plan.createsCustomer).toBe(false);
    expect(plan.createsProposal).toBe(false);
    expect(plan.createsJob).toBe(false);
    expect(plan.changesBookingState).toBe(false);
    expect(sideEffects.createsProposal).toBe(false);
    expect(sideEffects.createsJob).toBe(false);
    expect(sideEffects.writesCalendar).toBe(false);
    expect(sideEffects.touchedFields).toEqual(["sent_at"]);
  });

  it("does not change accepted, booked, or completed state on a reminder", () => {
    const sideEffects = reminderResendSideEffects();
    expect(sideEffects.nextStatus).toBe("waiting_for_customer");
    expect(sideEffects.preservedFields).toEqual(
      expect.arrayContaining([
        "status",
        "accepted_at",
        "booking_confirmation",
        "customer_access_token",
      ])
    );
  });

  it("uses the current dark transactional email shell and a secure portal CTA", () => {
    const html = buildProposalEmailHtml({
      businessName: "Carter & Sons",
      portalUrl: "https://app.reanvil.com/p/existingToken",
      title: "Kitchen installation",
    });
    expect(html).toContain("Your proposal is ready");
    expect(html).toContain("Powered by Reanvil");
    expect(html).toContain("View proposal");
    expect(html).toContain('href="https://app.reanvil.com/p/existingToken"');
    expect(html).not.toMatch(/>\s*https?:\/\/[^<]*\/p\/existingToken/);
    expect(html).toContain("color-scheme: dark");
  });

  it("never invents a date from a malformed timestamp", () => {
    expect(
      formatSlotLabel({
        dateIso: "2026-09-24T14:30:00.000Z",
        timeHm: "14:30",
      })
    ).toBe("Thursday 24 September · 14:30");
    expect(
      formatSlotLabel({
        dateIso: "not-a-date",
        timeHm: "14:30",
      })
    ).toBe("");
  });

  it("maps a provider failure to a stay-on-page retry message", () => {
    expect(RESEND_FAILURE_COPY).toBe(
      "Couldn't resend the email. Please try again."
    );
    expect(RESEND_SUCCESS_COPY).toBe("✓ Email resent");
    expect(planProposalResend("waiting_for_customer").staysOnPage).toBe(true);
  });

  it("redacts portal tokens and secrets from resend logs", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    logResendFailure(
      "Failed https://app.reanvil.com/p/superSecretToken api_key=sk_live_123 sort_code=00-00-00",
      { proposalId: "p1", status: "waiting_for_customer" }
    );
    const printed = JSON.stringify(log.mock.calls[0]);
    expect(printed).toContain("/p/[redacted]");
    expect(printed).toContain("api_key=[redacted]");
    expect(printed).toContain("sort_code=[redacted]");
    expect(printed).not.toContain("superSecretToken");
    expect(printed).not.toContain("sk_live_123");
    expect(redactResendLogText("token=abc123")).toBe("token=[redacted]");
  });

  it("does not redirect Home after resend", () => {
    const action = readRepo("app/proposals/lifecycle-actions.ts");
    const start = action.indexOf("export async function resendToCustomer");
    const nextFn = action.indexOf("\nexport async function", start + 1);
    const resendFn = action.slice(start, nextFn === -1 ? undefined : nextFn);
    expect(resendFn).toContain("return { success: true }");
    expect(resendFn).not.toContain("redirect(");
    expect(resendFn).not.toContain('redirect("/dashboard")');
    expect(resendFn).toContain("RESEND_FAILURE_COPY");
    expect(resendFn).toContain("revalidatePath(`/proposals/${proposalId}`)");
    expect(resendFn).not.toContain("revalidateAll(proposalId)");
  });
});
