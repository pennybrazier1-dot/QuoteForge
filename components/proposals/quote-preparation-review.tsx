"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { PlannedStartDateFields } from "@/components/proposals/planned-start-date-fields";
import type {
  QuoteLineItem,
  QuoteMaterialItem,
  QuotePreparationDraft,
} from "@/lib/proposals/quote-preparation/types";
import { getQuoteMissingChecks } from "@/lib/proposals/quote-preparation/missing-checks";
import { QUOTE_PREPARATION_VAT_HELPER } from "@/lib/proposals/quote-preparation/types";

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="qf-quote-prep-section">
      <button
        type="button"
        className="qf-quote-prep-section-toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{title}</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="qf-quote-prep-section-body">{children}</div> : null}
    </section>
  );
}

function LineItemsEditor({
  items,
  onChange,
  showTotals = true,
}: {
  items: QuoteLineItem[];
  onChange: (items: QuoteLineItem[]) => void;
  showTotals?: boolean;
}) {
  function updateItem(id: string, patch: Partial<QuoteLineItem>) {
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function addItem() {
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        description: "",
        quantity: "",
        rate: "",
        lineTotal: "",
      },
    ]);
  }

  return (
    <div className="qf-quote-prep-line-items">
      {items.map((item) => (
        <div key={item.id} className="qf-quote-prep-line-item">
          <input
            type="text"
            className="form-input"
            value={item.description}
            placeholder="Description"
            onChange={(event) =>
              updateItem(item.id, { description: event.target.value })
            }
          />
          <input
            type="text"
            inputMode="decimal"
            className="form-input"
            value={item.quantity}
            placeholder="Qty / time"
            onChange={(event) =>
              updateItem(item.id, { quantity: event.target.value })
            }
          />
          <input
            type="text"
            inputMode="decimal"
            className="form-input"
            value={item.rate}
            placeholder="Rate £"
            onChange={(event) =>
              updateItem(item.id, { rate: event.target.value })
            }
          />
          {showTotals ? (
            <input
              type="text"
              inputMode="decimal"
              className="form-input"
              value={item.lineTotal}
              placeholder="Line total £"
              onChange={(event) =>
                updateItem(item.id, { lineTotal: event.target.value })
              }
            />
          ) : null}
        </div>
      ))}
      <button type="button" className="qf-btn-secondary" onClick={addItem}>
        Add line item
      </button>
    </div>
  );
}

export function QuotePreparationReview({
  draft,
  onDraftChange,
}: {
  draft: QuotePreparationDraft;
  onDraftChange: (draft: QuotePreparationDraft) => void;
}) {
  const missingChecks = getQuoteMissingChecks(draft);

  function updateDraft(patch: Partial<QuotePreparationDraft>) {
    onDraftChange({ ...draft, ...patch });
  }

  function updateMaterials(materials: QuoteMaterialItem[]) {
    updateDraft({ materials });
  }

  return (
    <div className="qf-quote-prep-review qf-mobile-safe">
      <div className="qf-quote-prep-notice">{draft.reviewNotice}</div>

      {missingChecks.length > 0 ? (
        <section className="qf-quote-prep-missing">
          <h2 className="qf-quote-prep-missing-title">
            Before this quote is ready, please confirm:
          </h2>
          <ul className="qf-quote-prep-missing-list">
            {missingChecks.map((check) => (
              <li key={check.id}>{check.label}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <CollapsibleSection title="Customer and property" defaultOpen>
        <div className="qf-quote-prep-fields">
          <label className="qf-field-label" htmlFor="qpCustomerName">
            Customer
          </label>
          <input
            id="qpCustomerName"
            className="form-input"
            value={draft.customerName}
            onChange={(event) => updateDraft({ customerName: event.target.value })}
          />
          <label className="qf-field-label" htmlFor="qpPropertyAddress">
            Address
          </label>
          <input
            id="qpPropertyAddress"
            className="form-input"
            value={draft.propertyAddress}
            onChange={(event) =>
              updateDraft({ propertyAddress: event.target.value })
            }
          />
          <label className="qf-field-label" htmlFor="qpPhone">
            Phone
          </label>
          <input
            id="qpPhone"
            className="form-input"
            value={draft.phoneNumber}
            onChange={(event) => updateDraft({ phoneNumber: event.target.value })}
          />
          <label className="qf-field-label" htmlFor="qpEmail">
            Email
          </label>
          <input
            id="qpEmail"
            className="form-input"
            value={draft.emailAddress}
            onChange={(event) => updateDraft({ emailAddress: event.target.value })}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Scope of work" defaultOpen>
        <label className="qf-field-label" htmlFor="qpScopeSummary">
          Summary
        </label>
        <textarea
          id="qpScopeSummary"
          className="form-textarea"
          rows={4}
          value={draft.scopeSummary}
          onChange={(event) => updateDraft({ scopeSummary: event.target.value })}
        />
        <label className="qf-field-label" htmlFor="qpScopeItems">
          Work items
        </label>
        <textarea
          id="qpScopeItems"
          className="form-textarea"
          rows={5}
          value={draft.scopeItems.join("\n")}
          onChange={(event) =>
            updateDraft({
              scopeItems: event.target.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            })
          }
          placeholder="One work item per line"
        />
      </CollapsibleSection>

      <CollapsibleSection title="Measurements and site details">
        <label className="qf-field-label" htmlFor="qpMeasurements">
          Measurements
        </label>
        <textarea
          id="qpMeasurements"
          className="form-textarea"
          rows={4}
          value={draft.measurementsText}
          onChange={(event) =>
            updateDraft({ measurementsText: event.target.value })
          }
        />
        <p className="qf-quote-prep-meta">
          Site visit: {draft.siteVisitDate} · {draft.photoCount} photo reference
          {draft.photoCount === 1 ? "" : "s"}
        </p>
        <ul className="qf-quote-prep-list">
          {draft.siteDetails.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="Materials">
        <p className="qf-quote-prep-helper">
          Draft suggestions only — enter prices and edit before sending.
        </p>
        <div className="qf-quote-prep-materials">
          {draft.materials.map((material) => (
            <div key={material.id} className="qf-quote-prep-material-item">
              <input
                type="text"
                className="form-input"
                value={material.description}
                onChange={(event) =>
                  updateMaterials(
                    draft.materials.map((entry) =>
                      entry.id === material.id
                        ? { ...entry, description: event.target.value }
                        : entry
                    )
                  )
                }
              />
              <input
                type="text"
                inputMode="decimal"
                className="form-input"
                value={material.price}
                placeholder="Price £"
                onChange={(event) =>
                  updateMaterials(
                    draft.materials.map((entry) =>
                      entry.id === material.id
                        ? { ...entry, price: event.target.value }
                        : entry
                    )
                  )
                }
              />
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Labour">
        <LineItemsEditor
          items={draft.labourItems}
          onChange={(labourItems) => updateDraft({ labourItems })}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Additional costs">
        <LineItemsEditor
          items={draft.additionalCosts}
          onChange={(additionalCosts) => updateDraft({ additionalCosts })}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Notes and exclusions">
        <textarea
          className="form-textarea"
          rows={5}
          value={draft.notesAndExclusions}
          onChange={(event) =>
            updateDraft({ notesAndExclusions: event.target.value })
          }
        />
        <label className="qf-field-label" htmlFor="qpValidity">
          Validity period
        </label>
        <input
          id="qpValidity"
          className="form-input"
          value={draft.validityPeriod}
          onChange={(event) => updateDraft({ validityPeriod: event.target.value })}
        />
        <label className="qf-field-label" htmlFor="qpTimescale">
          Expected timescale
        </label>
        <input
          id="qpTimescale"
          className="form-input"
          value={draft.expectedTimescale}
          onChange={(event) =>
            updateDraft({ expectedTimescale: event.target.value })
          }
        />
        <PlannedStartDateFields
          textValue={draft.plannedStartDateText}
          exactValue={draft.plannedStartDateExact}
          onTextChange={(value) => updateDraft({ plannedStartDateText: value })}
          onExactChange={(value) =>
            updateDraft({ plannedStartDateExact: value })
          }
        />
      </CollapsibleSection>

      <CollapsibleSection title="Pricing summary">
        <p className="qf-quote-prep-helper">{QUOTE_PREPARATION_VAT_HELPER}</p>
        <label className="qf-quote-prep-check">
          <input
            type="checkbox"
            checked={draft.vatEnabled}
            onChange={(event) => updateDraft({ vatEnabled: event.target.checked })}
          />
          <span>Apply VAT</span>
        </label>
        <input
          type="text"
          inputMode="decimal"
          className="form-input"
          value={draft.vatRate}
          placeholder="VAT rate %"
          onChange={(event) => updateDraft({ vatRate: event.target.value })}
        />
        <label className="qf-field-label" htmlFor="qpSubtotal">
          Subtotal £
        </label>
        <input
          id="qpSubtotal"
          type="text"
          inputMode="decimal"
          className="form-input"
          value={draft.subtotal}
          onChange={(event) => updateDraft({ subtotal: event.target.value })}
        />
        <label className="qf-field-label" htmlFor="qpVatAmount">
          VAT £
        </label>
        <input
          id="qpVatAmount"
          type="text"
          inputMode="decimal"
          className="form-input"
          value={draft.vatAmount}
          onChange={(event) => updateDraft({ vatAmount: event.target.value })}
        />
        <label className="qf-field-label" htmlFor="qpTotal">
          Total £
        </label>
        <input
          id="qpTotal"
          type="text"
          inputMode="decimal"
          className="form-input"
          value={draft.total}
          onChange={(event) => updateDraft({ total: event.target.value })}
        />
      </CollapsibleSection>
    </div>
  );
}
