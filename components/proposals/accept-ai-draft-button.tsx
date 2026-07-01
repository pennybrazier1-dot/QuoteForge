"use client";

import { useFormStatus } from "react-dom";

export function AcceptAiDraftButton({
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
      className="flex h-12 w-full items-center justify-center rounded-full bg-accent px-6 text-base font-semibold text-black transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Accepting AI draft…" : "Accept AI Draft"}
    </button>
  );
}
