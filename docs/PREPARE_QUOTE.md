# Prepare Quote (current behaviour)

**Status:** Prototype (Phase 1 stabilised)  
**Route:** `/proposals/new?enquiryId=[enquiryId]`

## Implemented

- Loads enquiry + site visit data from browser storage on this device
- Builds a structured draft (customer, scope, materials suggestions, labour lines, costs, notes)
- Does **not** invent prices, quantities, labour hours, or VAT totals
- Shows a missing-information panel for incomplete pricing / VAT / timescale / measurements
- Saves a **local draft** in `localStorage` key `quoteforge:proposal-drafts`
- Links the draft id onto the local enquiry (`linkedProposalDraftId`) and marks status `quote_in_preparation`
- Keeps the blank `/proposals/new` path on the existing Supabase `NewProposalForm`

## Not implemented yet

- Saving Prepare Quote drafts to Supabase
- Creating a real QuoteForge proposal from Prepare Quote
- Sending the prepared draft by email
- Shared VAT engine with proposal PDF / database columns
- Availability on other devices or browsers

## Storage (prototype)

| Key | Contents |
|-----|----------|
| `quoteforge:enquiries` | Enquiry records |
| `quoteforge:site-visit-sessions` | Site visit capture |
| `quoteforge:proposal-drafts` | Prepare Quote drafts |
| IndexedDB `quoteforge-enquiry-photos` | Photo blobs |

## Related live path

Standard quotes still use Supabase via `/proposals/new` without `enquiryId`, then `/proposals/[id]` for edit, PDF, and Resend email.
