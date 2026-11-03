"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listEnquiryVisitsAction } from "@/lib/enquiries/server/actions";
import { buildSiteVisitModePath } from "@/lib/enquiries/site-visit-mode-link";
import { buildBookVisitFromEnquiryHref } from "@/lib/enquiries/book-visit-handoff";
import {
  formatVisitDateLabel,
  formatVisitStatus,
  formatVisitTimeLabel,
  formatVisitType,
} from "@/lib/visits/types";

type VisitRow = {
  id: string;
  visit_type: string;
  visit_date: string;
  visit_time: string | null;
  status: string;
  slot_label: string | null;
};

export function EnquiryVisitsPanel({ enquiryId }: { enquiryId: string }) {
  const [visits, setVisits] = useState<VisitRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listEnquiryVisitsAction(enquiryId).then((result) => {
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setError(result.error);
        setVisits([]);
        return;
      }
      setError(null);
      setVisits(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [enquiryId]);

  if (visits === null) {
    return (
      <section className="qf-card qf-enquiry-detail-card">
        <h2 className="qf-enquiry-detail-section-title">Visits</h2>
        <p className="qf-enquiry-detail-copy">Loading visits…</p>
      </section>
    );
  }

  return (
    <section className="qf-card qf-enquiry-detail-card">
      <h2 className="qf-enquiry-detail-section-title">Visits</h2>
      <p className="qf-enquiry-detail-copy">
        Each visit keeps its own notes, photos, measurements, and checklist.
      </p>
      {error ? (
        <p className="qf-enquiry-detail-copy" role="alert">
          {error}
        </p>
      ) : null}
      {visits.length === 0 ? (
        <p className="qf-enquiry-detail-copy">No visits booked yet.</p>
      ) : (
        <ul className="qf-enquiry-visits-list">
          {visits.map((visit) => {
            const when =
              visit.slot_label ||
              [
                formatVisitDateLabel(visit.visit_date),
                formatVisitTimeLabel(visit.visit_time),
              ]
                .filter(Boolean)
                .join(" · ");
            return (
              <li key={visit.id} className="qf-enquiry-visits-item">
                <div className="qf-enquiry-visits-item-copy">
                  <p className="qf-enquiry-visits-item-title">
                    {formatVisitType(visit.visit_type)} ·{" "}
                    {formatVisitStatus(visit.status)}
                  </p>
                  <p className="qf-enquiry-detail-copy">{when}</p>
                </div>
                <div className="qf-enquiry-visits-item-actions">
                  <Link
                    href={`/visits/${visit.id}`}
                    className="qf-btn-secondary"
                  >
                    Open visit
                  </Link>
                  {visit.status !== "cancelled" ? (
                    <Link
                      href={buildSiteVisitModePath(enquiryId, visit.id)}
                      className="qf-btn-primary"
                    >
                      Site Visit Mode
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4">
        <Link
          href={buildBookVisitFromEnquiryHref(enquiryId)}
          className="qf-btn-secondary"
        >
          Book another visit
        </Link>
      </div>
    </section>
  );
}
