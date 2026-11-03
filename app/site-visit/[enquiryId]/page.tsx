import type { Metadata } from "next";
import { SiteVisitModeView } from "@/components/site-visit/site-visit-mode-view";

export const metadata: Metadata = {
  title: "Site Visit",
  description: "Collect notes, photos, and measurements during a site visit.",
};

export default async function SiteVisitPage({
  params,
  searchParams,
}: {
  params: Promise<{ enquiryId: string }>;
  searchParams?: Promise<{ visitId?: string | string[] }>;
}) {
  const { enquiryId } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const rawVisitId = resolvedSearch.visitId;
  const visitId = Array.isArray(rawVisitId)
    ? rawVisitId[0] ?? null
    : rawVisitId ?? null;

  return <SiteVisitModeView enquiryId={enquiryId} visitId={visitId} />;
}
