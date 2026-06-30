import type { ReactNode } from "react";

export function ProposalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border-subtle bg-background-elevated p-6 sm:p-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}
