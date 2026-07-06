import type { JourneyPreviewProfileId } from "./constants";
import { JOURNEY_PREVIEW_PROFILES } from "./constants";
import type { TradespersonInfo } from "./types";

export type RequestQuoteRouteSegment = "default" | "single" | "multi" | "handyman";

export const REQUEST_QUOTE_ROUTE_PROFILE: Record<
  RequestQuoteRouteSegment,
  JourneyPreviewProfileId
> = {
  default: "single-trade",
  single: "single-trade",
  multi: "multi-trade",
  handyman: "handyman",
};

export function getTradespersonForRequestQuoteRoute(
  segment: RequestQuoteRouteSegment
): TradespersonInfo {
  const profileId = REQUEST_QUOTE_ROUTE_PROFILE[segment];
  return JOURNEY_PREVIEW_PROFILES[profileId].tradesperson;
}

export function getInitialProfileIdForRequestQuoteRoute(
  segment: RequestQuoteRouteSegment
): JourneyPreviewProfileId {
  return REQUEST_QUOTE_ROUTE_PROFILE[segment];
}
