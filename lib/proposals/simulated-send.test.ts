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

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

describe("simulateSendProposal", () => {
  it("calls executeSimulatedSend only and never sendProposalByEmail", async () => {
    const executeSimulatedSend = vi.fn(async () => ({
      success: true,
      simulated: true,
      message: SIMULATED_SEND_MESSAGE,
    }));

    const sendProposalByEmail = vi.fn(async () => ({
      error:
        "Email sending is not configured. Add RESEND_API_KEY to your environment.",
    }));

    vi.doMock("@/lib/env/dev-testing", () => ({
      isDevTestingEnabled: () => true,
      devTestingDisabledMessage: () => "disabled",
    }));

    vi.doMock("@/lib/proposals/simulated-send", () => ({
      executeSimulatedSend,
    }));

    vi.doMock("@/lib/email/send-proposal-email", () => ({
      sendProposalEmail: vi.fn(),
    }));

    vi.doMock("@/app/proposals/send-actions", () => ({
      sendProposalByEmail,
    }));

    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({} as never);

    const { simulateSendProposal } = await import(
      "@/app/proposals/dev-lifecycle-actions"
    );
    const formData = new FormData();

    formData.set("proposalId", "proposal-1");
    formData.set("customerEmail", "test@example.com");

    await expect(simulateSendProposal({}, formData)).rejects.toThrow(
      "REDIRECT:/proposals/proposal-1?testSent=1"
    );

    expect(executeSimulatedSend).toHaveBeenCalled();
    expect(sendProposalByEmail).not.toHaveBeenCalled();
  });
});
