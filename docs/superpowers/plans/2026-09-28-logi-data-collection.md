# Logi Provider Data Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Agent delegation requires explicit authorization; it is not necessary for this plan.

**Goal:** Collect HLL/WDG status and session data in Logi, expose safe snapshots,
and establish explicit result provenance without inventing unavailable data.

**Architecture:** Provider adapters call approved origins from bounded Convex
actions. Domain normalization and use-cases depend on ports; transactional Convex
mutations fence collection runs and persist observations. The website reads only
scoped projections.

**Tech Stack:** Existing TypeScript, Zod, Convex, Node test runner/tsx, Next.js and
Discord runtime. Native fetch; no new database, broker or provider library required.

**Spec:** [Proposed integration design](../../integrations/website/roadmap/design.md)
and [pinned research](../../integrations/website/roadmap/research.md).

## Implementation record — 2026-09-28

D1–D3 are implemented together in [handoff 0.5](../../integrations/website/v0.5/README.md). The checkboxes record local implementation and offline evidence, not hosted acceptance. D4 remains pending. The PR pins the tested SHA.

Adjustments after provider research: use Node HTTPS with DNS destination pinning instead of native fetch in production; omit lease renewal because the 30-second work budget is shorter than the 60-second lease; use resumable full HLL sweeps because offset pagination is not a durable cursor. Pending IDs commit with each session, and unfinished IDs are revisited independently. Interfaces were narrowed to snapshot and history use-cases rather than a generic provider framework. Three coupled tasks ship in one coherent commit. Private player identities remain unresolved until I5/D4.

## Global Constraints

- Logi owns operational events, signups, rosters, results and provider observations.
- The website owns CMS, translations, publication consent, sessions, site grants and derived caches.
- Website writes are out of scope until a per-actor command contract is accepted.
- Never send Logi's global bot token, internal Convex secret or provider credentials to the website/browser.
- Preserve opaque identity `(sourceInstanceId, guildId, gameId, resourceKind, externalId)`; never join people by nickname.
- Map route `hll` to website `hell-let-loose` to Logi `hell_let_loose`; map `wardogs` explicitly. Never use `game=all` for a scoped consumer.
- Unknown data is nullable; timeout is not offline, absence is not zero, and telemetry is not a confirmed result.
- No live credentials, deployment, hosted settings changes or Discord actions are part of offline implementation.
- Preserve existing toolchains and inward domain/application dependencies; update API, wiki and locale parity with each feature.

## Review Focus

1. A disabled/reconfigured connection receives a delayed successful response: D1 rejects its old generation/fence.
2. A player changes nickname or two people share it: D2/D4 preserve unresolved identity without linking accounts.
3. New HLL sessions arrive during offset pagination: D2 overlap/deduplication completes without losing a finished session.
4. A WDG restart changes instance ID or drops an optional capability: D3 retains stable connection identity and marks unsupported data.
5. Two result confirmations race or a reimport changes facts: D4 keeps one accepted revision and requires an explicit correction.

## Shared interface decisions

D1 creates `src/domain/game-data/contracts.ts` with runtime Zod schemas and their
inferred types. Opaque IDs/timestamps are strings; counters are safe integers.

- `DataConnection`: `id`, `guildId`, `gameId`, `provider`, `providerServerId`,
  `origin`, nullable `secretRef`, `generation`, `enabled` and `capabilities`.
- `ProviderObservation`: `connectionId`, `observedAt`, nullable `providerUpdatedAt`,
  safe `displayName`, `state`, nullable `map`, `players`, `capacity`,
  nullable `providerInstanceId` and nullable sanitized `errorCategory`.
- `ProviderSession`: connection/external ID, nullable start/end times,
  `participants: { id, label, score: number | null }[]`, source digest and private
  `players: { platform, platformId, metrics: Record<string, number | null> }[]`.
- `SessionPage`: `sessions: ProviderSession[]`, nullable opaque `nextCursor`.
- `ProviderDependencies`: injected `fetch`, clock, secret resolver and approved
  destination policy; secrets never belong to a domain object or returned DTO.
- `GameDataProvider`: `readSnapshot(connection, deps): Promise<ProviderObservation>`
  and optional `readSessions(connection, cursor, deps): Promise<SessionPage>`.
- `GameDataRepository`: claim/renew fenced run; upsert observations/sessions;
  commit page and checkpoint atomically; complete/retry only the current fence.

### D1 — Provider contracts, persistence, snapshot API and configuration

**Owner/dependencies:** Logi; current scoped-key foundation only.

**Files:** Create `src/domain/game-data/contracts.ts`, `policy.ts`, `policy.test.ts`;
`src/application/game-data/collect-snapshot.ts`, `collect-snapshot.test.ts`;
`src/infrastructure/game-data/provider-http.ts`, `provider-http.test.ts`;
`convex/gameData.ts`, `convex/gameDataCollector.ts`;
`src/infrastructure/convex/game-data.test.ts`;
`src/components/app/game-data-connections.tsx`;
`src/app/api/servers/[serverId]/game-data/route.ts`.
Modify `convex/schema.ts`, `convex/crons.ts`, `convex/publicApi.ts`,
`src/domain/api/key-access.ts`, `src/lib/public-api.ts`,
`src/app/api/v1/clan/[[...path]]/route.ts`, `src/app/api/v1/openapi.json/route.ts`,
the System page and EN/CS/DE dictionaries. Add resource labels to
`src/components/app/api-key-manager.tsx`; document in `content/configuration/settings.mdx`.

**Interfaces:** Produce the shared types above,
`collectSnapshot(connection: DataConnection, ports: { provider, repository, now }): Promise<RunOutcome>`
and scoped `server-snapshots` / `integration-health` reads. `RunOutcome` is
`completed | retry_scheduled | unavailable | stale_fence`, with a sanitized cause.
Session-only configuration supports enable/disable and operator secret references;
bearer keys cannot create connections or broaden their own grants.

- [x] Write `disabled generation rejects late success`, `timeout preserves last success and unknown state`, `zero players is preserved`, `cross-game key cannot read snapshot`, and `redirect cannot forward credentials` tests. Assert 180-second stale and 15-minute unavailable thresholds with an injected clock. Run the new test files with `node --import tsx --test`; confirm failure before implementation.
- [x] Implement the contracts, repository ports and bounded HTTP adapter. Persist 60-second leases without renewal for bounded actions, 10-second request deadlines, three attempts per retry cycle with a cooldown, and 30-second work budgets. Implement snapshot reads from storage, never provider calls from public GETs. Use fake providers until D2/D3.
- [x] Add the administrator configuration form, nullable health display and explicit unsupported state; never echo secret values. Run the focused tests plus `npm run typecheck`, all affected HTTP/OpenAPI tests and direct ESLint/Prettier. Capture actual EN/CS and narrow-layout screenshots against simulated providers. Verify permission denial and connection disable during an in-flight run.
- [x] Update runtime schemas, OpenAPI, wiki and a new versioned fixture handoff. Explicitly stage task files and commit the coherent D1–D3 milestone as `feat(integrations): collect HLL and Wardogs data for websites`.

### D2 — HLL CRCON snapshot and completed-session collector

**Owner/dependencies:** Logi; D1. Actual CRCON account/version acceptance is deferred.

**Files:** Create `src/infrastructure/game-data/hll-crcon.ts`, `hll-crcon.test.ts`,
`src/application/game-data/collect-sessions.ts`, `collect-sessions.test.ts`;
synthetic fixtures under `src/infrastructure/game-data/fixtures/hll/`.
Modify `convex/gameDataCollector.ts`, `convex/gameData.ts`, and
`src/lib/server-match-results.ts` only to extract reusable normalization without
calling its legacy name/nickname linking path.

**Interfaces:** Export `hllCrconProvider: GameDataProvider`; produce normalized
`ProviderSession` records keyed by connection + CRCON map/session ID.
`collectSessions(connection, ports): Promise<RunOutcome>` commits pages and
checkpoints through D1's repository. Player attribution uses verified platform links.

- [x] Write tests `CRCON map envelope failure is not an empty server`, `same session reimport is idempotent`, `new head page does not skip finished sessions`, `unfinished session is provisional`, and `nickname collision never links`. Assert two identical external IDs on different connections remain separate. Run the two new test files and observe the expected failures.
- [x] Implement the pinned provider contract: `get_public_info`, `get_scoreboard_maps` with explicit server/page/limit, and `get_map_scoreboard` by opaque external ID. Validate body envelopes; retain only required private facts. Poll status at 60 seconds. Run bounded full discovery sweeps with a five-minute pause after completion, replay/rewind of page hints and idempotent upserts. Revisit stored unfinished session IDs independently of the discovery watermark. A persisted page number is a hint, not a stable provider cursor after restart.
- [x] Run both new files and the existing summary/Convex scope tests; inject timeout, 429, invalid JSON, reordered pages and a crash between provider response and database commit. Prove restart replays safely. Run typecheck and task-file lint/format checks; no live CRCON calls.
- [x] Add synthetic HLL wire-to-domain fixtures and documented permission/version requirements. Include D2 in the explicitly staged collector milestone commit.

### D3 — Wardogs capability-aware reads and optional directory fallback

**Owner/dependencies:** Logi; D1. Default disabled until a source is selected.

**Files:** Create `src/infrastructure/game-data/wardogs-rcon.ts`,
`wardogs-rcon.test.ts`, `wardogs-public-directory.ts`,
`wardogs-public-directory.test.ts`; fixtures under
`src/infrastructure/game-data/fixtures/wardogs/`. Modify provider registration in
`convex/gameDataCollector.ts` and the D1 configuration/health display.

**Interfaces:** Export `wardogsRconProvider` and `wardogsDirectoryProvider`, both
implementing `GameDataProvider`. Direct live reads do not advertise historical
sessions without verified history support. Warcon remains an optional later
adapter to an existing instance, not a dependency to install/deploy here.

- [x] Write tests `capability absent remains unsupported`, `three faction scores survive normalization`, `server restart changes instance not identity`, `directory 304 keeps provider observation time`, `missing region/server is unknown`, and `read adapter never sends mutation methods`. Include timeout/403 and malformed success bodies. Run both new test files and observe failure.
- [x] Implement only allowed reads of the direct console protocol and preserve capability provenance. For the optional directory adapter, use its [OpenAPI](https://api.wardogservers.com/openapi.json), explicit stable server/join ID, ETag and `meta` freshness; discard unneeded fields. Respect the provider's refresh interval. Never silently switch provider trust levels or forward RCON passwords to a directory.
- [x] Verify direct transport refuses public plaintext secrets and redirects; provider generation changes reject pending responses. Run tests, typecheck, lint and formatting. Capture any changed configuration/status presentation with synthetic data. Keep live provider behavior marked unverified.
- [x] Document provider selection, public-data attribution and unsupported player/history/controls states. Include D3 in the explicitly staged collector milestone commit.

### D4 — Verified player links and reviewed result revisions

**Owner/dependencies:** Logi; D1/D2 contracts, D3 fixtures for multi-faction cases,
I5 for verified Steam attribution. Collection/result review can keep players
unresolved before I5; imported/submitted IDs do not become verified by migration.

**Files:** Create `src/domain/game-data/player-link.ts`, `player-link.test.ts`,
`src/domain/match-results/result-revision.ts`, `result-revision.test.ts`,
`src/application/match-results/confirm-result.ts`, `confirm-result.test.ts`,
`convex/eventResults.ts`, `src/domain/api/result-summaries.ts` and matching tests.
Create `src/app/api/servers/[serverId]/events/[eventId]/results/route.ts` for the
session-authorized revision lifecycle. Modify `convex/schema.ts`, `convex/events.ts`
and `src/components/app/submit-match-results-button.tsx`; preserve existing import
callers while adding explicit confirmation. Extend D1's API/grant/UI/docs set.

**Interfaces:**
`resolveLinkedPlayer(platform, platformId, verifiedLinks): LinkedPlayer | UnresolvedPlayer`;
`confirmResult(input: { eventId, expectedRevision, sessionLinks, actor }, ports): Promise<ResultRevision>`.
`ResultRevision` contains version, participants, nullable scores, provenance,
`provisional | confirmed | corrected`, reviewer/time and optional superseded revision.
Actor is obtained from trusted session/bot context, never caller-supplied authority.

- [ ] Write tests `import cannot confirm`, `reimport cannot overwrite confirmed revision`, `concurrent confirmations conflict`, `correction retains prior audit`, `0 differs from null`, `multi-faction result is not coerced`, and `unverified platform ID remains unresolved`. Run the new tests and observe failures.
- [ ] Implement explicit session/event linking and append-only confirmation/correction with compare-and-set. Keep current 0.4 `match-summaries` unchanged; expose the new scoped `result-summaries` DTO. Never auto-upgrade old imported results to confirmed. Human confirmation/linking require the documented session-only management route; clan bearer keys cannot perform them until actor delegation is accepted.
- [ ] Run the result/player/link tests, HTTP/OpenAPI scope tests, full suite and typecheck; test forbidden tenant/game/actor paths. Verify reviewer UI and correction history with simulated data/screenshots. Regenerate API schemas through tooling, not manual generated-file edits.
- [ ] Publish versioned result fixtures including no result, provisional, confirmed, corrected and N-participant cases; include consumer mapping notes. Commit `feat(results): add reviewed result provenance and safe projections`.

## Acceptance and handoff

Task tests are required checks, not results already obtained. Each task supplies
its own exact tested revision and reports baseline failures separately. Re-read
AGENTS and refresh the base before implementation. Real provider IDs/credentials,
network reachability and hosted rollout remain an independent acceptance gate.
