import type { ReactNode } from "react";
import { SectionCard } from "@/components/ui/section-card";

export function ProposalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <SectionCard>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-6 space-y-5">{children}</div>
    </SectionCard>
  );
}
