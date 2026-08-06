# Reanvil

Reanvil is the operating system for modern trades businesses.

Phone-first web app that helps self-employed tradespeople create and send professional quotes.

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind
- **Supabase** Auth + Postgres (workspaces, customers, proposals)
- **OpenAI** for proposal drafting
- **PDFKit** for proposal PDFs
- **Resend** for emailing proposals

This is a **web application**, not a native Expo/React Native app.

## Current stage

**Early MVP (Phase 2 data backbone)**

Implemented against Supabase: auth, onboarding, customers, AI proposals, PDF, proposal email, dashboard, **enquiries, site visits, site-visit photos (private Storage + signed URL display), calendar site visits, public request-quote links**.

Still local: Prepare Quote **drafts** (`quoteforge:proposal-drafts`). Demo `/request-quote` without a workspace slug also remains local for testing. IndexedDB photo blobs are only a fallback for unsynced local photos.

See `docs/PHASE_2_DATA.md` for schema, RLS, storage, and migration steps.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env.local` and add Supabase, OpenAI, and Resend values.

In Vercel, set the same environment variables under **Project → Settings → Environment Variables**. Display name for the Vercel project can be **Reanvil**.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local development |
| `npm test` | Vitest suite |
| `npm run lint` | ESLint |
| `npm run build` | Production build |

## Docs

- `docs/PRODUCT_VISION.md` — product intent
- `docs/MVP_CHECKLIST.md` — implemented vs prototype vs planned
- `docs/PREPARE_QUOTE.md` — Prepare Quote behaviour (server inputs, local draft)
- `docs/PHASE_2_DATA.md` — Enquiries / site visits / photos / public intake
- `docs/DATABASE.md` — Supabase schema notes
