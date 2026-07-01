import type { ReactNode } from "react";

export function WorkHomeShell({
  greeting,
  headline,
  supporting,
  children,
}: {
  greeting: string;
  headline: string;
  supporting: string;
  children: ReactNode;
}) {
  return (
    <main className="qf-workspace w-full flex-1">
      <header>
        <p className="text-sm font-medium text-muted">{greeting}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{headline}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{supporting}</p>
      </header>

      <div className="qf-workspace-stack mt-8">{children}</div>
    </main>
  );
}

export function WorkHomeHeroRow({ children }: { children: ReactNode }) {
  return <div className="qf-workspace-hero">{children}</div>;
}
