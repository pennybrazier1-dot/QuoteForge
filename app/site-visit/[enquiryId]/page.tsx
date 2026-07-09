import type { Metadata } from "next";
import { SiteVisitModeView } from "@/components/site-visit/site-visit-mode-view";

export const metadata: Metadata = {
  title: "Site Visit — QuoteForge",
  description: "Collect notes, photos, and measurements during a site visit.",
};

export default async function SiteVisitPage({
  params,
}: {
  params: Promise<{ enquiryId: string }>;
}) {
  const { enquiryId } = await params;

  return <SiteVisitModeView enquiryId={enquiryId} />;
}
