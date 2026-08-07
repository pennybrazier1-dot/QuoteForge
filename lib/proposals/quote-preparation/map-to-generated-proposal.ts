import type { GeneratedProposal } from "@/lib/ai";
import type { ProposalFormValues } from "@/lib/proposals/form-values";
import type { QuotePreparationDraft } from "@/lib/proposals/quote-preparation/types";

export function mapQuoteDraftToFormValues(
  draft: QuotePreparationDraft
): ProposalFormValues {
  return {
    customerName: draft.customerName,
    propertyAddress: draft.propertyAddress,
    phoneNumber: draft.phoneNumber,
    emailAddress: draft.emailAddress,
    jobDescription: draft.jobDescription,
    // Additional costs are internal pricing — never optional extras.
    optionalExtras: "",
    estimatedPrice: draft.total.trim(),
    estimatedDuration: draft.estimatedDuration,
    plannedStartDateText: draft.plannedStartDateText,
    plannedStartDateExact: draft.plannedStartDateExact,
  };
}

export function mapQuoteDraftToGeneratedProposal(
  draft: QuotePreparationDraft
): GeneratedProposal {
  const labourDescription = draft.labourItems
    .map((item) => {
      const parts = [item.description.trim()];
      if (item.quantity.trim()) {
        parts.push(`Qty/time: ${item.quantity.trim()}`);
      }
      if (item.rate.trim()) {
        parts.push(`Rate: £${item.rate.trim()}`);
      }
      return parts.filter(Boolean).join(" — ");
    })
    .filter((line) => line.length > 0)
    .join("\n");

  const materials = draft.materials.map((item) =>
    item.suggested
      ? `${item.description}${item.price.trim() ? ` — £${item.price.trim()}` : ""}`
      : `${item.description}${item.price.trim() ? ` — £${item.price.trim()}` : ""}`
  );

  // Additional costs stay in internal pricing. Optional extras only when the
  // trader (or AI) explicitly marks a customer-facing optional choice.
  const optionalExtras: string[] = [];

  const thingsToConfirm = [
    ...draft.thingsToConfirm,
    ...draft.assumptions.map((item) => `Assumption: ${item}`),
  ];

  const notes = [
    draft.notesAndExclusions.trim(),
    draft.validityPeriod.trim()
      ? `Validity: ${draft.validityPeriod.trim()}`
      : "",
    draft.expectedTimescale.trim()
      ? `Expected timescale: ${draft.expectedTimescale.trim()}`
      : "",
    draft.measurementsText.trim()
      ? `Measurements:\n${draft.measurementsText.trim()}`
      : "",
    draft.siteDetails.length
      ? `Site details:\n${draft.siteDetails.join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    jobSummary: draft.scopeSummary,
    scopeOfWork: draft.scopeItems,
    materials,
    labour: labourDescription || "Labour estimate to be confirmed.",
    estimatedDuration:
      draft.estimatedDuration.trim() ||
      "Estimated duration to be confirmed after pricing.",
    thingsToConfirm: thingsToConfirm.length
      ? thingsToConfirm
      : ["Review pricing and site details before sending."],
    optionalExtras,
    paymentTerms: notes || "Payment terms to be confirmed before sending.",
    extractedCustomerName: draft.customerName,
    extractedPropertyAddress: draft.propertyAddress,
    extractedPhoneNumber: draft.phoneNumber,
    extractedEmailAddress: draft.emailAddress,
    extractedEstimatedPrice: draft.total.trim(),
    plannedStartDate: draft.plannedStartDateText,
    plannedStartDateExact: draft.plannedStartDateExact,
  };
}
