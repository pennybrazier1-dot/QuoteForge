# Stage 2 release-set handover

**Date:** 2026-11-03
**Base commit:** `8c3b109` (`Keep customer portal token crypto off the client bundle.`)
**Branch:** `main` (local working tree; not committed)

## Stage 2R status

**COMPLETE (local).** Acceptance-safety review finished. Final DB corrections accepted for inclusion in the proposed release set:

- `20261103080000_stage2r_accept_trusted_transition.sql`
- `20261103081000_stage2r_close_accept_bypasses.sql`

Isolated Stage 2R DB tests: **36 passed, 0 failed** (as reported at Stage 2R close).

This document marks Stage 2R closed for handover only.

**Not approved:** commit, push, production migrate, deploy, or production release.

## Pending Stage 2 migrations (11, apply in order)

1. `20261103010000_proposal_revisions.sql`
2. `20261103020000_proposal_revision_issuing.sql`
3. `20261103030000_proposal_revision_acceptance.sql`
4. `20261103040000_stage2j_accept_issue_safety.sql`
5. `20261103050000_stage2k_safety_corrections.sql`
6. `20261103051000_stage2k_slot_advisory_lock.sql`
7. `20261103060000_stage2l_schedule_notify_issue.sql`
8. `20261103061000_stage2l_write_slot_clear_pending.sql`
9. `20261103070000_stage2m_attempt_bound_issue.sql`
10. `20261103080000_stage2r_accept_trusted_transition.sql`
11. `20261103081000_stage2r_close_accept_bypasses.sql`

## Controlled release reminder (playbook)

1. Apply all **11** migrations in one supervised window.
2. Deploy the matching Stage 2 application **immediately after**.
3. Do not roll back to a pre–Stage 2 app after revision/issuing activity.
4. Forward-repair-only recovery stance (provisional, as previously accepted).

## Local release checks (2026-11-03)

| Check | Result |
|---|---|
| Stage 2R isolated DB (`stage2r-accept-bypass-db-test.mjs`) | **36 passed, 0 failed** |
| `npm test` (Vitest) | **128 files / 855 tests passed** |
| `npm run lint` | **0 errors**, 4 warnings in local Stage 2C/2D scripts (exclude from commit) |
| `npx tsc --noEmit` | **pass** |
| `npm run build` | **pass** (Next.js 16.2.9) |

## Next separate approvals required

1. Commit / push of the agreed release-set file list
2. Production migration of the 11 files
3. Production application deploy
4. Explicit production release approval
