"use client";

import type {
  LocalProposalDraftRecord,
  QuotePreparationDraft,
} from "@/lib/proposals/quote-preparation/types";

const STORAGE_KEY = "quoteforge:proposal-drafts";
const UPDATED_EVENT = "quoteforge:proposal-drafts-updated";

export const EMPTY_PROPOSAL_DRAFTS: LocalProposalDraftRecord[] = [];

let draftsSnapshot: LocalProposalDraftRecord[] = EMPTY_PROPOSAL_DRAFTS;
let draftsSnapshotKey = "";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readDrafts(): LocalProposalDraftRecord[] {
  if (!isBrowser()) {
    return EMPTY_PROPOSAL_DRAFTS;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY) ?? "[]";

  if (raw === draftsSnapshotKey) {
    return draftsSnapshot;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    draftsSnapshot = Array.isArray(parsed)
      ? parsed.filter((entry): entry is LocalProposalDraftRecord => {
          if (!entry || typeof entry !== "object") {
            return false;
          }

          const record = entry as LocalProposalDraftRecord;
          const draft = record.draft;

          return (
            typeof record.id === "string" &&
            typeof record.enquiryId === "string" &&
            record.enquiryId.trim().length > 0 &&
            !!draft &&
            typeof draft === "object" &&
            draft.enquiryId === record.enquiryId &&
            record.sourceType === "site-visit" &&
            record.status === "draft"
          );
        })
      : EMPTY_PROPOSAL_DRAFTS;
  } catch {
    draftsSnapshot = EMPTY_PROPOSAL_DRAFTS;
  }

  draftsSnapshotKey = raw;
  return draftsSnapshot;
}

function writeDrafts(drafts: LocalProposalDraftRecord[]): void {
  if (!isBrowser()) {
    return;
  }

  const payload = JSON.stringify(drafts);
  window.localStorage.setItem(STORAGE_KEY, payload);
  draftsSnapshot = drafts;
  draftsSnapshotKey = payload;
  window.dispatchEvent(new Event(UPDATED_EVENT));
}

export function subscribeToProposalDrafts(listener: () => void): () => void {
  if (!isBrowser()) {
    return () => {};
  }

  const handleUpdate = () => listener();
  window.addEventListener(UPDATED_EVENT, handleUpdate);
  window.addEventListener("storage", handleUpdate);

  return () => {
    window.removeEventListener(UPDATED_EVENT, handleUpdate);
    window.removeEventListener("storage", handleUpdate);
  };
}

export function getLocalProposalDrafts(): LocalProposalDraftRecord[] {
  return readDrafts();
}

export function getLocalProposalDraftByEnquiry(
  enquiryId: string
): LocalProposalDraftRecord | null {
  const normalisedId = enquiryId.trim();
  if (!normalisedId) {
    return null;
  }

  return (
    readDrafts().find(
      (entry) =>
        entry.enquiryId === normalisedId &&
        entry.draft.enquiryId === normalisedId
    ) ?? null
  );
}

export function saveLocalProposalDraft(
  draft: QuotePreparationDraft
): LocalProposalDraftRecord {
  const enquiryId = draft.enquiryId.trim();
  if (!enquiryId) {
    throw new Error("Cannot save a quote draft without an enquiry id.");
  }

  if (draft.enquiryId !== enquiryId) {
    draft = { ...draft, enquiryId };
  }

  const drafts = readDrafts();
  const now = new Date().toISOString();
  const existingIndex = drafts.findIndex(
    (entry) => entry.enquiryId === enquiryId
  );

  const record: LocalProposalDraftRecord = {
    id:
      existingIndex === -1
        ? crypto.randomUUID()
        : drafts[existingIndex].id,
    enquiryId,
    siteVisitSessionId: draft.siteVisitSessionId,
    customerId: draft.customerId,
    sourceType: "site-visit",
    status: "draft",
    draft: { ...draft, enquiryId },
    createdAt: existingIndex === -1 ? now : drafts[existingIndex].createdAt,
    savedAt: now,
  };

  const nextDrafts = [...drafts];
  if (existingIndex === -1) {
    nextDrafts.push(record);
  } else {
    nextDrafts[existingIndex] = record;
  }

  writeDrafts(nextDrafts);
  return record;
}

export function removeLocalProposalDraftsForEnquiry(enquiryId: string): void {
  writeDrafts(readDrafts().filter((draft) => draft.enquiryId !== enquiryId));
}
