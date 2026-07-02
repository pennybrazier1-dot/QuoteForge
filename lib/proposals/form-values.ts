export type ProposalFormValues = {
  customerName: string;
  propertyAddress: string;
  phoneNumber: string;
  emailAddress: string;
  jobDescription: string;
  optionalExtras: string;
  estimatedPrice: string;
  estimatedDuration: string;
  plannedStartDateText: string;
  plannedStartDateExact: string;
};

export const emptyProposalFormValues: ProposalFormValues = {
  customerName: "",
  propertyAddress: "",
  phoneNumber: "",
  emailAddress: "",
  jobDescription: "",
  optionalExtras: "",
  estimatedPrice: "",
  estimatedDuration: "",
  plannedStartDateText: "",
  plannedStartDateExact: "",
};
