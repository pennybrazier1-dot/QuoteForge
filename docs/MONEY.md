# Money

The Money section gives independent tradespeople a simple view of their business finances **without requiring accounting knowledge**.

The goal is **not** to replace an accountant.

The goal is to **remove paperwork** and give tradespeople confidence that their records are organised throughout the year.

---

## What the user sees

A calm, simple overview of:

| Area | What it includes |
|------|------------------|
| **Money In** | Invoices paid |
| **Money Out** | Receipts, supplier invoices, expenses |
| **Estimated Profit** | Money in minus money out (clearly labelled as an estimate) |
| **Estimated Tax** | Based on country and tax profile (clearly labelled as an estimate) |

All tax and profit figures must be clearly marked **as estimates until verified**.

---

## Core principle: the user should rarely type

QuoteForge should organise finances automatically from sources the tradesperson already has.

### How records get into QuoteForge

- **Receipts** — photograph on site (phone camera)
- **Supplier invoices** — upload PDF or image
- **Emails** — import relevant financial emails
- **Paid invoices** — linked from QuoteForge invoicing when that exists
- **Proposals / jobs** — reuse amounts and customer context already in the system

AI categorises everything automatically.

The tradesperson reviews and confirms — they do not build spreadsheets.

---

## AI responsibilities

- Read receipts and supplier invoices (photo, PDF, email)
- Extract date, amount, supplier, and description
- Categorise as money in or money out
- Suggest expense category (materials, fuel, tools, subcontractor, etc.)
- Flag items that need human review
- Keep records searchable and organised

AI must not present tax figures as final. Always use language such as **estimated** and **for your records — verify with your accountant**.

---

## Tax and country

Tax calculations adapt automatically based on:

- The user's **selected country**
- Their **tax profile** (e.g. sole trader, VAT registered, tax year settings)

Country-specific rules live in configuration — not hard-coded assumptions in the UI.

Display copy must make clear:

- Figures are **estimates**
- QuoteForge is **not** tax advice
- The user should **verify with their accountant** before filing

---

## What Money is not

- Not a full accounting package
- Not a replacement for an accountant or bookkeeper
- Not payroll, corporation tax, or complex multi-entity accounting (unless added much later)
- Not a reason to make the tradesperson learn accounting terms

---

## Connection to the rest of QuoteForge

Money should reuse data already captured elsewhere:

| Existing area | Money use |
|---------------|-----------|
| Proposals | Expected income, accepted job values |
| Customers | Who paid, who owes |
| Jobs (future) | Link expenses to a job |
| Invoices (future) | Money in when paid |

**Enter once. Use everywhere.** The tradesperson should not re-type customer names, amounts, or job details.

---

## Design principles

Follow [FEATURE_PRINCIPLES.md](./FEATURE_PRINCIPLES.md):

- Phone-first — photograph receipts on site
- Actions, not forms — "Add receipt" opens camera, not a blank spreadsheet
- Calm and obvious — four clear numbers at the top, detail underneath
- No training required — labels in plain English, not accounting jargon

### One question for the Money screen

**How is my business doing financially?**

---

## Phasing

Money is **not** part of the current MVP (proposals and customers).

Suggested order after core quoting is stable:

1. **Receipt capture** — photo upload, AI extract amount and supplier
2. **Money Out list** — categorised expenses with search
3. **Money In** — when invoicing exists, show paid invoices
4. **Estimated profit** — simple in minus out for the tax year
5. **Estimated tax** — country profile + clear disclaimers
6. **Email import** — reduce manual upload further

Build the smallest step that saves real paperwork first. Do not ship a dashboard that requires the user to type everything in.

---

## Feature decision check

Before building any Money feature, ask:

1. Does this reduce paperwork for a sole trader?
2. Can the user do this with a photo or upload instead of typing?
3. Does AI do the organising?
4. Are estimates clearly labelled?
5. Would this help them feel confident their records are in order — without becoming an accountant?

If not, defer or simplify.

The user should never feel like they are doing bookkeeping.

They simply:

• receive money
• record expenses

QuoteForge organises everything else.

The goal is confidence, not accounting.
