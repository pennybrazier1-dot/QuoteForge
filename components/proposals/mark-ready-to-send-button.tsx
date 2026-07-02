"use client";

import { useFormStatus } from "react-dom";

export function MarkReadyToSendButton({
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
      className="qf-btn-secondary"
    >
      {pending ? "Marking ready to send…" : "Mark Ready to Send"}
    </button>
  );
}
