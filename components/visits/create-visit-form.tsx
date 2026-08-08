"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { AuthError } from "@/components/auth/auth-shell";
import { SectionCard } from "@/components/ui/section-card";
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

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="qf-field-label">
        {label}
      </label>
      <div className="mt-2">{children}</div>
    </div>
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
    <form action={action} className="qf-proposal-page qf-mobile-safe">
      <input type="hidden" name="customerId" value={customerId} />
      {enquiryPrefill ? (
        <input type="hidden" name="enquiryId" value={enquiryPrefill.enquiryId} />
      ) : null}

      <div className="qf-proposal-col-left">
        <SectionCard className="qf-card-form">
          <h2 className="qf-card-heading">Customer details</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Saved customer" id="visitSavedCustomer">
                <select
                  id="visitSavedCustomer"
                  className="form-select"
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
              </Field>
            </div>
            <Field label="Name" id="visitCustomerName">
              <input
                id="visitCustomerName"
                className="form-input"
                name="customerName"
                required
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="e.g. Mrs Sarah Whitfield"
              />
            </Field>
            <Field label="Email" id="visitContactEmail">
              <input
                id="visitContactEmail"
                className="form-input"
                type="email"
                name="contactEmail"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                autoComplete="email"
                placeholder="e.g. sarah@example.com"
              />
            </Field>
            <Field label="Phone" id="visitContactPhone">
              <input
                id="visitContactPhone"
                className="form-input"
                type="tel"
                name="contactPhone"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                autoComplete="tel"
                placeholder="e.g. 07700 900123"
              />
            </Field>
            <Field label="Address" id="visitAddressLine1">
              <input
                id="visitAddressLine1"
                className="form-input"
                name="addressLine1"
                value={addressLine1}
                onChange={(event) => setAddressLine1(event.target.value)}
                placeholder="e.g. 14 Riverside Close"
              />
            </Field>
            <input type="hidden" name="addressLine2" value={addressLine2} />
            <Field label="Town" id="visitTown">
              <input
                id="visitTown"
                className="form-input"
                name="town"
                value={town}
                onChange={(event) => setTown(event.target.value)}
                placeholder="e.g. Bristol"
              />
            </Field>
            <Field label="Postcode" id="visitPostcode">
              <input
                id="visitPostcode"
                className="form-input"
                name="postcode"
                value={postcode}
                onChange={(event) => setPostcode(event.target.value)}
                placeholder="e.g. BS1 1AA"
              />
            </Field>
            <input type="hidden" name="county" value={county} />
          </div>
        </SectionCard>

        <SectionCard className="qf-card-form">
          <h2 className="qf-card-heading">Visit details</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Visit type" id="visitType">
                <select
                  id="visitType"
                  className="form-select"
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
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Reason / summary" id="visitEnquirySummary">
                <textarea
                  id="visitEnquirySummary"
                  className="form-textarea"
                  name="enquirySummary"
                  rows={4}
                  placeholder="Why are you visiting? What needs assessing?"
                  value={enquirySummary}
                  onChange={(event) => setEnquirySummary(event.target.value)}
                />
              </Field>
            </div>
            <Field label="Date" id="visitDate">
              <input
                id="visitDate"
                className="form-input form-input-date"
                type="date"
                name="visitDate"
                required
              />
            </Field>
            <Field label="Start time" id="visitTime">
              <select
                id="visitTime"
                className="form-select"
                name="visitTime"
                defaultValue="09:00"
              >
                {VISIT_TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {formatVisitTimeLabel(time)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Duration" id="visitDuration">
                <select
                  id="visitDuration"
                  className="form-select"
                  name="durationMinutes"
                  defaultValue="60"
                >
                  {VISIT_DURATION_OPTIONS.map((option) => (
                    <option key={option.minutes} value={option.minutes}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="qf-qq-photos-skip sm:col-span-2">
              <input
                type="checkbox"
                name="notifyCustomer"
                value="1"
                defaultChecked
              />
              Email the customer visit details
            </label>
          </div>
        </SectionCard>

        {state.error ? <AuthError message={state.error} /> : null}

        <SectionCard className="qf-card-form">
          <h2 className="qf-card-heading">Actions</h2>
          <div className="mt-5 space-y-3">
            <SubmitButton />
            <Link href="/visits" className="qf-btn-secondary">
              Cancel
            </Link>
          </div>
        </SectionCard>
      </div>
    </form>
  );
}
