# Prepare Quote (current behaviour)

**Status:** Phase 2 — server-backed inputs, local draft output  
**Route:** `/proposals/new?enquiryId=[enquiryId]`

## Implemented

- Loads enquiry + site visit data from **Supabase** for the signed-in workspace
- Builds a structured draft (customer, scope, materials suggestions, labour lines, costs, notes)
- Does **not** invent prices, quantities, labour hours, or VAT totals
- Shows a missing-information panel for incomplete pricing / VAT / timescale / measurements
- Saves a **local draft** in `localStorage` key `quoteforge:proposal-drafts`
- Updates the server enquiry (`linked_proposal_draft_id`, status `quote_in_preparation`) when a local draft is saved
- Keeps the blank `/proposals/new` path on the existing Supabase `NewProposalForm`
- UI still says clearly that the draft is **saved on this device only**

## Not implemented yet (Phase 3)

- Saving Prepare Quote drafts as real Supabase proposals
- Sending the prepared draft by email from this path
- Shared VAT engine with proposal PDF / database columns

## Storage

| Layer | Contents |
|-------|----------|
| Supabase `enquiries` / `site_visits` | Source data for Prepare Quote |
| `localStorage` `quoteforge:proposal-drafts` | Prepare Quote drafts (still local) |

See also `docs/PHASE_2_DATA.md`.

## Related live path

Standard quotes still use Supabase via `/proposals/new` without `enquiryId`, then `/proposals/[id]` for edit, PDF, and Resend email.
