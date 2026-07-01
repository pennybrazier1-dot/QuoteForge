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