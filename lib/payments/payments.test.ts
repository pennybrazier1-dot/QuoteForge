import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPaymentReceivedEmail,
  buildPaymentRequestedEmail,
  emailContainsBankDetails,
} from "@/lib/payments/email";
import {
  buildCustomerPortalPaymentView,
  buildIssuedBankSnapshot,
  buildIssuedPaymentUrl,
  canCloseJob,
  canMarkPaymentPaid,
  canRequestPayment,
  completedJobIsAutomaticallyClosed,
  defaultPaymentDueAmount,
  enabledPaymentMethods,
  paymentRequestTimelineNote,
  readJobPaymentState,
  timelineContainsSensitiveBankDetails,
} from "@/lib/payments/job-payment";
import {
  looksLikeRawCardData,
  preparePaymentSettingsWrite,
  publicSafePaymentSettings,
} from "@/lib/payments/settings";
import type { JobPaymentState, WorkspacePaymentSettings } from "@/lib/payments/types";
import {
  buildPublicEnquiryPath,
  buildPublicEnquiryUrl,
  isUsablePublicEnquirySlug,
  publicUrlExposesPrivateData,
  qrCodeMustUsePublicEnquiryUrl,
} from "@/lib/enquiries/public-link";
import { createPublicEnquirySlug } from "@/lib/enquiries/server/types";
import { canTransitionStatus, isFullyClosedJobStatus } from "@/lib/proposals/status";
import { isConversationReplyable } from "@/lib/proposals/customer-portal/conversation-access";

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const settings = (workspaceId: string): WorkspacePaymentSettings => ({
  workspace_id: workspaceId,
  accept_bank_transfer: true,
  accept_card_link: true,
  accept_card_in_person: true,
  accept_cash: true,
  accept_other: false,
  bank_account_name: "Penny's Decorating Ltd",
  bank_sort_code: "12-34-56",
  bank_account_number: "12345678",
  bank_reference_instructions: "Use your surname",
  external_payment_url: "https://pay.example.com/abc",
  other_method_label: null,
});

const requestedPayment = (): JobPaymentState => ({
  payment_status: "requested",
  payment_requested_at: "2026-09-18T10:00:00.000Z",
  payment_due_amount: 125000,
  payment_methods_issued: ["bank_transfer"],
  paid_at: null,
  payment_method: null,
  payment_provider: null,
  payment_provider_reference: null,
  closed_at: null,
});

describe("50H.1 payments and job closure", () => {
  it("does not automatically close a completed job", () => {
    expect(completedJobIsAutomaticallyClosed()).toBe(false);
    expect(
      canCloseJob({
        jobStatus: "completed",
        paymentStatus: "not_requested",
      })
    ).toBe(false);
    expect(canTransitionStatus("completed", "closed")).toBe(true);
  });

  it("lets a completed job request payment from the accepted total", () => {
    expect(
      canRequestPayment({
        jobStatus: "completed",
        paymentStatus: "not_requested",
      })
    ).toBe(true);
    expect(defaultPaymentDueAmount(125000)).toBe(125000);
    expect(readRepo("components/jobs/completed-job-payment.tsx")).toContain(
      "Request payment"
    );
    expect(readRepo("lib/payments/actions.ts")).toContain(
      "defaultPaymentDueAmount(proposal.total_amount)"
    );
  });

  it("keeps payment settings workspace-specific and out of public enquiry", () => {
    const penny = publicSafePaymentSettings(settings("ws-penny"));
    const other = publicSafePaymentSettings(settings("ws-other"));
    expect(penny.workspace_id).toBe("ws-penny");
    expect(other.workspace_id).toBe("ws-other");
    expect(penny).not.toHaveProperty("bank_account_number");

    const publicRpc = readRepo(
      "supabase/migrations/20260725120000_enquiries_site_visits_backbone.sql"
    );
    expect(publicRpc).toContain("get_public_intake_workspace");
    expect(publicRpc).toContain("select w.business_name, w.phone, w.trade_type");
    expect(publicRpc).not.toContain("bank_account_number");
    expect(readRepo("lib/enquiries/server/public-actions.ts")).not.toContain(
      "workspace_payment_settings"
    );
  });

  it("never stores raw card data and does not fake card confirmation", () => {
    expect(looksLikeRawCardData("4111111111111111")).toBe(true);
    expect(
      preparePaymentSettingsWrite("ws-1", {
        accept_card_link: true,
        external_payment_url: "https://pay.example.com/abc",
      }).ok
    ).toBe(true);
    const types = readRepo("lib/payments/types.ts");
    expect(types).not.toContain("card_number");
    expect(types).not.toContain("cvv");
    expect(readRepo("lib/payments/actions.ts")).toContain(
      "payment_provider_reference: null"
    );
    expect(
      buildIssuedPaymentUrl(settings("ws-1"), ["card_link"])
    ).toBe("https://pay.example.com/abc");
    expect(
      canMarkPaymentPaid({
        jobStatus: "completed",
        paymentStatus: "requested",
      })
    ).toBe(true);
  });

  it("shows only issued methods and bank details in the secure portal", () => {
    const view = buildCustomerPortalPaymentView({
      jobTitle: "Bathroom renovation",
      jobStatus: "completed",
      payment: requestedPayment(),
      bank: buildIssuedBankSnapshot(settings("ws-1"), ["bank_transfer"]),
      cardUrl: null,
    });
    expect(view?.status).toBe("requested");
    expect(view?.amountLabel).toBe("£1,250.00");
    expect(view?.methodLabels).toEqual(["Bank transfer"]);
    expect(view?.bank?.accountNumber).toBe("12345678");

    const cashOnly = buildCustomerPortalPaymentView({
      jobTitle: "Bathroom renovation",
      jobStatus: "completed",
      payment: {
        ...requestedPayment(),
        payment_methods_issued: ["cash"],
      },
      bank: buildIssuedBankSnapshot(settings("ws-1"), ["bank_transfer"]),
      cardUrl: "https://pay.example.com/abc",
    });
    expect(cashOnly.bank).toBeNull();
    expect(cashOnly.cardUrl).toBeNull();
    expect(cashOnly.cash).toBe(true);
  });

  it("keeps bank details out of the payment email and links to the portal", () => {
    const email = buildPaymentRequestedEmail({
      businessName: "Penny's Decorating Ltd",
      customerName: "Emma Collins",
      jobTitle: "Bathroom renovation",
      amountLabel: "£1,250.00",
      methods: ["bank_transfer"],
      portalToken: "portal-token-example-abcdef",
    });
    expect(email.heading).toBe("Payment requested");
    expect(email.ctaLabel).toBe("View payment details");
    expect(email.ctaUrl).toContain("/p/portal-token-example-abcdef");
    expect(
      emailContainsBankDetails(email.html, {
        sortCode: "12-34-56",
        accountNumber: "12345678",
      })
    ).toBe(false);
    expect(email.html).not.toContain("12345678");
    expect(email.html).toContain("Secure customer portal");
  });

  it("marks paid with paid_at, updates portal copy, and sends confirmation", () => {
    const paid = readJobPaymentState({
      payment_status: "paid",
      payment_due_amount: 125000,
      payment_methods_issued: ["bank_transfer"],
      paid_at: "2026-09-18T12:00:00.000Z",
    });
    expect(paid.paid_at).toBe("2026-09-18T12:00:00.000Z");
    const portal = buildCustomerPortalPaymentView({
      jobTitle: "Bathroom renovation",
      jobStatus: "completed",
      payment: paid,
      bank: {
        accountName: "Penny's Decorating Ltd",
        sortCode: "12-34-56",
        accountNumber: "12345678",
        reference: null,
      },
      cardUrl: null,
    });
    expect(portal.status).toBe("paid");
    expect(portal.bank).toBeNull();
    const email = buildPaymentReceivedEmail({
      businessName: "Penny's Decorating Ltd",
      customerName: "Emma",
      jobTitle: "Bathroom renovation",
      amountLabel: "£1,250.00",
      portalToken: "portal-token-example-abcdef",
    });
    expect(email.heading).toBe("Payment received");
    expect(email.ctaLabel).toBe("View job");
    expect(readRepo("lib/payments/actions.ts")).toContain('payment_status: "paid"');
    expect(readRepo("lib/payments/actions.ts")).toContain("paid_at: now");
  });

  it("allows close only after payment is resolved and preserves history", () => {
    expect(
      canCloseJob({ jobStatus: "completed", paymentStatus: "requested" })
    ).toBe(false);
    expect(
      canCloseJob({ jobStatus: "completed", paymentStatus: "paid" })
    ).toBe(true);
    expect(
      canCloseJob({ jobStatus: "completed", paymentStatus: "waived" })
    ).toBe(true);
    expect(isFullyClosedJobStatus("closed")).toBe(true);
    expect(readRepo("lib/payments/actions.ts")).toContain('status: "closed"');
    expect(readRepo("lib/payments/actions.ts")).not.toContain(".delete(");
    expect(readRepo("app/(workspace)/closed-jobs/page.tsx")).toContain("Closed Jobs");
  });

  it("keeps conversation open until the job is fully closed", () => {
    expect(isConversationReplyable("completed")).toBe(true);
    expect(isConversationReplyable("paid")).toBe(true);
    expect(isConversationReplyable("closed")).toBe(false);
    expect(readRepo("components/proposals/customer-portal/customer-proposal-portal.tsx")).toContain(
      "Job closed"
    );
    expect(readRepo("components/proposals/customer-portal/customer-proposal-portal.tsx")).toContain(
      "canReply={view.canMessage}"
    );
  });

  it("records payment events without bank numbers", () => {
    const note = paymentRequestTimelineNote(["bank_transfer"]);
    expect(note).toBe("Payment requested (Bank transfer)");
    expect(timelineContainsSensitiveBankDetails(note)).toBe(false);
    expect(timelineContainsSensitiveBankDetails("Sort code 12-34-56")).toBe(true);
  });

  it("keeps the existing completed-jobs list and adds a QR-ready public slug", () => {
    expect(readRepo("app/(workspace)/completed-jobs/page.tsx")).toContain(
      "COMPLETED_JOB_LIST_STATUSES"
    );
    expect(readRepo("app/(workspace)/more/page.tsx")).toContain("Closed Jobs");
    const slugA = createPublicEnquirySlug();
    const slugB = createPublicEnquirySlug();
    expect(isUsablePublicEnquirySlug(slugA)).toBe(true);
    expect(slugA).not.toBe(slugB);
    const url = buildPublicEnquiryUrl(slugA);
    expect(buildPublicEnquiryPath(slugA)).toMatch(/^\/t\//);
    expect(qrCodeMustUsePublicEnquiryUrl(url)).toBe(true);
    expect(publicUrlExposesPrivateData(url)).toBe(false);
    expect(publicUrlExposesPrivateData(`/dashboard/${slugA}`)).toBe(true);
    expect(readRepo("app/t/[slug]/page.tsx")).toContain("PublicRequestQuoteApp");
    expect(enabledPaymentMethods(settings("ws-1"))).toContain("bank_transfer");
  });
});
