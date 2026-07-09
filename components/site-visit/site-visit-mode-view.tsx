"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { completeSiteVisit } from "@/lib/enquiries/enquiry-store";
import { formatEnquiryAddress, formatEnquiryTimelineDate } from "@/lib/enquiries/format";
import { useStoredEnquiry } from "@/lib/enquiries/use-stored-enquiries";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";
import {
  canAccessSiteVisitMode,
  createDefaultSiteVisitSession,
  formatVisitElapsed,
  getSiteVisitOrganisingSteps,
  isSiteVisitOrganisingComplete,
} from "@/lib/site-visit/site-visit-mode-data";
import {
  addSiteVisitPhoto,
  addSiteVisitVoiceNote,
  ensureSiteVisitSession,
  updateSiteVisitChecklist,
  updateSiteVisitMeasurements,
  updateSiteVisitNotes,
} from "@/lib/site-visit/site-visit-session-store";
import { useSiteVisitSession } from "@/lib/site-visit/use-site-visit-session";
import type { SiteVisitActionId } from "@/lib/site-visit/types";

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
  const enquiry = useStoredEnquiry(enquiryId);
  const session = useSiteVisitSession(enquiryId);
  const photoInputId = useId();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [activeAction, setActiveAction] = useState<SiteVisitActionId | null>(null);
  const [elapsed, setElapsed] = useState("00:00");
  const [notice, setNotice] = useState<string | null>(null);

  const visitCompleted = enquiry?.status === "site_visit_completed";
  const address = enquiry ? formatEnquiryAddress(enquiry) : "";

  useEffect(() => {
    if (!enquiry || !canAccessSiteVisitMode(enquiry.status) || visitCompleted) {
      return;
    }

    ensureSiteVisitSession(enquiryId);
  }, [enquiry, enquiryId, visitCompleted]);

  useEffect(() => {
    const startedAt = session?.startedAt;

    if (!startedAt) {
      return;
    }

    const updateElapsed = () => {
      setElapsed(formatVisitElapsed(startedAt));
    };

    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 1000);

    return () => window.clearInterval(intervalId);
  }, [session?.startedAt]);

  if (!mounted) {
    return <p className="qf-site-visit-loading">Loading site visit…</p>;
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

  const organisingSteps = getSiteVisitOrganisingSteps(
    session ?? createDefaultSiteVisitSession(enquiryId),
    visitCompleted
  );
  const organisingComplete = isSiteVisitOrganisingComplete(organisingSteps);

  function handleFinishVisit() {
    const updated = completeSiteVisit(enquiryId);

    if (!updated) {
      setNotice("Could not finish the site visit.");
      return;
    }

    setNotice("Site visit completed. Quote information is ready to prepare.");
  }

  function handleVoiceNote() {
    addSiteVisitVoiceNote(enquiryId);
    setNotice("Voice note captured.");
    setActiveAction(null);
  }

  function handlePhotoSelected(fileList: FileList | null) {
    const file = fileList?.[0];

    if (!file) {
      return;
    }

    addSiteVisitPhoto(enquiryId, file.name);
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
            <button
              type="button"
              className="qf-btn-primary qf-site-visit-finish-btn"
              onClick={handleFinishVisit}
            >
              Finish Visit
            </button>
          ) : (
            <Link
              href="/proposals/new"
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
            Placeholder capture for now. This saves a voice note entry locally and
            updates the timeline.
          </p>
          <button
            type="button"
            className="qf-btn-primary"
            onClick={handleVoiceNote}
            disabled={visitCompleted}
          >
            Capture voice note
          </button>
          {session?.voiceNotes.length ? (
            <ul className="qf-site-visit-list">
              {session.voiceNotes.map((note) => (
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
            Add a photo from the work area. Files stay in browser storage for now.
          </p>
          <input
            ref={photoInputRef}
            id={photoInputId}
            type="file"
            accept="image/*"
            capture="environment"
            className="qf-site-visit-file-input"
            onChange={(event) => handlePhotoSelected(event.target.files)}
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
          {session?.photos.length ? (
            <ul className="qf-site-visit-list">
              {session.photos.map((photo) => (
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
            {(session?.measurements ?? []).map((field) => (
              <label key={field.id} className="qf-site-visit-measurement-field">
                <span>{field.label}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="form-input"
                  value={field.value}
                  disabled={visitCompleted}
                  onChange={(event) => {
                    const nextMeasurements = (session?.measurements ?? []).map(
                      (entry) =>
                        entry.id === field.id
                          ? { ...entry, value: event.target.value }
                          : entry
                    );
                    updateSiteVisitMeasurements(enquiryId, nextMeasurements);
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
            value={session?.notes ?? ""}
            disabled={visitCompleted}
            placeholder="Write what you found on site…"
            onChange={(event) => updateSiteVisitNotes(enquiryId, event.target.value)}
          />
        </section>
      ) : null}

      {activeAction === "checklist" ? (
        <section className="qf-site-visit-panel">
          <h2 className="qf-site-visit-panel-title">Checklist</h2>
          <ul className="qf-site-visit-checklist">
            {(session?.checklist ?? []).map((item) => (
              <li key={item.id}>
                <label className="qf-site-visit-checklist-item">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    disabled={visitCompleted}
                    onChange={(event) => {
                      const nextChecklist = (session?.checklist ?? []).map(
                        (entry) =>
                          entry.id === item.id
                            ? { ...entry, checked: event.target.checked }
                            : entry
                      );
                      updateSiteVisitChecklist(enquiryId, nextChecklist);
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
        {visitCompleted ? (
          <Link href="/proposals/new" className="qf-btn-primary qf-site-visit-prepare-quote">
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
