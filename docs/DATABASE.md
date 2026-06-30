# QuoteForge Database Plan

This document describes the database structure for QuoteForge and matches the pending migration files in `supabase/migrations/`.

QuoteForge is a digital office for self-employed tradespeople and small trade businesses. The database is designed around one core rule:

**Every business has its own secure workspace.**

Users should only be able to access data that belongs to their own workspace.

---

## Signup bootstrap (required app flow)

Supabase Auth handles signup and login, but QuoteForge still needs its own tenant setup.

**We do not use an `auth.users` database trigger in v1.**

After signup, the app must run this onboarding flow in a server action:

1. Check whether the user already has a row in `profiles`.
2. If not, create a `workspaces` row:
   - `owner_id` = the authenticated user's ID
   - `business_name` = a sensible default (for example from the user's email or name)
   - `contact_email` = the user's email if available
3. Create a `profiles` row:
   - `id` = the authenticated user's ID
   - `workspace_id` = the new workspace ID
   - `role` = `owner`
4. Redirect the user to the dashboard.

### Why this matters

Without a workspace and profile, `current_workspace_id()` returns `null` and Row Level Security will block access to customers and proposals.

### Database support for onboarding

- `profiles.id` is the same UUID as the Supabase Auth user.
- `workspaces.owner_id` references the founding user.
- A unique index on `workspaces.owner_id` enforces one founding workspace per user in v1.
- Profile insert policy only allows a user to create their own profile in a workspace they founded.

---

## Database helper functions

### `public.current_workspace_id()`

**Implemented in:** `20260630122600_create_workspace_and_profiles.sql`

Returns the logged-in user's `workspace_id` from `profiles`.

Used by RLS policies on `workspaces`, `profiles`, `customers`, and `proposals` to scope data to the user's workspace.

```sql
select workspace_id from public.profiles where id = auth.uid()
```

### `public.is_workspace_member(target_workspace_id uuid)`

**Planned.** Not in the current migration files.

Will return `true` when the authenticated user has a profile in the given workspace. Intended for team-ready RLS when multiple users share one workspace.

### `public.has_workspace_role(target_workspace_id uuid, allowed_roles text[])`

**Planned.** Not in the current migration files.

Will return `true` when the authenticated user has one of the allowed roles in the given workspace. Intended for owner/admin-only actions such as updating business settings or inviting team members.

### `public.allocate_proposal_number(target_workspace_id uuid)`

**Implemented in:** `20260630122700_create_customers_and_proposals.sql`

Atomically allocates the next proposal number for a workspace. Must be called from server-side code, never from the browser.

The function:

1. Verifies `target_workspace_id` matches `current_workspace_id()`
2. Locks the workspace row with `FOR UPDATE`
3. Increments `next_proposal_number`
4. Returns a formatted number like `QF-2026-0001`

---

## 1. Workspaces

Workspaces are **business accounts**, not individual user accounts.

A workspace represents the tradesperson's business inside QuoteForge. It holds business details, proposal numbering settings, and is the tenancy boundary for customers and proposals.

For v1, each founding user creates one workspace. Later, multiple profiles (people) can belong to the same workspace when team accounts are added.

### Main fields

| Field | Purpose |
|-------|---------|
| `id` | UUID primary key |
| `owner_id` | Supabase Auth user who founded the business |
| `business_name` | Trade business name |
| `contact_email` | Main business email |
| `phone` | Business phone number |
| `address_line_1`, `address_line_2`, `town`, `county`, `postcode`, `country` | Business address |
| `vat_number` | Optional VAT number |
| `default_payment_terms` | Default wording used on proposals |
| `proposal_number_prefix` | Prefix for proposal numbers, e.g. `QF` |
| `next_proposal_number` | Counter used by `allocate_proposal_number()` |
| `created_at` | When the workspace was created |
| `updated_at` | When the workspace was last updated |

### Relationships

- One workspace has one founding owner through `owner_id`.
- One workspace can have many profiles (people).
- One workspace can have many customers.
- One workspace can have many proposals.

### Constraints

- `workspaces_owner_id_unique_idx` — one founding workspace per auth user in v1.
- `owner_id` uses `on delete restrict` so business data is not silently removed if an auth user is deleted.

---

## 2. Profiles

Profiles represent **people/users inside a workspace**.

Supabase Auth stores login credentials. Profiles connect an authenticated person to the QuoteForge workspace they belong to.

### Profile roles

| Role | Purpose |
|------|---------|
| `owner` | Founded the business. Full access. Used in v1 onboarding. |
| `admin` | **Planned.** Can manage workspace settings and invite team members. |
| `member` | **Planned.** Can use the workspace day to day with standard access. |

**Current migrations:** only `owner` is enforced by the database check constraint. `admin` and `member` are reserved for a future migration when team accounts ship.

### Main fields

| Field | Purpose |
|-------|---------|
| `id` | UUID primary key, same as Supabase Auth user ID |
| `workspace_id` | Workspace this person belongs to |
| `full_name` | Optional display name |
| `role` | `owner`, `admin`, or `member` (v1: `owner` only) |
| `created_at` | When the profile was created |
| `updated_at` | When the profile was last updated |

### Relationships

- One profile belongs to one Supabase Auth user.
- One profile belongs to one workspace.
- One workspace can have many profiles when team accounts are added.

---

## 3. Customers

Customers are the people and businesses a tradesperson quotes for.

### Main fields

| Field | Purpose |
|-------|---------|
| `id` | UUID primary key |
| `workspace_id` | Owning workspace |
| `name` | Customer name |
| `email` | Optional email |
| `phone` | Optional phone |
| `address_line_1`, `address_line_2`, `town`, `county`, `postcode`, `country` | Customer address |
| `notes` | Internal notes |
| `created_at` | When created |
| `updated_at` | When last updated |

### Relationships

- One customer belongs to one workspace.
- One customer can have many proposals.

---

## 4. Proposals

Proposals are quotes created by the tradesperson. They are the first core workflow in QuoteForge.

### Proposal lifecycle statuses

| Status | Meaning |
|--------|---------|
| `draft` | Being written. Not ready to send. |
| `ready` | **Planned.** Finished and ready to send. |
| `sent` | Sent to the customer. |
| `accepted` | Customer accepted the proposal. |
| `declined` | Customer declined the proposal. |
| `expired` | Proposal passed its validity date without acceptance. |
| `cancelled` | **Planned.** Withdrawn by the tradesperson. |
| `completed` | **Planned.** Work finished after acceptance. |

**Current migrations:** `draft`, `sent`, `accepted`, `declined`, `expired`.

Statuses marked **Planned** are reserved for a future migration.

### Proposal lifecycle date fields

| Field | Purpose |
|-------|---------|
| `created_at` | When the proposal was created |
| `updated_at` | When the proposal was last changed |
| `sent_at` | When the proposal was sent |
| `accepted_at` | When the proposal was accepted |
| `declined_at` | **Planned.** When the proposal was declined |
| `expired_at` | **Planned.** When the proposal expired |
| `completed_at` | **Planned.** When the work was completed |
| `valid_until` | **Planned.** Proposal validity deadline |

**Current migrations:** `created_at`, `updated_at`, `sent_at`, `accepted_at`, `expires_at`.

`expires_at` in the current schema serves a similar purpose to `valid_until`. The planned rename to `valid_until` and additional date fields will come in a future migration.

### Customer snapshot fields

When a proposal is created, customer details are copied onto the proposal so historical documents stay accurate even if the live customer record changes later.

| Field | Purpose |
|-------|---------|
| `customer_id` | Optional link to the live customer record |
| `customer_name` | Snapshot of customer name |
| `customer_email` | Snapshot of customer email |
| `customer_phone` | Snapshot of customer phone |
| `customer_address` | Snapshot of customer address |

### Money fields

All amounts are stored in the smallest currency unit (pence for GBP).

| Field | Purpose |
|-------|---------|
| `subtotal_amount` | Subtotal in pence |
| `vat_amount` | VAT in pence |
| `total_amount` | Total in pence |
| `currency` | Currency code, default `GBP` |

### Content fields

| Field | Purpose |
|-------|---------|
| `proposal_number` | Human-readable number, unique per workspace |
| `title` | Short proposal title |
| `job_address` | Where the work will happen |
| `rough_notes` | Original rough job notes |
| `scope_of_work` | Proposed scope of work |
| `materials` | Materials as JSON |
| `labour` | Labour as JSON |
| `optional_extras` | Optional extras as JSON |
| `things_to_confirm` | Questions to confirm with the customer |
| `payment_terms` | Payment terms shown on the proposal |
| `notes_and_exclusions` | Exclusions and clarifying notes |

### Proposal numbering

Proposal numbers must not be generated in the browser.

Use `allocate_proposal_number(workspace_id)` from a server action. It returns values like `QF-2026-0001`.

---

## 5. Proposal status events

**Planned.** Not in the current migration files.

`proposal_status_events` will store an audit trail when a proposal status changes, including optional notes.

### Planned fields

| Field | Purpose |
|-------|---------|
| `id` | UUID primary key |
| `workspace_id` | Owning workspace |
| `proposal_id` | Related proposal |
| `from_status` | Previous status (nullable for first event) |
| `to_status` | New status |
| `note` | Optional note explaining the change |
| `created_by` | User who made the change |
| `created_at` | When the change happened |

### Why it will exist

Status events support customer history, follow-up tracking, and team accountability without overloading the `proposals` row with notes on every change.

---

## Security model

QuoteForge uses Supabase Row Level Security on all tables.

### Core rule

Users can only access data in their own workspace.

### How it works today

| Table | Access rule |
|-------|-------------|
| `workspaces` | `id = current_workspace_id()` for select/update; insert when `owner_id = auth.uid()`; delete when `owner_id = auth.uid()` |
| `profiles` | `workspace_id = current_workspace_id()` for select; users create/update their own profile |
| `customers` | `workspace_id = current_workspace_id()` |
| `proposals` | `workspace_id = current_workspace_id()`; linked `customer_id` must belong to the same workspace |

### How it will work with team accounts

When `is_workspace_member()` and `has_workspace_role()` are added:

- Any workspace member can read workspace data.
- `owner` and `admin` roles can update business settings.
- `owner` can delete the workspace.
- Status events and role-based restrictions will use `has_workspace_role()`.

---

## Migration files

| File | Creates |
|------|---------|
| `supabase/migrations/20260630122600_create_workspace_and_profiles.sql` | `set_updated_at()`, `current_workspace_id()`, `workspaces`, `profiles`, RLS |
| `supabase/migrations/20260630122700_create_customers_and_proposals.sql` | `customers`, `proposals`, `allocate_proposal_number()`, RLS |

### Implemented now

- Workspaces as business accounts
- Profiles as people inside workspaces
- Profile role `owner` (v1)
- `current_workspace_id()`
- Atomic proposal numbering
- Customer snapshot fields on proposals
- Proposal statuses: `draft`, `sent`, `accepted`, `declined`, `expired`
- Proposal dates: `created_at`, `updated_at`, `sent_at`, `accepted_at`, `expires_at`
- Signup bootstrap requirement in app code

### Planned in future migrations

- Profile roles `admin` and `member`
- `is_workspace_member()` and `has_workspace_role()`
- Additional proposal statuses: `ready`, `cancelled`, `completed`
- Additional proposal dates: `declined_at`, `expired_at`, `completed_at`, `valid_until`
- `proposal_status_events` table
