# Durable Warcon History Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan inline, task by task. Steps use checkbox syntax for tracking.

**Goal:** Retain completed Warcon games and player outcomes, and supply consistent local history and reproducible faction/player reports to Logi and the website backend.

**Architecture:** Extend normalized sessions additively and archive Warcon facts in a workspace/source-owned table during the existing collector transaction. Page reads from retained facts have revision-bound cursors; a shared report builder consumes every page before publishing totals. This avoids database queries that scan an unlimited history or silently report a truncated ranking as complete.

**Tech Stack:** TypeScript, Zod, Convex, Next.js, React, node:test; existing dependencies only.

**Spec:** [Research, observed contract and proposed behavior](../../integrations/website/v0.11/history-analytics-gap.md). User instructed continuation after this concrete proposal. Execution is inline in the existing PR branch; documentation, verification and final security review remain in PR #158.

## Global Constraints

- Use only the authorized local Convex instance for deployment/fixtures; no production database writes.
- Stable source identity includes workspace, HTTPS origin and Warcon server ID, never a credential or nickname.
- An observed faction is not a clan; a provider player is not a verified Logi member.
- Preserve null outcome/coverage; never create a winner for an unfinished or result-less game.
- Per-page reads scan at most 20 history rows. Reports become complete only after every page of the same revision is consumed.
- New `server-game-history` API access is an explicit Wardogs read grant; legacy keys do not inherit it.
- Keep source facts after a collector is disabled or temporarily unavailable. Retention does not relax key or dashboard authorization.
- Keep the separate team-directory specification pending; no team-directory code is part of this increment.

## Review Focus

- A correction, repeated page or credential rotation must not add another win (tasks 1 and 2).
- Concurrent imports must invalidate a paged report instead of mixing revisions (task 2).
- A reused provider match ID with a different start time must be rejected rather than overwrite another game (task 1).
- A player without a known outcome, without deaths or without feed coverage must not gain an invented win, K/D or combat value (task 2).
- Disabled sources preserve retained history, but revoked keys, removed admins and other workspaces cannot read it (tasks 2 and 3).

### Task 1: Preserve and archive completed facts

**Files:** Modify `src/domain/game-data/contracts.ts`, `src/infrastructure/game-data/warcon.ts`, `convex/gameDataValidators.ts`, `convex/schema.ts`, `convex/gameDataHistory.ts`; create `src/domain/game-data/history.ts`, `convex/gameHistoryStore.ts`; extend nearby provider/Convex tests.

**Interfaces:** `ProviderSession.warcon` is optional versioned provider metadata; player facts have optional name/faction/result. `archiveWarconHistory(ctx, connection, session)` transactionally upserts a retained record keyed by guild, stable source and external match ID, updates a guild history revision only when normalized facts change, and emits an integration change.

- [x] Add failing tests that retain winner/colors/player outcomes, preserve nulls, reject invalid identities and distinguish result-less games from decisions.
- [x] Add failing archive tests for replay, correction, source isolation, credential rotation and conflicting start times.
- [x] Implement pure validation/mapping and Convex storage; keep old HLL/session records compatible.
- [x] Run provider and real-handler tests; require zero failures. Commit this slice.

### Task 2: Scoped history reads and complete reports

**Files:** Create `convex/gameHistoryReads.ts`, `src/domain/game-data/history-report.ts`, `src/application/game-data/history-report.ts`, `src/lib/api/game-history-route.ts`, their tests and `src/app/api/v1/clan/server-game-history/route.ts`; modify key validators/manager, integration change contracts/projection, OpenAPI components/routes.

**Interfaces:** `HistoryRecord` includes normalized retained facts and opaque source ID. `HistoryPage` has `items`, `revision`, `nextCursor`, coverage timestamps. `buildHistoryReport(readPage)` consumes revision-consistent pages, replaces contributions by record ID and returns totals/faction shares/player metrics only at completion. `gameHistoryReads.read` rechecks current key/admin scope and supports detail ID, source/map and UTC from/until filters.

- [x] Add failing authorization, pagination/filter/cursor, correction/revision and nullable-metric tests.
- [x] Implement signed cursors bound to caller/workspace/filter/revision; stale pages return reset-required.
- [x] Implement deterministic report aggregation: known match outcomes, explicit player outcomes, eligibility thresholds, nullable K/D, numeric metric coverage and latest observed name.
- [x] Expose collection/detail reads and reconciliation projection with an explicit read grant. Document that an API consumer uses the shared bounded page-to-report helper for full rankings.
- [x] Generate OpenAPI, run scoped tests/typecheck and commit.

### Task 3: Dashboard, local acceptance and review

**Files:** Create `src/components/app/game-history-panel.tsx` and the dashboard history route; integrate with `src/components/app/game-data-connections.tsx`; add wiki/API/operator documentation and sanitized evidence.

**Interfaces:** The panel uses the same read DTOs/report rules through an actor-authorized route. It shows collection coverage, faction win counts/shares and sortable eligible player rows, with history/detail navigation. It aborts pending loads and never labels a partial/failed scan complete.

- [x] Add relevant HTTP/report cancellation and boundary tests, then implement the dashboard panel and English/Czech copy.
- [x] Regenerate Convex bindings, run the full test suite/typecheck/build, and deploy only to the guarded local runtime.
- [x] Exercise actual Warcon -> local retained facts -> HTTP history/report reads; test replay/correction/revocation using synthetic local fixtures. Record source revisions and aggregate-only proof.
- [x] Verify the dashboard in the browser and capture actual screenshots without exposing real player identities in public evidence.
- [x] Run code/security review, fix actionable findings with regression tests, update docs and publish a visible PR comment with passed/unrun boundaries.

## Self-review decisions

- Local history is intentionally independent of live connection enablement/generation. Current credentials and permissions govern new provider reads; archived rows retain their original source ownership.
- Full reports use bounded consistent pages rather than a hard-coded "latest N matches" cutoff. An interrupted, over-budget or stale scan is incomplete and may not be used as a finished leaderboard.
- Timeline samples and upstream presentation awards remain available through the existing provider view; this increment retains the facts required to recompute requested historical statistics.
- No official clan/League result is confirmed and no Steam/Discord account is linked by collection.
