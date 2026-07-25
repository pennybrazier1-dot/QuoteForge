# Phase 2 — Lead-to-quote Supabase backbone

**Status:** Implemented in app code (2026-07-25)  
**Migration file:** `supabase/migrations/20260725120000_enquiries_site_visits_backbone.sql`

Apply this migration to your Supabase project before relying on live enquiry data:

```bash
# From the quoteforge folder, with Supabase CLI linked to your project:
npx supabase db push
```

Or paste/run the SQL in the Supabase SQL editor.

---

## New tables

| Table | Purpose |
|-------|---------|
| `enquiries` | Workspace-owned customer enquiries |
| `enquiry_timeline_events` | Chronological enquiry activity |
| `site_visits` | One site visit per enquiry (calendar source of truth) |
| `enquiry_media` | Photo metadata pointing at private Storage |

Also added:

- `workspaces.public_enquiry_slug` — opaque public intake token
- Storage bucket `site-visit-photos` (private)
- RPC `submit_public_enquiry(slug, …)` — public form insert without choosing `workspace_id`
- RPC `get_public_intake_workspace(slug)` — returns only public business name / phone / trade

## Relationships

- Enquiry → workspace (cascade delete)
- Timeline → enquiry (cascade delete)
- Site visit → enquiry (**unique** `enquiry_id` — one visit row per enquiry)
- Media → enquiry + optional site visit
- Photos stored at `{workspace_id}/{enquiry_id}/{site_visit_id|intake}/{media_id}.{ext}`

## RLS

All new tables enable RLS and restrict select/insert/update/delete to `current_workspace_id()`.

Storage policies require the first path segment to equal the current workspace id.

Public intake never accepts a client-supplied workspace id — only a validated slug.

## App routes

| Route | Behaviour |
|-------|-----------|
| `/enquiries` | Loads server enquiries |
| `/enquiries/[id]` | Loads server enquiry |
| `/site-visit/[enquiryId]` | Saves notes/checklist/photos to Supabase |
| `/calendar` | Site visits from `site_visits` (proposal jobs unchanged) |
| `/proposals/new?enquiryId=` | Prepare Quote reads server enquiry + visit; **draft stays local** |
| `/proposals/new` | Unchanged Supabase proposal form |
| `/request-quote/w/[slug]` | Public customer form → `submit_public_enquiry` |
| `/request-quote` | Dev/demo journey still saves locally |
| Settings | Public link + local→account migration utility |

## Still local (Phase 3)

- Prepare Quote drafts (`quoteforge:proposal-drafts`)
- Demo `/request-quote` without a workspace slug
- Legacy local keys kept until migration succeeds (not auto-deleted)

## Time zone

Site visit `starts_at` is stored as `timestamptz`. Calendar day grouping uses the `date_iso` field (UK calendar date chosen at booking). Display formatting uses the existing UK-friendly calendar helpers.
