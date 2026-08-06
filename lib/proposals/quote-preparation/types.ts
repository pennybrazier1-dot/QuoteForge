export const QUOTE_PREPARATION_REVIEW_NOTICE =
  "Prepared from enquiry and site visit information — please review before sending.";

/** Calm copy for temporary browser-only drafts (not a Supabase proposal yet). */
export const QUOTE_PREPARATION_LOCAL_SAVE_HINT =
  "Saved on this device only. This draft is not yet available on other devices, and it is not a sent quote.";

export const QUOTE_PREPARATION_LOCAL_SAVE_BUTTON = "Save local draft";

export const QUOTE_PREPARATION_LOCAL_SAVE_SUCCESS =
  "Saved on this device. Continue preparing this quote — it is not online or sent yet.";

export const QUOTE_PREPARATION_VAT_HELPER =
  "Enter VAT yourself for now. These amounts stay on this device until quote saving is connected to your Reanvil proposals.";

export type QuoteLineItem = {
  id: string;
  description: string;
  quantity: string;
  rate: string;
  lineTotal: string;
};

export type QuoteMaterialItem = {
  id: string;
  description: string;
  suggested: boolean;
  price: string;
};

export type QuotePreparationDraft = {
  enquiryId: string;
  siteVisitSessionId: string | null;
  customerId: string | null;
  sourceType: "site-visit";
  reviewNotice: string;
  customerName: string;
  propertyAddress: string;
  phoneNumber: string;
  emailAddress: string;
  jobDescription: string;
  scopeSummary: string;
  scopeItems: string[];
  siteDetails: string[];
  measurementsText: string;
  materials: QuoteMaterialItem[];
  labourItems: QuoteLineItem[];
  additionalCosts: QuoteLineItem[];
  notesAndExclusions: string;
  assumptions: string[];
  thingsToConfirm: string[];
  validityPeriod: string;
  expectedTimescale: string;
  vatEnabled: boolean;
  vatRate: string;
  subtotal: string;
  vatAmount: string;
  total: string;
  estimatedDuration: string;
  plannedStartDateText: string;
  plannedStartDateExact: string;
  photoCount: number;
  siteVisitDate: string;
};

export type LocalProposalDraftRecord = {
  id: string;
  enquiryId: string;
  siteVisitSessionId: string | null;
  customerId: string | null;
  sourceType: "site-visit";
  status: "draft";
  draft: QuotePreparationDraft;
  createdAt: string;
  savedAt: string;
};

export type QuoteMissingCheck = {
  id: string;
  label: string;
};
