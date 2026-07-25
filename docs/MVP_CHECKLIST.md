# QuoteForge MVP

QuoteForge is currently an **early MVP**.

Core proposal creation, PDF, and email sending work against Supabase.
Enquiries and site visits persist in Supabase (Phase 2). Prepare Quote **drafts** are still browser-local.

## Core — implemented

- [x] Authentication (sign up / sign in / sign out)
- [x] Customers
- [x] Edit Customers
- [x] Dashboard
- [x] New Proposal (Supabase)
- [x] Proposal Workspace
- [x] AI Generation
- [x] PDF download
- [x] Proposal Workflow / timeline
- [x] Email UI
- [x] Real proposal email sending (Resend + PDF attachment)
- [x] Enquiries inbox and timeline (Supabase + RLS)
- [x] Site Visit Mode (Supabase + private photo storage)
- [x] Calendar site visits from server `site_visits`
- [x] Public request-quote link (`/request-quote/w/[slug]`)
- [x] Local → account enquiry migration utility (Settings)

## Still local / Phase 3

- [x] Prepare Quote from site visit (**reads** server enquiry/visit; **saves** local draft only)
- [ ] Prepare Quote → create real Supabase proposal
- [ ] Honest VAT calculation persisted on proposals

## Remaining before paid launch

- [ ] Logo upload / business branding on PDFs
- [ ] Editable business settings after onboarding
- [ ] Password recovery
- [ ] Customer portal / online acceptance
- [ ] Account deletion / privacy basics
- [ ] QuoteForge subscription billing

## Planned later

- [ ] Invoices and payment recording
- [ ] Team members
- [ ] Money / tax overview
