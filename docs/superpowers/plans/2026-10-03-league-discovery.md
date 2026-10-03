# League Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Discover Valkyria League fixtures periodically, accept manual/human-link additions, and serve one tracked record to the website and a durable Discord card.

**Architecture:** Reuse the safe HTML fetcher, detail cache and managed publisher. Add separate index parsing, durable due-work and guild-scoped tracking; never create an operational event with invented schedule values. Native event linking is explicit and does not transfer ownership of rosters or attendance.

**Tech Stack:** TypeScript, Zod, Cheerio, Convex, Next.js, Discord.js, node:test.

**Spec:** [Approved follow-up design](../../integrations/website/roadmap/discord-league-reports-hll.md#proposed-league-discovery-system).

## Global Constraints

- Exact HTTPS Wardogs League origin; separate index and detail URL contracts; no downloaded script execution.
- Index scan every 10 minutes, tracked detail refresh every 5 minutes; shared ceiling 20 logical fetches/minute and Retry-After (up to three validated redirects per fetch; clarified during review).
- Default team VLK; additional teams configurable; bots and webhooks ignored.
- Persist deduplication, publication identity and independent tracking reasons; channel picker and pasted IDs.
- Unknown source fields stay null; no fabricated results, signup dates or native-event changes.
- Production Convex is forbidden for testing; use the authorized isolated local database/test Discord.
- All implementation, docs, review and proof remain in PR #158.

## Review Focus

- A changed team filter while a fetch is running must not publish a record under the old policy (tasks 2 and 3).
- Deleting a Discord reference must preserve an admin-pinned or automatically watched record (tasks 2 and 4).
- Restart and ambiguous Discord delivery must reuse the existing publication identity (task 4).
- Index omissions, pagination and malformed HTML must not cancel records or claim complete coverage (tasks 1 and 2).
- An API key must not read another guild, silently acquire tracking administration, or observe local private notes (task 3).

### Task 1: Safe index reads and tracking rules

**Files:** Create `src/domain/wardogs-league/discovery.ts`, `discovery.test.ts`, `src/infrastructure/wardogs-league/parse-index.ts`, `parse-index.test.ts`; modify `fetch-match.ts` and its tests.

**Interfaces:** `indexUrl(input): {id,url}`, `parseLeagueIndex(html, url): {matchUrls, incomplete}`, `fetchLeagueIndex(url, deps?)`; `trackingSettingsSchema`, `matchesWatchedTeams(snapshot, teams)`, `extractMatchUrls(content)`, `trackingDeadline(snapshot, firstSeenAt)`.

- [x] Add failing tests for exact query/redirect identity, only main-content match links, duplicate links, unsupported pagination, bot-input filtering at the runtime boundary, exact VLK versus VLK2, and seven-/fourteen-day limits.
- [ ] Run the focused tests and observe failure before implementation.
- [x] Extract bounded HTML transport with `pathname + search`, retain strict detail validation, implement pure index/rule functions and saved semantic fixtures.
- [x] Run all League parser/transport tests; expect all pass. Commit this coherent slice.

### Task 2: Durable scanner and manual registration

**Files:** Create `convex/leagueDiscoveryTable.ts`, `leagueDiscovery.ts`, `leagueDiscoveryJobs.ts`, `src/application/wardogs-league/tracking.ts` and tests; modify schema, crons and the shared League budget.

**Interfaces:** Guild settings and tracked record keyed by `(guildId,matchId)`; `configure`, `manage`, `list`, `forGuild`, `ingestMessage`; internal `claimScan`, `finishScan`, `claimDue`, `finishRead`; scheduled `collectDue` action. Persist fenced leases and recheck current settings on completion.

- [x] Test reason aggregation, ignored/pinned matches, old-history publication suppression, expired tracking and policy changes using pure transitions.
- [ ] Run failures, implement transitions, then wire transactional persistence and scheduled work.
- [x] Keep a bounded per-guild work queue over shared index/detail caches; add limits to candidates, settings, input references and each worker batch.
- [x] Verify concurrent manual/scan registration and recovery on isolated Convex. Expect one tracked identity and preserved last valid data on failure. Commit.

### Task 3: Admin controls and scoped website collection

**Files:** Create `src/components/app/league-tracking-form.tsx`, admin `league-tracking` route, `/api/v1/clan/league-fixtures/route.ts`, DTO/route tests; modify imports screen, API resources, sync records/change feed, OpenAPI and public wiki.

**Interfaces:** `LeagueFixture` contains guild/game, match ID, optional native event ID, public snapshot, revision, freshness and tracking state. Admin configuration/manual actions use durable dashboard actor authorization; website reads require an explicit `league-fixtures` grant.

- [ ] Add authorization/query/DTO regressions before implementation, including wrong game, cross-guild records, stale snapshots and native binding deduplication.
- [x] Implement categorized channel selection/ID input, VLK defaults, URL preview/add, pause/resume/ignore, existing-event link and scan health.
- [x] Add bounded list and individual sync record reads, transactional change records and matching OpenAPI schemas. Exclude service-key administration explicitly.
- [x] Run relevant tests/typecheck and inspect the actual dashboard; expect saved settings and manual fixture to survive reload. Commit.

### Task 4: Human links and compact Discord cards

**Files:** Create `discord-bot/src/league/{worker,render}.ts` and tests; modify bot startup, intent configuration and publication claim checks.

**Interfaces:** `renderLeagueCard(fixture)` returns a compact safe Discord payload; worker publishes `league:<trackedRecordId>` with a settings/record revision; message intake sends bounded human references, including edit/delete reconciliation.

- [ ] Test bot/webhook rejection, wrong channel, edits/deletes, escaping/limits, no fabricated results and publication revision changes before implementation.
- [x] Implement human-only configured intake; request privileged Message Content only through explicit environment activation, while scanner/manual tracking work independently.
- [x] Reuse managed-message leases, marker recovery and message edits. Verify unchanged message ID after restart in the authorized test room; capture sanitized evidence. Commit.

### Task 5: Acceptance, review and handoff

**Files:** Update public wiki, bot setup, API docs, follow-up status and a dated evidence folder in `docs/integrations/website/evidence/`.

- [x] Run changed-file Prettier, all tests, typecheck, build, generated API parity and secret/diff checks; expect successful commands.
- [x] Deploy Convex only to the verified isolated loopback instance, then exercise real source discovery, manual duplicate, settings revocation, API/change feed and Discord restart.
- [x] Complete independent review and code-security review, fix supported findings and rerun affected acceptance. Fresh-context spawn was unavailable; the documented existing-reviewer fallback was used.
- [ ] Record source revision, synthetic versus live checks, screenshots and production activation prerequisites. Push and publish a visible PR comment; do not merge/deploy production.

## Execution notes

The owner approved the written design and instructed implementation (`jo delej`). Execute inline in the existing feature checkout; preserve that authorization rather than introducing another permission checkpoint. HLL live panels and private reports remain separate follow-up work from the broader proposal.

## Acceptance record

Tasks 1–4 are implemented in `ad0951a`, followed by review repairs. The per-task
commit steps were consolidated into one coherent feature commit and a repair
commit in the same PR. Detailed [proof and limitations](../../integrations/website/evidence/2026-10-03-league-discovery/README.md)
are authoritative for completion. Historical pre-implementation RED runs were
not retained for every checklist item and are not retroactively claimed. Review
regressions retain explicit RED/GREEN output. The website's new external-fixture
consumer and completed-result extraction remain separate acceptance work.
