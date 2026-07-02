"use client";

import { useFormStatus } from "react-dom";

export function SaveDraftButton({ label = "Save Draft" }: { label?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="qf-btn-primary"
    >
      {pending ? "Saving draft…" : label}
    </button>
  );
}
