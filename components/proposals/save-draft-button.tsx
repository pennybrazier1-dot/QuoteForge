"use client";

import { useFormStatus } from "react-dom";

export function SaveDraftButton({ label = "Save Draft" }: { label?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 w-full items-center justify-center rounded-full bg-accent text-base font-semibold text-black transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving draft…" : label}
    </button>
  );
}
