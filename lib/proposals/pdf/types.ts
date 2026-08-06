export type ProposalPdfData = {
  businessName: string;
  tradeType: string | null;
  contactEmail: string | null;
  phone: string | null;
  website: string | null;
  proposalNumber: string;
  createdAt: string;
  customerName: string | null;
  customerAddress: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  projectSummary: string;
  scopeOfWork: string[];
  materials: string[];
  labour: string | null;
  /**
   * Friendly customer bullets for incomplete readiness items (+ remaining
   * technical confirms). Omit the PDF section when empty. Never blocks send.
   */
  thingsToConfirmBeforeWork: string[];
  optionalExtras: string;
  estimatedPrice: number;
  estimatedDuration: string;
  durationNote: string | null;
  paymentTerms: string;
};
