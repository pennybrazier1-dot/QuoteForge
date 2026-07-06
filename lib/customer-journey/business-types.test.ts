import { describe, expect, it } from "vitest";
import {
  getBusinessServiceOptions,
  hasConfigurableServices,
  needsServiceSelection,
  resolveServiceTradeType,
} from "@/lib/customer-journey/business-services";
import {
  COMMON_BUSINESS_SERVICES,
  EXAMPLE_HANDYMAN_SERVICES,
  EXAMPLE_MULTI_TRADE_SERVICES,
  getConfiguredServices,
} from "@/lib/customer-journey/business-profile";
import {
  PLACEHOLDER_HANDYMAN,
  PLACEHOLDER_MULTI_TRADE,
  PLACEHOLDER_TRADESPERSON,
  TRADE_OPTIONS,
} from "@/lib/customer-journey/constants";
import {
  getInitialProfileIdForRequestQuoteRoute,
  getTradespersonForRequestQuoteRoute,
} from "@/lib/customer-journey/journey-routes";
import {
  createInitialState,
  getEffectiveTrade,
} from "@/lib/customer-journey/journey-state";
import { getJourneySteps } from "@/lib/customer-journey/constants";
import { getTradeQuestions } from "@/lib/customer-journey/trade-questions";
import type { TradeType, TradespersonInfo } from "@/lib/customer-journey/types";

function getJourneyStepIds(tradesperson: TradespersonInfo) {
  return getJourneySteps(tradesperson).map((step) => step.id);
}

describe("single-trade businesses", () => {
  it("does not include a service picker step", () => {
    expect(getJourneyStepIds(PLACEHOLDER_TRADESPERSON)).not.toContain("work_type");
    expect(needsServiceSelection(PLACEHOLDER_TRADESPERSON)).toBe(false);
    expect(hasConfigurableServices(PLACEHOLDER_TRADESPERSON)).toBe(false);
  });

  it("pre-selects the configured trade on load", () => {
    const state = createInitialState(PLACEHOLDER_TRADESPERSON);

    expect(state.formData.trade).toBe("plumbing");
    expect(state.formData.selectedService).toBe("Plumbing");
    expect(state.currentStepId).toBe("welcome");
  });
});

describe("multi-trade businesses", () => {
  it("includes a service picker and only configured services", () => {
    expect(getJourneyStepIds(PLACEHOLDER_MULTI_TRADE)).toContain("work_type");

    const labels = getBusinessServiceOptions(PLACEHOLDER_MULTI_TRADE).map(
      (service) => service.label
    );

    expect(labels).toEqual(EXAMPLE_MULTI_TRADE_SERVICES);
    expect(labels).not.toContain("Tiling");
    expect(labels).not.toContain("Plastering");
  });

  it("does not start with a trade until the customer selects a service", () => {
    const state = createInitialState(PLACEHOLDER_MULTI_TRADE);

    expect(state.formData.trade).toBeNull();
    expect(state.formData.selectedService).toBeNull();
  });
});

describe("handyman businesses", () => {
  it("shows every configured custom service", () => {
    expect(getJourneyStepIds(PLACEHOLDER_HANDYMAN)).toContain("work_type");

    const labels = getBusinessServiceOptions(PLACEHOLDER_HANDYMAN).map(
      (service) => service.label
    );

    expect(labels).toEqual(EXAMPLE_HANDYMAN_SERVICES);
    expect(labels).toHaveLength(EXAMPLE_HANDYMAN_SERVICES.length);
  });
});

describe("configured services only", () => {
  it("never exposes catalogue trades that are not on the profile", () => {
    const customProfile: TradespersonInfo = {
      ...PLACEHOLDER_MULTI_TRADE,
      services: ["Plumbing", "Electrical"],
    };

    const labels = getBusinessServiceOptions(customProfile).map(
      (service) => service.label
    );

    expect(labels).toEqual(["Plumbing", "Electrical"]);

    for (const catalogTrade of TRADE_OPTIONS) {
      if (!labels.includes(catalogTrade.label)) {
        expect(labels).not.toContain(catalogTrade.label);
      }
    }
  });

  it("trims empty service entries from the profile", () => {
    const profile: TradespersonInfo = {
      ...PLACEHOLDER_HANDYMAN,
      services: [" Door hanging ", "", "  ", "TV mounting"],
    };

    expect(getConfiguredServices(profile)).toEqual(["Door hanging", "TV mounting"]);
  });
});

describe("service to question template mapping", () => {
  const serviceExpectations: Array<[string, TradeType]> = [
    ["Plumbing", "plumbing"],
    ["Heating", "heating"],
    ["Electrical", "electrical"],
    ["Bathrooms", "bathroom"],
    ["Kitchens", "kitchen"],
    ["Building", "building"],
    ["Roofing", "roofing"],
    ["Landscaping", "landscaping"],
    ["Carpentry", "carpentry"],
    ["Painting & Decorating", "decorating"],
    ["Plastering", "decorating"],
    ["Tiling", "something_else"],
    ["Flooring", "carpentry"],
    ["Windows & Doors", "carpentry"],
    ["Driveways", "landscaping"],
    ["Fencing", "landscaping"],
    ["Drainage", "drainage"],
    ["Handyman / Property Maintenance", "something_else"],
    ["Door hanging", "carpentry"],
    ["Minor electrical jobs", "electrical"],
    ["Small plumbing jobs", "plumbing"],
    ["General repairs", "something_else"],
  ];

  it.each(serviceExpectations)(
    "maps %s to the %s question template",
    (serviceLabel, expectedTrade) => {
      expect(resolveServiceTradeType(serviceLabel)).toBe(expectedTrade);
      expect(getTradeQuestions(expectedTrade).length).toBeGreaterThan(0);
    }
  );

  it("loads the correct template after service selection", () => {
    const formData = {
      ...createInitialState(PLACEHOLDER_MULTI_TRADE).formData,
      selectedService: "Heating",
      trade: resolveServiceTradeType("Heating"),
    };

    const trade = getEffectiveTrade(formData, PLACEHOLDER_MULTI_TRADE);
    const questions = getTradeQuestions(trade);

    expect(trade).toBe("heating");
    expect(questions.some((question) => question.id.startsWith("heating"))).toBe(
      true
    );
  });
});

describe("common business services catalogue", () => {
  it("includes realistic trade coverage for future onboarding", () => {
    expect(COMMON_BUSINESS_SERVICES).toEqual(
      expect.arrayContaining([
        "Plumbing",
        "Heating",
        "Electrical",
        "Bathrooms",
        "Kitchens",
        "Building",
        "Roofing",
        "Landscaping",
        "Carpentry",
        "Painting & Decorating",
        "Plastering",
        "Tiling",
        "Flooring",
        "Windows & Doors",
        "Driveways",
        "Fencing",
        "Drainage",
        "Handyman / Property Maintenance",
      ])
    );
  });
});

describe("request-quote routes", () => {
  it("maps /request-quote default to single-trade", () => {
    expect(getInitialProfileIdForRequestQuoteRoute("default")).toBe("single-trade");
    expect(getTradespersonForRequestQuoteRoute("default").businessType).toBe(
      "single-trade"
    );
  });

  it("maps /request-quote/single to Smith Plumbing", () => {
    expect(getTradespersonForRequestQuoteRoute("single")).toEqual(
      PLACEHOLDER_TRADESPERSON
    );
  });

  it("maps /request-quote/multi to the multi-trade example", () => {
    expect(getTradespersonForRequestQuoteRoute("multi")).toEqual(
      PLACEHOLDER_MULTI_TRADE
    );
    expect(getTradespersonForRequestQuoteRoute("multi").services).toEqual(
      EXAMPLE_MULTI_TRADE_SERVICES
    );
  });

  it("maps /request-quote/handyman to the handyman example", () => {
    expect(getTradespersonForRequestQuoteRoute("handyman")).toEqual(
      PLACEHOLDER_HANDYMAN
    );
    expect(getTradespersonForRequestQuoteRoute("handyman").services).toEqual(
      EXAMPLE_HANDYMAN_SERVICES
    );
  });
});
