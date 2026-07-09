import { PROPERTY_TYPES } from "@/lib/customer-journey/constants";
import { getTradeQuestions } from "@/lib/customer-journey/trade-questions";
import type {
  JourneyFormData,
  PropertyType,
  TradespersonInfo,
  TradeType,
} from "@/lib/customer-journey/types";
import type { EnquiryPhotoReference } from "@/lib/enquiries/photo-metadata";
import {
  formatTimelineEnquiryReceived,
  formatTimelinePhotosAdded,
} from "@/lib/enquiries/timeline-messages";
import type { StoredEnquiry } from "@/lib/enquiries/types";

function propertyTypeLabel(value: PropertyType | null): string | null {
  if (!value) {
    return null;
  }

  return PROPERTY_TYPES.find((type) => type.id === value)?.label ?? value;
}

function resolveTrade(
  formData: JourneyFormData,
  tradesperson: TradespersonInfo
): TradeType {
  return formData.trade ?? tradesperson.tradeType;
}

function buildTradeAnswers(
  formData: JourneyFormData,
  trade: TradeType
): StoredEnquiry["tradeAnswers"] {
  return getTradeQuestions(trade)
    .filter((question) => formData.tradeAnswers[question.id]?.trim())
    .map((question) => ({
      questionId: question.id,
      question: question.label,
      answer: formData.tradeAnswers[question.id].trim(),
    }));
}

function hasMeasurementValues(formData: JourneyFormData): boolean {
  if (formData.knowsMeasurements !== "yes") {
    return false;
  }

  return formData.measurements.some((field) => field.value.trim().length > 0);
}

export function buildEnquiryFromJourney(
  formData: JourneyFormData,
  tradesperson: TradespersonInfo,
  photos: EnquiryPhotoReference[] = []
): StoredEnquiry {
  const receivedAt = new Date().toISOString();
  const trade = resolveTrade(formData, tradesperson);
  const serviceRequested =
    formData.selectedService?.trim() ||
    tradesperson.services[0] ||
    tradesperson.tradeType;

  const photoCount = photos.length || formData.photos.length;
  const timeline = [
    {
      id: crypto.randomUUID(),
      label: formatTimelineEnquiryReceived(formData.name.trim()),
      at: receivedAt,
    },
    ...(photoCount > 0
      ? [
          {
            id: crypto.randomUUID(),
            label: formatTimelinePhotosAdded(),
            at: receivedAt,
          },
        ]
      : []),
  ];

  return {
    id: crypto.randomUUID(),
    status: "new",
    receivedAt,
    customerName: formData.name.trim(),
    customerMobile: formData.mobile.trim(),
    customerEmail: formData.email.trim(),
    serviceRequested,
    addressLine1: formData.addressLine1.trim(),
    addressLine2: formData.addressLine2.trim(),
    city: formData.city.trim(),
    county: formData.county.trim(),
    postcode: formData.postcode.trim(),
    propertyType: propertyTypeLabel(formData.propertyType),
    projectDescription: formData.projectDescription.trim(),
    photoCount,
    photos,
    hasMeasurements: hasMeasurementValues(formData),
    measurements: formData.measurements.filter((field) => field.value.trim()),
    tradeAnswers: buildTradeAnswers(formData, trade),
    tradespersonBusiness: tradesperson.businessName,
    suggestedNextAction:
      "Review the customer details and project description, then decide whether to book a site visit.",
    siteVisitSlot: null,
    timeline,
  };
}
