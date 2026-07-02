import { describe, expect, it, vi } from "vitest";
import { isDevTestingEnabled } from "@/lib/env/dev-testing";
import { SIMULATED_SEND_MESSAGE } from "@/lib/proposals/simulated-send-constants";

describe("simulated send routing", () => {
  it("does not import or call Resend from simulated-send module", async () => {
    const module = await import("@/lib/proposals/simulated-send");

    expect(module.executeSimulatedSend).toBeTypeOf("function");
    expect(String(module.executeSimulatedSend)).not.toContain("RESEND_API_KEY");
  });
});

describe("isDevTestingEnabled", () => {
  it("is disabled on Vercel production", () => {
    const originalVercelEnv = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "production";

    expect(isDevTestingEnabled()).toBe(false);

    process.env.VERCEL_ENV = originalVercelEnv;
  });

  it("is enabled on Vercel preview", () => {
    const originalVercelEnv = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "preview";

    expect(isDevTestingEnabled()).toBe(true);

    process.env.VERCEL_ENV = originalVercelEnv;
  });
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("handleProposalSend routing", () => {
  it("routes simulated mode to executeSimulatedSend before Resend", async () => {
    const executeSimulatedSend = vi.fn(async () => ({
      success: true,
      simulated: true,
      message: SIMULATED_SEND_MESSAGE,
    }));

    vi.doMock("@/lib/env/dev-testing", () => ({
      isDevTestingEnabled: () => true,
      devTestingDisabledMessage: () => "disabled",
    }));

    vi.doMock("@/lib/proposals/simulated-send", () => ({
      executeSimulatedSend,
    }));

    vi.doMock("@/lib/email/send-proposal-email", () => ({
      sendProposalEmail: vi.fn(async () => ({
        ok: false,
        error:
          "Email sending is not configured. Add RESEND_API_KEY to your environment.",
      })),
    }));

    const { handleProposalSend } = await import("@/app/proposals/send-actions");
    const formData = new FormData();

    formData.set("qfSendMode", "simulated");
    formData.set("proposalId", "proposal-1");
    formData.set("customerEmail", "test@example.com");

    const result = await handleProposalSend({}, formData);

    expect(executeSimulatedSend).toHaveBeenCalled();
    expect(result.simulated).toBe(true);
    expect(result.message).toBe("SIMULATED_SEND_USED");
  });
});
