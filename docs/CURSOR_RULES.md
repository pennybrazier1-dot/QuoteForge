# Cursor Rules

## General Principles

Do not make the smallest possible code change.

If the current implementation is preventing a clean solution, refactor or rewrite it.

Prioritise code quality and user experience over preserving existing code.

Avoid technical debt.

Do not duplicate components when a shared component should exist.

Prefer reusable systems over one-off implementations.

If a feature is already solved elsewhere in the app, reuse that solution.

Always explain:
- files created
- files changed
- why the change was made
- anything that needs testing

Never change functionality unless requested.

Never remove existing functionality unless replacing it with something better.

Always preserve security and Supabase Row Level Security.

When improving layouts, prefer rebuilding rather than patching if the existing implementation is limiting the result.

## Layout Rule

Do not solve layout problems by reducing font sizes, shrinking content or hiding information.

Fix the layout system itself.

When a layout issue exists, identify the root cause before changing styling.

A correct layout engine is always preferred over visual workarounds.

## Existing Component Rule

Before creating new components or layouts, identify which component is actually being rendered.

Prefer replacing or refactoring the existing implementation rather than creating parallel components that are never used.

When redesigning a page:

1. Identify the rendered component.
2. Replace the existing JSX within that component.
3. Reuse the existing business logic.
4. Avoid leaving unused components or dead code in the project.

## Phone-first rule

QuoteForge is a **phone-first web application**.

**Do not adapt desktop layouts.** Redesign every screen from first principles for mobile use.

The primary user is an independent tradesperson:

- Standing beside their van
- Between jobs
- Sitting in their vehicle
- At the kitchen table after work
- Using one hand
- Completing tasks in 5–10 minute sessions

Design every interaction around **speed**.

The phone experience is the primary product. Desktop and tablet expand naturally from mobile layouts.

Every screen should feel **calm, obvious, and fast**.

Our mission: **Finish work. Not paperwork.**

### One question per screen

Every page answers one simple question:

| Screen | Question |
|--------|----------|
| Home | What do I need to do today? |
| Customer | What do I know about this customer? |
| Proposal | What still needs doing? |
| Job | Am I ready to start? |

Build the layout around that question. Remove anything that does not help answer it.

### Actions, not forms

Never design around forms. Design around **actions**.

- Lead with what the user can do next
- Reduce typing wherever possible
- Use large touch targets and clear language
- The software organises information automatically
- The user only describes the work — everything else happens in the background where possible

### Design for

- One-handed use
- Large touch targets (minimum 44px, prefer 48px for primary actions)
- Minimal typing
- Clear hierarchy
- Fast completion
- Thumb-friendly navigation
- Simple language

### Layout order

When redesigning any page:

1. Design the **mobile** layout first
2. Then **tablet**
3. Then **desktop**

Desktop layouts must **expand naturally** from the mobile design.

**Never** shrink desktop layouts to fit a phone.

**Never** build desktop-only layouts.

The phone experience is the product. Desktop is the enhanced version.

### Mobile layout rules

- Prefer one-column layouts on phones
- Use progressive disclosure instead of showing every option at once
- Never require horizontal scrolling
- Primary actions sit in the thumb zone (bottom half of the screen when possible)
- Forms should be short — one task per screen where possible
- Every screen should feel intentionally designed for touch input
- Do not solve layout problems by reducing font sizes, shrinking content, or hiding information — fix the layout system

### Copy

- Use short, plain English
- Prefer labels over paragraphs
- One or two word section headings where possible (Dashboard, Actions, Timeline)
- Avoid jargon

Always reuse existing components.

Never invent a new design language.