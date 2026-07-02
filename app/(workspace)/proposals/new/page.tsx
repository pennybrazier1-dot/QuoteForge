import type { Metadata } from "next";
import { NewProposalForm } from "@/components/proposals/new-proposal-form";

export const metadata: Metadata = {
  title: "New Quote — QuoteForge",
  description: "Create a new quote in QuoteForge.",
};

export default function NewProposalPage() {
  return <NewProposalForm />;
}
