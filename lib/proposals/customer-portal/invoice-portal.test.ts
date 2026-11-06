import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCustomerPortalPaymentView,
  completedJobIsAutomaticallyClosed,
  customerPortalShowsPaymentInstructions,
} from "@/lib/payments/job-payment";
import type { IssuedBankDetails, JobPaymentState } from "@/lib/payments/types";
import { formatPenceAsGbp } from "@/lib/proposals/money";
import {
  approvedInvoiceFiguresUnavailable,
  customerApprovedInvoiceDownloadPath,
  customerApprovedInvoicePdfPath,
  readApprovedInvoicePortalSnapshot,
} from "@/lib/proposals/customer-portal/invoice-portal";
import { buildCustomerProposalPdfPath } from "@/lib/proposals/customer-portal/token";

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const TOKEN_A = "a".repeat(32);
const TOKEN_B = "b".repeat(32);

const bank: IssuedBankDetails = {
  accountName: "Penny's Decorating Ltd",
  sortCode: "12-34-56",
  accountNumber: "12345678",
  reference: "INV-100",
};

function payment(overrides: Partial<JobPaymentState> = {}): JobPaymentState {
  return {
    payment_status: "requested",
    payment_requested_at: "2026-09-18T10:00:00.000Z",
    payment_due_amount: 125000,
    payment_methods_issued: ["bank_transfer", "card_link"],
    paid_at: null,
    payment_method: null,
    payment_provider: null,
    payment_provider_reference: null,
    closed_at: null,
    ...overrides,
  };
}

function viewFor(input: {
  status: JobPaymentState["payment_status"];
  jobStatus?: string;
  totalPence: number;
  amountPaidPence: number;
  balanceDuePence: number;
  dueAmount?: number | null;
}) {
  return buildCustomerPortalPaymentView({
    jobTitle: "Bathroom renovation",
    jobStatus: input.jobStatus ?? "invoiced",
    payment: payment({
      payment_status: input.status,
      payment_due_amount: input.dueAmount === undefined ? 125000 : input.dueAmount,
    }),
    bank,
    cardUrl: "https://pay.example.com/abc",
    invoiceAmounts: {
      totalPence: input.totalPence,
      amountPaidPence: input.amountPaidPence,
      balanceDuePence: input.balanceDuePence,
    },
  });
}

describe("customer invoice portal", () => {
  it("shows the full outstanding balance when nothing has been paid", () => {
    const saved = readApprovedInvoicePortalSnapshot({
      status: "approved",
      total_amount: 125000,
      amount_paid: 0,
      balance_due: 125000,
    });
    const view = viewFor({
      status: "requested",
      totalPence: saved!.totalPence,
      amountPaidPence: saved!.amountPaidPence,
      balanceDuePence: saved!.balanceDuePence,
    });
    expect(view.invoiceTotalLabel).toBe("£1,250.00");
    expect(view.amountPaidLabel).toBe("£0.00");
    expect(view.balanceDueLabel).toBe("£1,250.00");
    expect(view.amountLabel).toBe("£1,250.00");
    expect(view.bank?.accountNumber).toBe("12345678");
    expect(view.cardUrl).toBe("https://pay.example.com/abc");
  });

  it("shows the saved remaining balance after a part payment", () => {
    const view = viewFor({
      status: "partially_paid",
      totalPence: 125000,
      amountPaidPence: 50000,
      balanceDuePence: 75000,
      dueAmount: 125000,
    });
    expect(view.amountLabel).toBe("£750.00");
    expect(view.amountLabel).not.toBe("£1,250.00");
    expect(view.invoiceTotalLabel).toBe("£1,250.00");
    expect(view.amountPaidLabel).toBe("£500.00");
    expect(view.balanceDueLabel).toBe("£750.00");
    expect(view.bank).not.toBeNull();
    expect(customerPortalShowsPaymentInstructions({
      status: "partially_paid",
      balanceDuePence: 75000,
    })).toBe(true);
  });

  it("uses the stored paid total after more than one instalment", () => {
    const firstInstalment = 40000;
    const secondInstalment = 35000;
    const storedPaid = firstInstalment + secondInstalment;
    const saved = readApprovedInvoicePortalSnapshot({
      status: "approved",
      total_amount: 125000,
      amount_paid: storedPaid,
      balance_due: 50000,
    });
    expect(saved?.amountPaidPence).toBe(75000);
    expect(saved?.balanceDuePence).toBe(50000);
    const view = viewFor({
      status: "partially_paid",
      totalPence: saved!.totalPence,
      amountPaidPence: saved!.amountPaidPence,
      balanceDuePence: saved!.balanceDuePence,
    });
    expect(view.amountPaidLabel).toBe(formatPenceAsGbp(storedPaid));
    expect(view.balanceDueLabel).toBe("£500.00");
    expect(view.amountLabel).toBe("£500.00");
  });

  it("does not show a balance when the saved columns do not add up", () => {
    const row = {
      status: "approved" as const,
      total_amount: 125000,
      amount_paid: 75000,
      balance_due: 40000,
    };
    expect(readApprovedInvoicePortalSnapshot(row)).toBeNull();
    expect(approvedInvoiceFiguresUnavailable(row)).toBe(true);
    const view = buildCustomerPortalPaymentView({
      jobTitle: "Bathroom renovation",
      jobStatus: "invoiced",
      payment: payment({
        payment_status: "requested",
        payment_due_amount: 125000,
      }),
      bank,
      cardUrl: "https://pay.example.com/abc",
      invoiceAmounts: {
        totalPence: 125000,
        amountPaidPence: 75000,
        balanceDuePence: 40000,
      },
    });
    expect(view.invoiceFiguresUnavailable).toBe(true);
    expect(view.amountLabel).toBeNull();
    expect(view.invoiceTotalLabel).toBeNull();
    expect(view.amountPaidLabel).toBeNull();
    expect(view.balanceDueLabel).toBeNull();
    expect(view.bank).toBeNull();
    expect(view.cardUrl).toBeNull();
    expect(view.amountLabel).not.toBe("£1,250.00");
    expect(view.amountLabel).not.toBe("£400.00");
    expect(customerApprovedInvoiceDownloadPath(TOKEN_A, row)).toBe(
      `/p/${TOKEN_A}/invoice/pdf`
    );
  });

  it("offers the invoice download when the saved balance is consistent", () => {
    const row = {
      status: "approved" as const,
      total_amount: 125000,
      amount_paid: 50000,
      balance_due: 75000,
    };
    expect(readApprovedInvoicePortalSnapshot(row)?.balanceDuePence).toBe(75000);
    expect(customerApprovedInvoiceDownloadPath(TOKEN_A, row)).toBe(
      `/p/${TOKEN_A}/invoice/pdf`
    );
  });

  it("shows the amount due without inventing bank details", () => {
    const view = buildCustomerPortalPaymentView({
      jobTitle: "Bathroom renovation",
      jobStatus: "invoiced",
      payment: payment({ payment_methods_issued: ["bank_transfer"] }),
      bank: null,
      cardUrl: null,
      invoiceAmounts: {
        totalPence: 125000,
        amountPaidPence: 0,
        balanceDuePence: 125000,
      },
    });
    expect(view.invoiceFiguresUnavailable).toBe(false);
    expect(view.amountLabel).toBe("£1,250.00");
    expect(view.bank).toBeNull();
    expect(view.cardUrl).toBeNull();
  });

  it("hides payment instructions when the invoice is fully paid", () => {
    const view = viewFor({
      status: "paid",
      jobStatus: "paid",
      totalPence: 125000,
      amountPaidPence: 125000,
      balanceDuePence: 0,
    });
    expect(view.closed).toBe(false);
    expect(view.amountLabel).toBe("£1,250.00");
    expect(view.balanceDueLabel).toBe("£0.00");
    expect(view.bank).toBeNull();
    expect(view.cardUrl).toBeNull();
    expect(view.cash).toBe(false);
    expect(completedJobIsAutomaticallyClosed()).toBe(false);
  });

  it("does not show an amount due when no payment is required", () => {
    const view = buildCustomerPortalPaymentView({
      jobTitle: "Bathroom renovation",
      jobStatus: "completed",
      payment: payment({
        payment_status: "waived",
        payment_due_amount: 125000,
      }),
      bank,
      cardUrl: "https://pay.example.com/abc",
      invoiceAmounts: {
        totalPence: 125000,
        amountPaidPence: 0,
        balanceDuePence: 125000,
      },
    });
    expect(view.status).toBe("waived");
    expect(view.amountLabel).toBeNull();
    expect(view.invoiceTotalLabel).toBeNull();
    expect(view.balanceDueLabel).toBeNull();
    expect(view.bank).toBeNull();
    expect(view.cardUrl).toBeNull();
    expect(view.closed).toBe(false);
  });

  it("marks a closed job without offering payment instructions", () => {
    const view = viewFor({
      status: "paid",
      jobStatus: "closed",
      totalPence: 125000,
      amountPaidPence: 125000,
      balanceDuePence: 0,
    });
    expect(view.closed).toBe(true);
    expect(view.bank).toBeNull();
    expect(view.balanceDueLabel).toBe("£0.00");
  });

  it("does not treat a missing part-payment balance as the original total", () => {
    const view = buildCustomerPortalPaymentView({
      jobTitle: "Bathroom renovation",
      jobStatus: "invoiced",
      payment: payment({ payment_status: "partially_paid" }),
      bank,
      cardUrl: "https://pay.example.com/abc",
      invoiceAmounts: null,
    });
    expect(view.amountLabel).toBeNull();
    expect(view.bank).toBeNull();
    expect(view.cardUrl).toBeNull();
  });

  it("offers the invoice PDF only for an approved invoice and a real token", () => {
    expect(customerApprovedInvoicePdfPath(TOKEN_A, "approved")).toBe(
      `/p/${TOKEN_A}/invoice/pdf`
    );
    expect(customerApprovedInvoicePdfPath(TOKEN_A, "draft")).toBeNull();
    expect(customerApprovedInvoicePdfPath("short-token", "approved")).toBeNull();
    expect(
      customerApprovedInvoiceDownloadPath("short-token", { status: "approved" })
    ).toBeNull();
    expect(
      customerApprovedInvoiceDownloadPath(TOKEN_A, { status: "draft" })
    ).toBeNull();
    expect(customerApprovedInvoicePdfPath(`  ${TOKEN_A}  `, "approved")).toBe(
      `/p/${TOKEN_A}/invoice/pdf`
    );
  });

  it("refuses a draft invoice snapshot", () => {
    expect(
      readApprovedInvoicePortalSnapshot({
        status: "draft",
        total_amount: 125000,
        amount_paid: 0,
        balance_due: 125000,
      })
    ).toBeNull();
    expect(readApprovedInvoicePortalSnapshot(null)).toBeNull();
  });

  it("keeps each customer on their own invoice link", () => {
    const pathA = customerApprovedInvoicePdfPath(TOKEN_A, "approved");
    const pathB = customerApprovedInvoicePdfPath(TOKEN_B, "approved");
    expect(pathA).not.toBe(pathB);
    expect(pathA).toContain(TOKEN_A);
    expect(pathB).not.toContain(TOKEN_A);

    const loader = readRepo("lib/invoices/pdf/load-invoice-pdf.ts");
    const portal = readRepo("lib/proposals/customer-portal/load-public-proposal.ts");
    expect(loader).toContain('.eq("customer_access_token", trimmed)');
    expect(loader).toContain('.eq("proposal_id", proposal.id)');
    expect(loader).toContain('.eq("workspace_id", proposal.workspace_id)');
    expect(loader).toContain('.eq("status", "approved")');
    expect(loader).toContain("trimmed.length < 16");
    expect(portal).toContain('.eq("customer_access_token", trimmed)');
    expect(portal).toContain('.eq("proposal_id", row.id)');
    expect(portal).toContain('.eq("workspace_id", row.workspace_id)');
    expect(portal).toContain('.eq("status", "approved")');
    expect(portal).toContain("trimmed.length < 16");
    expect(portal).toContain("customerApprovedInvoiceDownloadPath");
    expect(portal).not.toContain("invoiceAmounts && !invoiceFiguresUnavailable");
  });

  it("keeps the quotation download and adds the invoice download beside it", () => {
    const screen = readRepo(
      "components/proposals/customer-portal/customer-proposal-portal.tsx"
    );
    expect(buildCustomerProposalPdfPath(TOKEN_A)).toBe(`/p/${TOKEN_A}/pdf`);
    expect(screen).toContain("buildCustomerProposalPdfPath");
    expect(screen).toContain("Download quotation PDF");
    expect(screen).toContain("Download invoice PDF");
    expect(screen).toContain("approvedInvoicePdfPath");
    expect(screen).toContain("Part payment received");
    expect(screen).toContain("Invoice balance unavailable");
    expect(screen).toContain("This does not cancel the invoice.");
    expect(screen).not.toContain("Download PDF");
    expect(screen).not.toContain("credit-note");
    expect(screen).not.toContain("refund");
  });

  it("does not change the ledger, email, or job close from the portal", () => {
    const portal = readRepo("lib/proposals/customer-portal/invoice-portal.ts");
    const paymentView = readRepo("lib/payments/job-payment.ts");
    const route = readRepo("app/p/[token]/invoice/pdf/route.ts");
    expect(portal).not.toContain("record_invoice_payment");
    expect(paymentView).not.toContain('status: "closed"');
    expect(route).toContain("generatePublicInvoicePdfBuffer");
    expect(route).not.toContain("allowDraft");
  });
});
