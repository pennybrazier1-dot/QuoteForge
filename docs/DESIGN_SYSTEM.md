# QuoteForge Design System

## Brand

QuoteForge should feel:

- Premium
- Modern
- Professional
- Clean
- Trustworthy

Not flashy.

Not corporate.

Not cluttered.

---

## Colours

Primary Accent

QuoteForge Orange

Use only as an accent.

Orange should appear on:

- buttons
- links
- active navigation
- icons
- section headings
- divider lines
- badges

Never overuse orange.

White space should dominate.

---

## Backgrounds

App background

Very dark charcoal.

Cards

Slightly lighter.

Inputs

Slightly darker than cards.

Cards must always be clearly distinguishable from the page.

---

## Typography

Typography should feel elegant.

Avoid oversized fonts.

Avoid heavy bold text.

Use clear hierarchy.

Business names and customer names may use serif fonts where appropriate (PDF).

Everything else should use clean sans-serif typography.

---

## Borders

Rounded corners throughout.

Thin borders.

Orange used sparingly.

Never use thick outlines.

---

## Cards

Cards should have:

comfortable spacing

consistent padding

consistent radius

subtle shadows only when needed

Cards should never blend into the background.

---

## Icons

Simple outline icons.

Consistent size.

Orange.

No filled icons.

---

## Layout

Everything should align to a consistent grid.

Use generous whitespace.

Avoid clutter.

Avoid unnecessary page scrolling.

Information hierarchy should always be obvious.

---

## Phone-first

QuoteForge is a phone-first web application.

**Do not adapt desktop layouts.** Redesign every screen from first principles for mobile use.

The phone is the product. Desktop and tablet expand from it — never the other way around.

Design every interaction around **speed**.

Every screen should feel **calm, obvious, and fast**.

Our mission: **Finish work. Not paperwork.**

### One question per screen

| Screen | Question |
|--------|----------|
| Home | What do I need to do today? |
| Customer | What do I know about this customer? |
| Proposal | What still needs doing? |
| Job | Am I ready to start? |

Remove anything that does not help answer the question.

### Actions, not forms

Never design around forms. Design around **actions**.

- Lead with the next thing the user can do
- The user describes the work — the software organises everything else in the background
- Reduce typing; pre-fill and reuse data automatically
- Primary actions in the thumb zone

### Typical usage

- Next to the van
- Between jobs
- Driver's seat before leaving
- Kitchen table after work
- One hand free
- 5–10 minutes available

### Touch and interaction

| Rule | Value |
|------|-------|
| Minimum touch target | 44px |
| Preferred primary action | 48px height |
| Spacing between tappable items | At least 8px |
| Primary actions | Thumb zone — bottom of screen when possible |
| Secondary actions | Top or inline — never compete with primary |

Use `.qf-touch-target` on interactive elements that need the minimum size.

### Layout

**Mobile (default)**

- Single column
- One primary action per screen
- Progressive disclosure — show essentials first, details on tap
- No horizontal scrolling
- Page padding: 16px (`--page-padding-mobile`)
- Sticky footers for primary actions on long forms

**Tablet (640px+)**

- May introduce two columns for related content only
- Keep touch targets the same size

**Desktop (1024px+)**

- Sidebar and wider grids allowed
- More information visible at once
- Never remove mobile flows — enhance them

### Typography on phone

- Page title: 24–28px, semibold
- Section heading: 16–18px, semibold
- Body: 15–16px
- Secondary / helper: 13–14px, muted
- Avoid long paragraphs — use short lines and bullets

### Forms on phone

Avoid long forms. Prefer capture flows and actions.

When input is unavoidable:

- One field per row
- Large inputs (min 48px height)
- Use appropriate keyboard types (`tel`, `email`, `decimal`)
- Pre-fill wherever possible from existing data
- Save progress automatically where safe

### Navigation

- Primary destinations reachable in one tap from anywhere
- Back navigation always obvious
- Bottom-aligned actions for thumb reach on key flows (send, save, create)

### Language

- Short labels: Actions, Timeline, Estimate
- Plain English — write for someone tired at the end of a long day
- Error messages: say what went wrong and what to do next

### Redesign workflow

When rebuilding a screen:

1. Sketch mobile layout first (375px width)
2. Implement mobile CSS as the default — no media query required
3. Add `@media (min-width: …)` only to **add** layout at larger sizes
4. Test on a real phone before desktop

---

## PDF

The PDF is the most customer-facing part of QuoteForge.

It should feel professionally designed.

It is not simply a PDF export.

It is a branded proposal.

Typography should be elegant.

Spacing should be generous.

Content should flow naturally across A4 pages.

No unnecessary blank pages.

No oversized fonts.

No repeated information.

The proposal should make the tradesperson look premium.

## Design Principle
Every customer-facing document should look like it was designed by a professional designer, not generated by software.

The proposal is often the customer's first impression of the business.

The design should build confidence, trust and professionalism before the customer reads a single word.

QuoteForge should make every tradesperson, from sole traders to established businesses, look organised, credible and premium.

## Primary UI Reference

During the phone-first redesign, each screen is rebuilt from mobile first.

Once a screen is redesigned, it becomes the reference for that flow.

Shared patterns across all screens:

- Card layouts
- Typography
- Spacing and touch targets
- Borders and colours
- Action-first layout (not form-first)
- Section hierarchy

New pages should reuse existing QuoteForge components wherever possible.

Do not invent new layouts or styling for individual pages unless there is a clear functional reason.

The application should feel like one cohesive product, not a collection of separate screens.

## Headings

Use short, clear section headings.

Prefer one or two words wherever possible.

Examples:

Dashboard

Customers

Proposals

Actions

Timeline

Estimate

Site Notes

Avoid long descriptive headings when a simple label is sufficient.

The interface should be easy to scan at a glance.