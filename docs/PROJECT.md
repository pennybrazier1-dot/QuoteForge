# QuoteForge Project Blueprint

## Product Summary

QuoteForge is an AI sales assistant and digital office for self-employed tradespeople and small trade businesses.

It helps tradespeople create professional proposals, save time on paperwork, communicate clearly with customers, and win more work.

## Target Customer

QuoteForge is built first for self-employed tradespeople and small trade businesses with 1–10 people.

Initial target trades:


- Plumbers
- Electricians
- Carpenters
- Kitchen fitters
- Builders
- Landscapers
- Painters and decorators
- Fencing contractors

These users are often responsible for quoting, admin, customer communication, job notes, and follow-up themselves.

## Core Problem

Self-employed tradespeople often create quotes after work, in the evening, or between jobs. Their paperwork can be inconsistent, slow, unclear, or difficult to find later.

This can cause:

- Lost time
- Missed follow-ups
- Unclear expectations with customers
- Poor record keeping
- Lost work
- Unprofessional presentation

## Mission

Help self-employed tradespeople look more professional, save time, stay organised, and win more work.

## Vision

Become the AI-powered digital office for independent tradespeople and small trade businesses.

QuoteForge starts with proposals and quoting, then grows into customer records, job tracking, invoicing, payment tracking, and business insights.

## Core Promise

Spend less time quoting. Win more work.

## Product Positioning

QuoteForge is not just an AI quote generator.

QuoteForge is an AI sales assistant for tradespeople.

It helps users:

- Create professional proposals
- Clarify scope of work
- Estimate time and materials
- Suggest payment terms
- Identify things to confirm
- Present optional extras clearly
- Follow up with customers
- Keep organised records

## Core Principles

### 1. Simplicity

A new user should be able to create a professional proposal in under 5 minutes.

### 2. Professionalism

Everything the customer sees should make the tradesperson look organised, trustworthy, and professional.

### 3. Save Time

Every feature must save time, reduce admin, or improve the chance of winning work.

### 4. Clarity

Quotes and proposals should make it clear what is included, what is not included, what is optional, and what may cost extra.

### 5. Secure Workspace

Each tradesperson should have their own secure workspace containing their quotes, customer details, business details, and records.

### 6. Do Not Type Twice

QuoteForge should avoid making users enter the same information repeatedly.

## Version 1 Goal

The first version should allow a tradesperson to:

1. Sign up
2. Complete onboarding
3. Log in
4. Describe a job
5. Generate a professional proposal using AI
6. Save the proposal
7. View previous proposals
8. Download or print a sharp PDF
9. Send the proposal to a customer manually by email
10. Mark the proposal as draft, sent, accepted, declined, or expired

## Version 1 Onboarding

After signup, before the dashboard, the user completes a short onboarding form.

This is required for new accounts. It creates the workspace and profile with real business details instead of placeholders.

### Fields the user must enter

| Field | Required | Notes |
|-------|----------|-------|
| Full name | Yes | The person's name |
| Business name | Yes | The trade business name |
| Business email | Yes | Main business email |
| Phone number | Yes | Business phone number |
| Trade type | Yes | Selected from the list below |
| VAT number | No | Optional |
| Default payment terms | Yes | Used on new proposals |
| How they heard about QuoteForge | Yes | Selected from the list below |

### Trade type options

- Plumber
- Electrician
- Carpenter
- Bricklayer
- Kitchen Fitter
- Builder
- Landscaper
- Painter and Decorator
- Fencing Contractor
- Roofer
- Heating Engineer
- Plasterer
- Tiler
- Window and Door Installer
- Driveway and Paving Contractor
- Drainage Specialist
- General Handyman
- Other

### How they heard about QuoteForge options

- Google
- Facebook
- TikTok
- YouTube
- Recommendation
- Local business group
- Other

### Onboarding rules

- Keep the form short and plain English.
- Do not ask for information QuoteForge does not need yet.
- After onboarding completes, redirect to the dashboard.
- Do not make the user enter the same details again later unless they choose to update settings.

## Version 1 Proposal Contents

Each proposal should include:

- Quote/proposal number
- Date created
- Tradesperson business details
- Customer details
- Job address
- Job summary
- Scope of work
- Materials
- Labour estimate
- Estimated duration
- Main price
- Optional extras
- Things to confirm
- Suggested payment terms
- Notes and exclusions
- Acceptance section
- Signature area for tradesperson and customer
- Follow-up email copy
- Follow-up SMS copy

## Quote Numbering

Each workspace should have its own automatic quote numbering.

Example:

- QF-2026-0001
- QF-2026-0002
- QF-2026-0003

Quote numbers must be unique inside each tradesperson workspace.

## Workspace Model

Each tradesperson or business has their own workspace.

A workspace should contain:

- Business name
- Contact email
- Phone number
- Trade type
- Address
- VAT number if applicable
- Default payment terms
- Proposals
- Customers
- Notes
- Later: logo and branding

Each profile should contain:

- Full name
- How they heard about QuoteForge (collected at onboarding)
- Role inside the workspace

## Version 1 Scope

Build now:

- Landing page
- Authentication
- Onboarding form
- Dashboard
- AI proposal generator
- Proposal saving
- Proposal history
- Basic customer details stored with proposal
- Proposal notes
- PDF export
- Quote status tracking
- Stripe subscription setup

Do not build yet:

- Full customer portal
- Online customer acceptance
- Invoicing
- Payment tracking
- Receipt storage
- Voice input
- Team accounts
- Complex CRM
- Calendar integration
- Mobile app

## Version 2 Roadmap

- Customer records
- Repeat client history
- Multiple jobs per customer
- Customer notes
- Job notes
- Payment history
- Business branding and logo on PDFs
- Better proposal templates
- Email sending directly from QuoteForge
- Customer acceptance link
- Convert accepted proposal into job

## Version 3 Roadmap

- Invoicing
- Payment tracking
- Job management
- Customer portal
- AI pricing insights
- Business reporting
- Tax summaries
- Receipt storage
- Material cost tracking
- Mileage tracking
- Team accounts
- Mobile app
- Integrations with accounting tools

## Feature Decision Rule

Before building any feature, ask:

Does this help a self-employed tradesperson look more professional, save time, reduce paperwork, communicate more clearly, or win more work?

If yes, consider it.

If no, move it to IDEAS.md for later.

## First 10 Paying Customers Strategy

The first customers should come from direct outreach rather than ads.

Possible channels:

- Local tradespeople
- Facebook trade groups
- Local business groups
- TikTok demo videos
- Short LinkedIn posts
- Personal network
- Free trial for feedback

Initial offer:

- Free trial or first 5 proposals free
- Then Pro plan at £19–£29 per month

## Success Criteria for MVP

QuoteForge is useful enough when a tradesperson can:

- Create a professional proposal faster than writing it manually
- Feel confident sending it to a customer
- Find previous proposals easily
- Use it again for another job
- See clear value in paying monthly

## Version 1 Checklist

### Core Platform
- [x] Authentication
- [x] Onboarding
- [x] Dashboard
- [x] Settings
- [x] Customers
- [x] Customer Notes

### Proposal Workflow
- [x] Proposal Studio
- [x] AI Proposal Generation
- [x] Accept AI Draft
- [x] Edit Draft
- [x] Delete Draft
- [x] Proposal Status Workflow
- [x] PDF Export

### Still to Complete
- [ ] Proposal List
- [ ] Send Proposal by Email