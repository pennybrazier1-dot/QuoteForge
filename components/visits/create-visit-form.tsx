"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { AuthError } from "@/components/auth/auth-shell";
import { createVisitAction, type VisitActionState } from "@/lib/visits/actions";
import {
  VISIT_DURATION_OPTIONS,
  VISIT_TIME_OPTIONS,
  VISIT_TYPES,
  formatVisitTimeLabel,
  formatVisitType,
} from "@/lib/visits/types";

const initialState: VisitActionState = {};

type CustomerOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
};

type EnquiryPrefill = {
  enquiryId: string;
  customerName: string;
  contactPhone: string;
  contactEmail: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  county: string;
  postcode: string;
  enquirySummary: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-primary" disabled={pending}>
      {pending ? "Booking visit…" : "Book visit"}
    </button>
  );
}

export function CreateVisitForm({
  customers,
  preselectedCustomerId = null,
  enquiryPrefill = null,
}: {
  customers: CustomerOption[];
  preselectedCustomerId?: string | null;
  enquiryPrefill?: EnquiryPrefill | null;
}) {
  const [state, action] = useActionState(createVisitAction, initialState);
  const selectedInitial = useMemo(
    () =>
      customers.find((customer) => customer.id === preselectedCustomerId) ??
      null,
    [customers, preselectedCustomerId]
  );
  const [customerId, setCustomerId] = useState(selectedInitial?.id ?? "");
  const [customerName, setCustomerName] = useState(
    enquiryPrefill?.customerName || selectedInitial?.name || ""
  );
  const [contactPhone, setContactPhone] = useState(
    enquiryPrefill?.contactPhone || selectedInitial?.phone || ""
  );
  const [contactEmail, setContactEmail] = useState(
    enquiryPrefill?.contactEmail || selectedInitial?.email || ""
  );
  const [addressLine1, setAddressLine1] = useState(
    enquiryPrefill?.addressLine1 || selectedInitial?.address_line_1 || ""
  );
  const [addressLine2, setAddressLine2] = useState(
    enquiryPrefill?.addressLine2 || selectedInitial?.address_line_2 || ""
  );
  const [town, setTown] = useState(
    enquiryPrefill?.town || selectedInitial?.town || ""
  );
  const [county, setCounty] = useState(
    enquiryPrefill?.county || selectedInitial?.county || ""
  );
  const [postcode, setPostcode] = useState(
    enquiryPrefill?.postcode || selectedInitial?.postcode || ""
  );
  const [enquirySummary, setEnquirySummary] = useState(
    enquiryPrefill?.enquirySummary || ""
  );

  const applyCustomer = (id: string) => {
    setCustomerId(id);
    const match = customers.find((customer) => customer.id === id);
    if (!match) {
      return;
    }
    setCustomerName(match.name);
    setContactPhone(match.phone ?? "");
    setContactEmail(match.email ?? "");
    setAddressLine1(match.address_line_1 ?? "");
    setAddressLine2(match.address_line_2 ?? "");
    setTown(match.town ?? "");
    setCounty(match.county ?? "");
    setPostcode(match.postcode ?? "");
  };

  return (
    <form action={action} className="qf-visit-form">
      <input type="hidden" name="customerId" value={customerId} />
      {enquiryPrefill ? (
        <input type="hidden" name="enquiryId" value={enquiryPrefill.enquiryId} />
      ) : null}

      <section className="qf-visit-card">
        <h2 className="qf-visit-card-title">Customer</h2>
        <label className="qf-visit-field">
          <span>Saved customer</span>
          <select
            className="qf-input"
            value={customerId}
            onChange={(event) => applyCustomer(event.target.value)}
          >
            <option value="">Enter details below</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>
        <label className="qf-visit-field">
          <span>Customer name</span>
          <input
            className="qf-input"
            name="customerName"
            required
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
          />
        </label>
        <div className="qf-visit-grid">
          <label className="qf-visit-field">
            <span>Phone</span>
            <input
              className="qf-input"
              name="contactPhone"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
            />
          </label>
          <label className="qf-visit-field">
            <span>Email</span>
            <input
              className="qf-input"
              type="email"
              name="contactEmail"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
            />
          </label>
        </div>
        <label className="qf-visit-field">
          <span>Address</span>
          <input
            className="qf-input"
            name="addressLine1"
            value={addressLine1}
            onChange={(event) => setAddressLine1(event.target.value)}
          />
        </label>
        <input type="hidden" name="addressLine2" value={addressLine2} />
        <div className="qf-visit-grid">
          <label className="qf-visit-field">
            <span>Town</span>
            <input
              className="qf-input"
              name="town"
              value={town}
              onChange={(event) => setTown(event.target.value)}
            />
          </label>
          <label className="qf-visit-field">
            <span>Postcode</span>
            <input
              className="qf-input"
              name="postcode"
              value={postcode}
              onChange={(event) => setPostcode(event.target.value)}
            />
          </label>
        </div>
        <input type="hidden" name="county" value={county} />
      </section>

      <section className="qf-visit-card">
        <h2 className="qf-visit-card-title">Visit details</h2>
        <label className="qf-visit-field">
          <span>Visit type</span>
          <select
            className="qf-input"
            name="visitType"
            defaultValue="initial_assessment"
            required
          >
            {VISIT_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatVisitType(type)}
              </option>
            ))}
          </select>
        </label>
        <label className="qf-visit-field">
          <span>Reason / summary</span>
          <textarea
            className="qf-input qf-visit-textarea"
            name="enquirySummary"
            rows={4}
            placeholder="Why are you visiting? What needs assessing?"
            value={enquirySummary}
            onChange={(event) => setEnquirySummary(event.target.value)}
          />
        </label>
        <div className="qf-visit-grid">
          <label className="qf-visit-field">
            <span>Date</span>
            <input className="qf-input" type="date" name="visitDate" required />
          </label>
          <label className="qf-visit-field">
            <span>Start time</span>
            <select className="qf-input" name="visitTime" defaultValue="09:00">
              {VISIT_TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>
                  {formatVisitTimeLabel(time)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="qf-visit-field">
          <span>Duration</span>
          <select
            className="qf-input"
            name="durationMinutes"
            defaultValue="60"
          >
            {VISIT_DURATION_OPTIONS.map((option) => (
              <option key={option.minutes} value={option.minutes}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="qf-visit-check">
          <input type="checkbox" name="notifyCustomer" value="1" defaultChecked />
          <span>Email the customer visit details</span>
        </label>
      </section>

      {state.error ? <AuthError message={state.error} /> : null}

      <div className="qf-visit-actions">
        <SubmitButton />
        <Link href="/visits" className="qf-btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
