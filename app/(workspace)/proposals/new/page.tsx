import type { Metadata } from "next";
import { NewProposalForm } from "@/components/proposals/new-proposal-form";

export const metadata: Metadata = {
  title: "New Proposal — QuoteForge",
  description: "Create a new proposal in QuoteForge.",
};

export default function NewProposalPage() {
  return <NewProposalForm />;
}
