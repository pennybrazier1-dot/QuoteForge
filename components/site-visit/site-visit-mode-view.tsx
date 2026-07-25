"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildQuotePreparationPath } from "@/lib/proposals/quote-preparation/quote-preparation-path";
import { useEffect, useId, useRef, useState } from "react";
import { uploadSiteVisitPhotoAction } from "@/lib/enquiries/server/actions";
import { useWorkspaceEnquiry } from "@/lib/enquiries/server/use-workspace-enquiries";
import { formatEnquiryAddress, formatEnquiryTimelineDate } from "@/lib/enquiries/format";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";
import {
  canAccessSiteVisitMode,
  createDefaultSiteVisitSession,
  formatVisitElapsed,
  getSiteVisitOrganisingSteps,
  isSiteVisitOrganisingComplete,
} from "@/lib/site-visit/site-visit-mode-data";
import { useWorkspaceSiteVisit } from "@/lib/site-visit/use-workspace-site-visit";
import type {
  SiteVisitActionId,
  SiteVisitCapturedPhoto,
  SiteVisitChecklistItem,
  SiteVisitMeasurement,
  SiteVisitVoiceNote,
} from "@/lib/site-visit/types";

const ACTION_CARDS: Array<{
  id: SiteVisitActionId;
  title: string;
  description: string;
}> = [
  {
    id: "voice_note",
    title: "Voice Note",
    description: "Capture a quick spoken note while on site.",
  },
  {
    id: "photo",
    title: "Take Photo",
    description: "Add photos from the work area.",
  },
  {
    id: "measurements",
    title: "Measurements",
    description: "Record sizes and dimensions.",
  },
  {
    id: "notes",
    title: "Notes",
    description: "Write what you found on site.",
  },
  {
    id: "checklist",
    title: "Checklist",
    description: "Tick off the visit essentials.",
  },
];

export function SiteVisitModeView({ enquiryId }: { enquiryId: string }) {
  const router = useRouter();
  const mounted = useClientMounted();
  const {
    enquiry,
    state: enquiryState,
    error: enquiryError,
    refresh: refreshEnquiry,
  } = useWorkspaceEnquiry(enquiryId);
  const {
    session,
    siteVisitId,
    state: visitState,
    error: visitError,
    save,
    complete,
  } = useWorkspaceSiteVisit(enquiryId);
  const photoInputId = useId();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [activeAction, setActiveAction] = useState<SiteVisitActionId | null>(null);
  const [elapsed, setElapsed] = useState("00:00");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [localNotes, setLocalNotes] = useState("");
  const [localMeasurements, setLocalMeasurements] = useState<SiteVisitMeasurement[]>(
    []
  );
  const [localChecklist, setLocalChecklist] = useState<SiteVisitChecklistItem[]>([]);
  const [localVoiceNotes, setLocalVoiceNotes] = useState<SiteVisitVoiceNote[]>([]);
  const [localPhotos, setLocalPhotos] = useState<SiteVisitCapturedPhoto[]>([]);
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);

  if (session && draftSessionId !== session.id) {
    setDraftSessionId(session.id);
    setLocalNotes(session.notes);
    setLocalMeasurements(session.measurements);
    setLocalChecklist(session.checklist);
    setLocalVoiceNotes(session.voiceNotes);
    setLocalPhotos(session.photos);
  }

  const visitCompleted = enquiry?.status === "site_visit_completed";
  const address = enquiry ? formatEnquiryAddress(enquiry) : "";

  useEffect(() => {
    const startedAt = session?.startedAt;

    if (!startedAt) {
      return;
    }

    const updateElapsed = () => {
      setElapsed(formatVisitElapsed(startedAt));
    };

    const intervalId = window.setInterval(updateElapsed, 1000);
    queueMicrotask(updateElapsed);

    return () => window.clearInterval(intervalId);
  }, [session?.startedAt]);

  if (!mounted || enquiryState === "loading" || visitState === "loading") {
    return <p className="qf-site-visit-loading">Loading site visit…</p>;
  }

  if (enquiryState === "error" || visitState === "error") {
    return (
      <div className="qf-site-visit-empty">
        <h1 className="qf-site-visit-empty-title">Could not load site visit</h1>
        <p className="qf-site-visit-empty-copy">
          {enquiryError ?? visitError ?? "Something went wrong."}
        </p>
        <button
          type="button"
          className="qf-btn-secondary"
          onClick={() => void refreshEnquiry()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!enquiry || !canAccessSiteVisitMode(enquiry.status)) {
    return (
      <div className="qf-site-visit-empty">
        <h1 className="qf-site-visit-empty-title">Site visit unavailable</h1>
        <p className="qf-site-visit-empty-copy">
          Book a site visit first, then open this page from the enquiry to collect
          notes, photos, and measurements on site.
        </p>
        <Link href={`/enquiries/${enquiryId}`} className="qf-btn-secondary">
          Back to enquiry
        </Link>
      </div>
    );
  }

  const draftSession =
    session ??
    createDefaultSiteVisitSession(enquiryId);
  const organisingSteps = getSiteVisitOrganisingSteps(
    {
      ...draftSession,
      notes: localNotes,
      measurements: localMeasurements,
      checklist: localChecklist,
      voiceNotes: localVoiceNotes,
      photos: localPhotos,
    },
    visitCompleted
  );
  const organisingComplete = isSiteVisitOrganisingComplete(organisingSteps);

  async function handleSaveProgress() {
    setSaving(true);

    try {
      const result = await save({
        notes: localNotes,
        measurements: localMeasurements,
        checklist: localChecklist,
        voiceNotes: localVoiceNotes,
      });

      if (!result.ok) {
        setNotice(result.error);
        return;
      }

      setNotice("Progress saved to your workspace.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFinishVisit() {
    const saveResult = await save({
      notes: localNotes,
      measurements: localMeasurements,
      checklist: localChecklist,
      voiceNotes: localVoiceNotes,
    });

    if (!saveResult.ok) {
      setNotice(saveResult.error);
      return;
    }

    const result = await complete();

    if (!result.ok) {
      setNotice(result.error);
      return;
    }

    await refreshEnquiry();
    setNotice("Site visit completed. Quote information is ready to prepare.");
  }

  function handleVoiceNote() {
    const capturedAt = new Date().toISOString();
    setLocalVoiceNotes((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        label: `Voice note ${current.length + 1}`,
        capturedAt,
        durationSeconds: 0,
      },
    ]);
    setNotice("Voice note added. Tap Save progress when you are ready.");
    setActiveAction(null);
  }

  async function handlePhotoSelected(fileList: FileList | null) {
    const file = fileList?.[0];

    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.set("enquiryId", enquiryId);
    if (siteVisitId) {
      formData.set("siteVisitId", siteVisitId);
    }
    formData.set("file", file);

    const result = await uploadSiteVisitPhotoAction(formData);

    if (!result.ok) {
      setNotice(result.error);
      return;
    }

    setLocalPhotos((current) => [
      ...current,
      {
        id: result.data.id,
        name: result.data.fileName,
        capturedAt: new Date().toISOString(),
      },
    ]);
    setNotice("Photo added to the site visit.");
    setActiveAction(null);
  }

  return (
    <div className="qf-site-visit-mode">
      <header className="qf-site-visit-header">
        <div className="qf-site-visit-header-copy">
          <p className="qf-site-visit-eyebrow">Site visit</p>
          <h1 className="qf-site-visit-customer">{enquiry.customerName}</h1>
          <p className="qf-site-visit-address">{address || "Address not provided"}</p>
        </div>
        <div className="qf-site-visit-header-actions">
          <div className="qf-site-visit-timer" aria-live="polite">
            <span className="qf-site-visit-timer-label">Visit timer</span>
            <span className="qf-site-visit-timer-value">{elapsed}</span>
          </div>
          {!visitCompleted ? (
            <>
              <button
                type="button"
                className="qf-btn-secondary qf-site-visit-save-btn"
                onClick={() => void handleSaveProgress()}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save progress"}
              </button>
              <button
                type="button"
                className="qf-btn-primary qf-site-visit-finish-btn"
                onClick={() => void handleFinishVisit()}
              >
                Finish Visit
              </button>
            </>
          ) : (
            <Link
              href={buildQuotePreparationPath(enquiryId)}
              className="qf-btn-primary qf-site-visit-finish-btn"
            >
              Prepare Quote
            </Link>
          )}
        </div>
      </header>

      {notice ? (
        <p className="qf-site-visit-notice" role="status">
          {notice}
        </p>
      ) : null}

      <section className="qf-site-visit-actions" aria-label="Site visit actions">
        {ACTION_CARDS.map((card) => {
          const isActive = activeAction === card.id;

          return (
            <button
              key={card.id}
              type="button"
              className={[
                "qf-site-visit-action-card",
                isActive ? "qf-site-visit-action-card-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() =>
                setActiveAction((current) => (current === card.id ? null : card.id))
              }
            >
              <span className="qf-site-visit-action-title">{card.title}</span>
              <span className="qf-site-visit-action-copy">{card.description}</span>
            </button>
          );
        })}
      </section>

      {activeAction === "voice_note" ? (
        <section className="qf-site-visit-panel">
          <h2 className="qf-site-visit-panel-title">Voice note</h2>
          <p className="qf-site-visit-panel-copy">
            Placeholder capture for now. Add a voice note entry, then save progress
            to store it in your workspace.
          </p>
          <button
            type="button"
            className="qf-btn-primary"
            onClick={handleVoiceNote}
            disabled={visitCompleted}
          >
            Capture voice note
          </button>
          {localVoiceNotes.length ? (
            <ul className="qf-site-visit-list">
              {localVoiceNotes.map((note) => (
                <li key={note.id}>{note.label}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {activeAction === "photo" ? (
        <section className="qf-site-visit-panel">
          <h2 className="qf-site-visit-panel-title">Take photo</h2>
          <p className="qf-site-visit-panel-copy">
            Add a photo from the work area. Photos upload to your workspace right
            away; your notes stay on this page until you save progress.
          </p>
          <input
            ref={photoInputRef}
            id={photoInputId}
            type="file"
            accept="image/*"
            capture="environment"
            className="qf-site-visit-file-input"
            onChange={(event) => void handlePhotoSelected(event.target.files)}
            disabled={visitCompleted}
          />
          <button
            type="button"
            className="qf-btn-primary"
            onClick={() => photoInputRef.current?.click()}
            disabled={visitCompleted}
          >
            Take photo
          </button>
          {localPhotos.length ? (
            <ul className="qf-site-visit-list">
              {localPhotos.map((photo) => (
                <li key={photo.id}>{photo.name}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {activeAction === "measurements" ? (
        <section className="qf-site-visit-panel">
          <h2 className="qf-site-visit-panel-title">Measurements</h2>
          <div className="qf-site-visit-measurements">
            {localMeasurements.map((field) => (
              <label key={field.id} className="qf-site-visit-measurement-field">
                <span>{field.label}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="form-input"
                  value={field.value}
                  disabled={visitCompleted}
                  onChange={(event) => {
                    setLocalMeasurements((current) =>
                      current.map((entry) =>
                        entry.id === field.id
                          ? { ...entry, value: event.target.value }
                          : entry
                      )
                    );
                  }}
                />
                <span className="qf-site-visit-measurement-unit">{field.unit}</span>
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {activeAction === "notes" ? (
        <section className="qf-site-visit-panel">
          <h2 className="qf-site-visit-panel-title">Notes</h2>
          <textarea
            className="form-textarea qf-site-visit-notes"
            rows={6}
            value={localNotes}
            disabled={visitCompleted}
            placeholder="Write what you found on site…"
            onChange={(event) => setLocalNotes(event.target.value)}
          />
        </section>
      ) : null}

      {activeAction === "checklist" ? (
        <section className="qf-site-visit-panel">
          <h2 className="qf-site-visit-panel-title">Checklist</h2>
          <ul className="qf-site-visit-checklist">
            {localChecklist.map((item) => (
              <li key={item.id}>
                <label className="qf-site-visit-checklist-item">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    disabled={visitCompleted}
                    onChange={(event) => {
                      setLocalChecklist((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, checked: event.target.checked }
                            : entry
                        )
                      );
                    }}
                  />
                  <span>{item.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="qf-site-visit-organising">
        <div className="qf-site-visit-organising-head">
          <h2 className="qf-site-visit-organising-title">
            {organisingComplete ? "Organised" : "Organising…"}
          </h2>
          <p className="qf-site-visit-organising-copy">
            Everything you capture here is being sorted ready for the quote.
          </p>
        </div>
        <ul className="qf-site-visit-organising-list">
          {organisingSteps.map((step) => (
            <li
              key={step.id}
              className={[
                "qf-site-visit-organising-item",
                step.done ? "qf-site-visit-organising-item-done" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="qf-site-visit-organising-marker" aria-hidden="true" />
              <span>{step.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="qf-site-visit-timeline-section">
        <h2 className="qf-site-visit-panel-title">Timeline</h2>
        <ol className="qf-enquiry-timeline">
          {enquiry.timeline.map((event) => (
            <li key={event.id} className="qf-enquiry-timeline-item">
              <span className="qf-enquiry-timeline-label">{event.label}</span>
              <span className="qf-enquiry-timeline-date">
                {formatEnquiryTimelineDate(event.at)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="qf-site-visit-footer-actions">
        {!visitCompleted ? (
          <button
            type="button"
            className="qf-btn-secondary qf-site-visit-save-btn"
            onClick={() => void handleSaveProgress()}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save progress"}
          </button>
        ) : null}
        {visitCompleted ? (
          <Link href={buildQuotePreparationPath(enquiryId)} className="qf-btn-primary qf-site-visit-prepare-quote">
            Prepare Quote
          </Link>
        ) : null}
        <button
          type="button"
          className="qf-btn-secondary"
          onClick={() => router.push(`/enquiries/${enquiryId}`)}
        >
          Back to enquiry
        </button>
      </div>
    </div>
  );
}
