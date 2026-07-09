export class EnquiryPersistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnquiryPersistError";
  }
}

export function isStorageQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.code === 22)
  );
}

export function toEnquiryPersistError(error: unknown): EnquiryPersistError {
  if (error instanceof EnquiryPersistError) {
    return error;
  }

  if (isStorageQuotaError(error)) {
    return new EnquiryPersistError(
      "We couldn't save your request because this browser's storage is full. Please clear older site data in your browser settings and try again."
    );
  }

  return new EnquiryPersistError(
    "We couldn't save your request right now. Please check your connection and try again."
  );
}
