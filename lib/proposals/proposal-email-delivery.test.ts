import { describe, expect, it, vi } from "vitest";
import {
  buildProposalEmailCopy,
  buildProposalEmailEvent,
  canResendProposalEmail,
  canResendWaitingProposal,
  canSendProposalEmail,
  completeProposalEmailDelivery,
  reminderResendSideEffects,
  resolveProposalEmailSendKind,
  shouldRecordProposalSent,
} from "@/lib/proposals/proposal-email-delivery";
describe("proposal email delivery", () => {
  it("allows resend from needs attention or waiting, not from a status change alone", () => {
    expect(canResendProposalEmail("needs_attention")).toBe(true);
    expect(canResendProposalEmail("waiting_for_customer")).toBe(true);
    expect(canResendWaitingProposal("waiting_for_customer")).toBe(true);
    expect(resolveProposalEmailSendKind("waiting_for_customer")).toBe(
      "reminder"
    );
    expect(canSendProposalEmail("ready_to_send")).toBe(true);
    expect(canSendProposalEmail("booked")).toBe(false);
  });

  it("does not treat waiting_for_customer as proof the email sent", () => {
    const failed = completeProposalEmailDelivery({
      ok: false,
      error: "Resend rejected the message.",
    });
    expect(failed.sent).toBe(false);
    expect(shouldRecordProposalSent(failed.sent)).toBe(false);
    if (!failed.sent) {
      expect(failed.error).toMatch(/Resend rejected/);
    }
  });

  it("records provider success and message id only after the provider confirms", () => {
    const success = completeProposalEmailDelivery({
      ok: true,
      messageId: "msg_123",
    });
    expect(success.sent).toBe(true);
    if (success.sent) {
      expect(success.messageId).toBe("msg_123");
      const event = buildProposalEmailEvent({
        recipientEmail: "michael@example.com",
        subject: "Your updated Reanvil proposal – Michael Carter",
        senderName: "Trader",
        messageId: success.messageId,
        portalUrl: "https://app.reanvil.com/p/token123",
        revised: true,
      });
      expect(event.eventType).toBe("emailed");
      expect(event.metadata.provider_message_id).toBe("msg_123");
      expect(event.metadata.portal_url).toMatch(/\/p\/token123/);
      expect(event.metadata.attached_pdf).toBe(true);
      expect(event.note).toMatch(/Revised proposal emailed/);
    }
  });

  it("includes a portal link and revised wording for a resend", () => {
    const copy = buildProposalEmailCopy({
      customerName: "Michael Carter",
      businessName: "Reanvil Joinery",
      portalUrl: "https://app.reanvil.com/p/abcToken",
      revised: true,
    });
    expect(copy.subject).toMatch(/updated/i);
    expect(copy.message).toContain("https://app.reanvil.com/p/abcToken");
    expect(copy.message).toMatch(/PDF/);
  });

  it("does not record a successful send when the provider omits a message id", () => {
    const result = completeProposalEmailDelivery({
      ok: true,
      messageId: "   ",
    });
    expect(result.sent).toBe(false);
    expect(shouldRecordProposalSent(result.sent)).toBe(false);
  });

  it("calls the email provider and does not record success when the provider fails", async () => {
    const { invokeProposalEmailProvider } = await import(
      "@/lib/proposals/proposal-email-delivery"
    );
    const sendEmail = vi.fn(async () => ({
      ok: false as const,
      error: "Provider unavailable.",
    }));

    const result = await invokeProposalEmailProvider(sendEmail, {
      to: "michael@example.com",
      subject: "Your updated Reanvil proposal – Michael Carter",
      message: "View & respond:\nhttps://app.reanvil.com/p/token123",
      pdfBuffer: Buffer.from("%PDF-1.4"),
      portalUrl: "https://app.reanvil.com/p/token123",
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "michael@example.com",
        ctaUrl: "https://app.reanvil.com/p/token123",
        pdfBuffer: expect.any(Buffer),
      })
    );
    expect(result.sent).toBe(false);
    expect(shouldRecordProposalSent(result.sent)).toBe(false);
  });

  it("resends the same portal link and PDF without creating new records", () => {
    const portalUrl = "https://app.reanvil.com/p/existingToken";
    const copy = buildProposalEmailCopy({
      customerName: "Michael Carter",
      businessName: "Reanvil Joinery",
      portalUrl,
      kind: "reminder",
    });
    const event = buildProposalEmailEvent({
      recipientEmail: "michael@example.com",
      subject: copy.subject,
      senderName: "Trader",
      messageId: "msg_resend_1",
      portalUrl,
      kind: "reminder",
    });
    const sideEffects = reminderResendSideEffects();

    expect(copy.message).toContain(portalUrl);
    expect(copy.message).toMatch(/PDF/);
    expect(event.note).toBe("Proposal resent");
    expect(event.metadata.provider_message_id).toBe("msg_resend_1");
    expect(event.metadata.attached_pdf).toBe(true);
    expect(event.metadata.portal_url).toBe(portalUrl);
    expect(sideEffects.nextStatus).toBe("waiting_for_customer");
    expect(sideEffects.createsProposal).toBe(false);
    expect(sideEffects.createsJob).toBe(false);
    expect(sideEffects.writesCalendar).toBe(false);
    expect(sideEffects.rotatesPortalToken).toBe(false);
    expect(sideEffects.changesProposalContent).toBe(false);
    expect(sideEffects.touchedFields).toEqual(["sent_at"]);
  });

  it("keeps Waiting for Customer after a successful reminder resend", () => {
    const success = completeProposalEmailDelivery({
      ok: true,
      messageId: "msg_ok",
    });
    expect(success.sent).toBe(true);
    expect(shouldRecordProposalSent(success.sent)).toBe(true);
    expect(reminderResendSideEffects().nextStatus).toBe("waiting_for_customer");
    expect(resolveProposalEmailSendKind("waiting_for_customer", "reminder")).toBe(
      "reminder"
    );
  });
});
