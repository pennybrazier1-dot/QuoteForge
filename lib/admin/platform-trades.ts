import { COMMON_BUSINESS_SERVICES } from "@/lib/customer-journey/business-profile";
import { resolveServiceTradeType } from "@/lib/customer-journey/business-services";
import { TRADE_OPTIONS } from "@/lib/customer-journey/constants";
import { getTradeQuestions } from "@/lib/customer-journey/trade-questions";
import type { SupportedPlatformTrade } from "@/lib/admin/types";

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getSupportedPlatformTrades(): SupportedPlatformTrade[] {
  const serviceLabels = [
    ...COMMON_BUSINESS_SERVICES,
    ...TRADE_OPTIONS.filter(
      (trade) =>
        !COMMON_BUSINESS_SERVICES.some(
          (service) => service.toLowerCase() === trade.label.toLowerCase()
        )
    ).map((trade) => trade.label),
  ];

  return serviceLabels.map((label) => {
    const templateTradeType = resolveServiceTradeType(label);
    const questions = getTradeQuestions(templateTradeType);

    return {
      id: slugify(label),
      label,
      templateTradeType,
      hasQuestionTemplate: questions.length > 0,
      questionCount: questions.length,
    };
  });
}
