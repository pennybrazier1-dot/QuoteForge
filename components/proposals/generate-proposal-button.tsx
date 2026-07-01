"use client";

import { useFormStatus } from "react-dom";

export function GenerateProposalButton({
  formAction,
}: {
  formAction: (payload: FormData) => void;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      className="flex h-12 w-full items-center justify-center rounded-full border border-accent/40 bg-accent-soft px-6 text-base font-semibold text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Generating proposal…" : "Generate Proposal"}
    </button>
  );
}
