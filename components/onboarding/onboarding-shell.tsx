import Link from "next/link";
import type { ReactNode } from "react";
import { SectionCard } from "@/components/ui/section-card";

export function OnboardingShell({
  step,
  totalSteps,
  title,
  subtitle,
  children,
}: {
  step: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-hero-glow flex min-h-full flex-1 flex-col">
      <header className="border-b border-border-subtle bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-black">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
            </span>
            <span className="text-lg font-semibold tracking-tight">QuoteForge</span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <div className="mb-6">
            <p className="text-sm font-medium text-accent">
              Step {step} of {totalSteps}
            </p>
            <div className="mt-3 flex gap-2">
              {Array.from({ length: totalSteps }, (_, index) => (
                <span
                  key={index}
                  className={`h-1.5 flex-1 rounded-full ${
                    index < step ? "bg-accent" : "bg-border-subtle"
                  }`}
                />
              ))}
            </div>
          </div>

          <SectionCard as="div" className="shadow-2xl shadow-black/40">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </SectionCard>
        </div>
      </main>
    </div>
  );
}
