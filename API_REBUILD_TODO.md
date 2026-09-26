# API Rebuild — Remaining Work

This is the active handoff checklist for finishing the authenticated clan API
and System rebuild. It is intended for one fresh-context agent working in a
substantial, coherent pass — not for splitting work across parallel agents.

## How to use this file

1. Read `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, and
   `API_REBUILD_PLAN.md` before changing behavior.
2. Check `git status` first. The rebuild worktree is intentionally uncommitted;
   preserve all unrelated changes.
3. Take one complete work package below. Do not start a second package if the
   first is not validated and documented.
4. When a package is genuinely complete, **remove its entire section from this
   file**. Do not replace it with a completed/status note.
5. If a package changes user-visible behavior, update the matching page under
   `content/` and the OpenAPI contract in the same change.
6. Do not run Convex deploy or code generation without explicit authorization.
7. Before handoff, run the validation listed in the package plus
   `git diff --check`; record only unresolved blockers in this file.

## Current implemented surface

These are done and should not be reimplemented:

- Bounded authenticated reads for events, groups, rosters, assignments,
  calendar items, stratmaps, presets, matches, articles, settings,
  performance history, and users.
- Game scope, opaque pagination, rate-limit headers, metadata, article CRUD,
  event signup, group CRUD, and calendar-item CRUD.
- Atomic idempotency for implemented writes.
- Webhook subscriptions, signing, dispatcher/retry behavior, recovery, and
  dashboard UI.
- System navigation/pages for API keys, imports, helper data, and webhooks.

## Work package: HTTP and browser verification

Current environment blocker: no automation-capable browser is attached. The
available in-app browser returned `Browser is not available: iab`; browser
checks must be completed in a session with a local browser surface and admin
and non-admin test access.

Complete final integration verification without deploying.

- Add route-level tests for malformed/missing/revoked keys, all rate-limit
  headers, cursor misuse, game scope, `updatedSince`, cross-guild resource
  access, and idempotency replay/conflict through HTTP.
- Browser-check System, Imports, Helper Data, and Webhooks as both an admin and
  non-admin. Verify editing webhook URL/event types, rotation, test delivery,
  and history pagination.
- Verify OpenAPI exactly matches the final exposed API; remove any stale claim.
- Run `npm run test`, `npm run typecheck`, `npm run build`, and `git diff
--check`.

## Known non-blocker

`npm run format:check` may still report unrelated pre-existing formatting
issues. Format only files changed by the active work package and report any
remaining repository-wide failures accurately.
