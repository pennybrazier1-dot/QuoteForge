# QuoteForge

Phone-first web app that helps self-employed tradespeople create and send professional quotes.

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind
- **Supabase** Auth + Postgres (workspaces, customers, proposals)
- **OpenAI** for proposal drafting
- **PDFKit** for proposal PDFs
- **Resend** for emailing proposals

This is a **web application**, not a native Expo/React Native app.

## Current stage

**Early MVP**

Implemented against Supabase: auth, onboarding, customers, AI proposals, PDF, proposal email, dashboard.

Prototype (this browser only): customer enquiry journey, site visits, Prepare Quote drafts.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env.local` and add Supabase, OpenAI, and Resend values.

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
- `docs/PREPARE_QUOTE.md` — Prepare Quote local draft behaviour
- `docs/DATABASE.md` — Supabase schema notes
