# Logi Website Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Website tasks belong to that repository's owner; this Logi workstream does not edit it.

**Goal:** Show approved Logi events/results on the unified website with durable
recovery, explicit freshness, safe deletion handling and consent withdrawal.

**Architecture:** Logi publishes scoped projections and transactional change
records. A website worker stores derived data, inbox and checkpoints in the
existing PostgreSQL database; the website owns editorial and publication gates.

**Tech Stack:** Logi's existing Convex/TypeScript/node:test; website's existing
Next.js/TypeScript, PostgreSQL/Drizzle, pnpm, Vitest and Playwright. No new broker.

**Spec:** [Integration design](../../integrations/website/roadmap/design.md) and
[research](../../integrations/website/roadmap/research.md); current wire examples
are [handoff 0.4](../../integrations/website/v0.4/README.md).

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

1. Same external ID appears in two games/guilds: W1's unique composite reference prevents cross-scope overwrite.
2. Empty page has a continuation, or a row changes during a sweep: W1/W3 never treat page content as a completed watermark/snapshot.
3. Process dies after durable insert but before webhook ACK: W3 accepts the duplicate without losing or double-publishing work.
4. A delayed refetch arrives after deletion or withdrawal: W3/W4 revision and publication fences keep it hidden.
5. A consumer is offline longer than change retention: W2/W3 require explicit bootstrap rather than silently skipping history.

### W1 — Consume existing summaries and render approved records

**Owner/dependencies:** Website team, using Logi PR #158 fixtures. No dependency on
new collectors or Logi SSO. Hosted provider remains disabled until accepted.

**Files (website repository):** Create
`apps/web/src/modules/integrations/logi/config.ts`, `client.ts`, `wire.ts`,
`projection.ts`, `projection.test.ts`, `repository.ts`, `reconcile.ts`;
`packages/db/src/schema/integrations.ts` and a generated Drizzle migration;
`apps/web/src/cli/logi-sync.ts`;
`apps/web/tests/integration/logi-sync.test.ts`;
`apps/web/e2e/logi-projections.spec.ts`.
Modify `packages/db/src/schema/index.ts`, `apps/web/src/modules/matches/queries.ts`,
`apps/web/src/modules/matches/service.ts`,
`apps/web/src/components/public/matches-screen.tsx`, `match-detail-screen.tsx`,
`apps/web/package.json`, `docs/integrations/logi/contract.md` and its README.

**Interfaces:**
`LogiScope = { sourceInstanceId, guildId, websiteGame, logiGame, resource }`;
`fetchSummaryPage(scope, request: { cursor, updatedSince }, deps): Promise<WirePage>`;
`mapSummary(scope, dto, observedAt): DerivedProjection`;
`reconcileScope(scope, ports): Promise<SweepOutcome>`.
`WirePage` exactly validates the current 0.4 HTTP envelope; `SweepOutcome` is
`completed | continued | authority_error | retry_scheduled | reset_required`.
Tables: source configuration, `logiProjection`, `logiPublication` and scoped
`logiSyncRun`. Publication metadata is independent of the operational payload.

- [ ] Write tests `HLL route maps explicitly`, `same external ID across games is distinct`, `unknown result stays null`, `zero score survives`, `empty page follows cursor`, `401 does not fall back to fixtures`, and `unreviewed import is not public`. Run `pnpm --filter @valkyria/web exec vitest run --project unit src/modules/integrations/logi/projection.test.ts` and the integration file; confirm expected failure.
- [ ] Implement fixed-origin bounded server-only transport with response-size limit, no redirects, secret references, schema validation and source/game checks. Add transactional page upserts/checkpoint updates. Use fixed sweep-start watermarks with overlap; never advance after an incomplete run. Invalid cursors trigger bounded full restart. Do not infer deletion from missing list records.
- [ ] Connect approved projections to current public queries/UI. Operational fields of Logi-backed records are read-only; CMS translations/publication remain editable. Show missing/stale data explicitly and link operational actions to Logi. Do not turn fixture mode on after a production error.
- [ ] Run the named tests against isolated test PostgreSQL, existing game-scope/match lifecycle tests, typecheck/lint and `pnpm --filter @valkyria/web exec playwright test e2e/logi-projections.spec.ts`. Capture actual CS/EN HLL/WDG pages with simulated wire data. Update the consumer contract and commit `feat(logi): consume scoped event and match summaries`.

### W2 — Complete producer invalidation, revisions and backlog delivery

**Owner/dependencies:** Logi; existing safe summary grants. Register D/I resources
only after their respective implementations. W1 may proceed independently.

**Files (Logi):** Create `src/domain/integrations/change.ts`, `change.test.ts`,
`convex/integrationChanges.ts`, `src/infrastructure/convex/integration-changes.test.ts`,
`src/infrastructure/convex/integration-change-coverage.test.ts`.
Modify `convex/schema.ts`, `convex/events.ts`, `convex/publicApi.ts`,
`convex/webhooks.ts`, `convex/webhookDispatcher.ts`, `convex/crons.ts`,
`src/infrastructure/webhooks/delivery-runner.ts`, its tests, and
`src/domain/webhooks/delivery-policy.ts`/tests. Extend the existing HTTP gateway,
OpenAPI/tests and System wiki. New writer modules introduced by D/I must call the
same mutation-local change helper; the coverage manifest names every writer.

**Interfaces:**
`appendIntegrationChange(ctx, change: { guildId, gameId, resource, id, operation }): Promise<string>`;
`IntegrationChange = { revision, guildId, gameId, resource, id, operation: 'upsert' | 'remove' }`;
`readChanges(keyContext, filters, cursor): ChangePage`;
`readSyncRecord(keyContext, resource, id, game): { revision, data } | Tombstone`.
Revision allocation, authoritative mutation and outbox insertion share one Convex
transaction. Revisions use canonical decimal strings with lossless integer
comparison; existing records start at zero before feed activation. Test ordering
across `9`/`10` and beyond JavaScript's safe integer limit.
`GET /clan/changes?...&start=now` returns the current filtered feed
boundary for bootstrap; normal cursor reads return ordered changes and continuation.

- [x] Trace and list every mutation of fields included in advertised projections. Write coverage tests through actual dashboard/bot/import/API Convex entrypoints, not only the new helper. Add `wrong scope cannot see IDs`, `mutation rollback emits no change`, `old scope is invalidated on move`, `retention gap requires reset`, `100 deliveries drain with bounded concurrency`, `lease expires during slow HTTP`, and `429 respects Retry-After`. Run the new change tests plus existing webhook runner/queue tests and confirm failures.
- [x] Implement monotonic per-guild revisions and seven-day retained tombstones for existing supported removal/visibility operations. Add scoped feed cursors and atomic projection/revision reads; do not add previously unsupported event-deletion behavior. Refactor mutation writers to use the transaction-local helper. New grants remain opt-in; sync routes inherit underlying grants.
- [x] Replace single-delivery dispatch with a 25-delivery, concurrency-4 drain, 10-second request deadline and 30-second work budget. Schedule due continuation transactionally and keep the minute recovery cron. Respect lease/fence, Retry-After, six-attempt retry policy and fairness; safe redirect behavior must not forward signatures to a different destination. No assumptions of exactly-once external delivery.
- [x] Run focused change/queue/HTTP/OpenAPI tests, full suite, typecheck, direct lint/format and build as applicable. Publish a new versioned change-feed fixture pack, retention/reset rules and complete trigger coverage. Commit `feat(integrations): add transactional change feed and bounded webhook drain`.

### W3 — Durable inbox, revision-aware recovery and reconciliation

**Owner/dependencies:** Website team; W1 and W2 contract. D1 enables additional
snapshot/health projections when available; their absence must not block summaries.

**Files (website):** Create
`apps/web/src/modules/integrations/logi/webhook.ts`, `webhook.test.ts`,
`worker.ts`, `changes.ts`; `apps/web/src/app/api/integrations/logi/webhook/route.ts`;
`apps/web/tests/integration/logi-recovery.test.ts`.
Modify W1's schema/migration, repository, reconciler, CLI and package script;
document the worker invocation and handoff in the integration README.

**Interfaces:**
`acceptWebhook(rawBody: Uint8Array, headers: Headers, source, ports): Promise<'accepted' | 'duplicate'>`;
`processInboxBatch(scope, ports): Promise<{ processed, nextRunAt }>`;
`reconcileChanges(scope, cursor, ports): Promise<SweepOutcome>`.
Use `logiWebhookInbox` unique `(sourceInstanceId, guildId, deliveryId)`, DB worker
lease/fence and source resource revision. ACK only after durable acceptance.

- [ ] Add tests `tampered raw bytes rejected before enqueue`, `header/body mismatch rejected`, `300-second timestamp boundary`, `crash after inbox commit before ACK`, `two workers claim once`, `refetch after newer tombstone cannot resurrect`, `full sweep failure cannot delete`, and `expired change cursor bootstraps`. Use real isolated PostgreSQL and restart the worker/repository between steps. Run `pnpm --filter @valkyria/web exec vitest run --project integration tests/integration/logi-recovery.test.ts` and observe failures.
- [ ] Implement source-bound HMAC with constant-time comparison, body limits and bounded clock skew; dedupe and queue in one transaction. Process ordered invalidations by authoritative refetch. Persist retry deadlines for timeout/429/5xx; surface 401/403 as authority errors. Never publish webhook JSON directly.
- [ ] Capture a change cursor before bootstrap, finish the fixed-filter baseline then replay changes. Use revision/fence checks on commits; preserve editorial data when hiding absent resources. Poll every five minutes, perform daily full reconciliation, and confirm removals through tombstones or scoped authoritative detail checks rather than list absence. Expose last attempt/completed sweep/backlog and sanitized errors.
- [ ] Run recovery/unit/authority-fence tests, typecheck/lint and fixture-driven end-to-end updates. Document crash and cursor-reset procedures; include storage-level evidence, not an in-memory-only claim. Commit `feat(logi): add durable invalidation and synchronization recovery`.

### W4 — Public member consent and complete publication acceptance

**Owner/dependencies:** Website team; W3 and I2 membership observations. D4 result
fixtures extend acceptance when available; confirmed results stay unavailable before it.

**Files (website):** Modify `packages/db/src/schema/community.ts`,
`apps/web/src/modules/members/service.ts`, `queries.ts`, `actions.ts`,
the W1 integration publication repository and affected public cache invalidation;
extend `apps/web/tests/integration/members-profiles.test.ts`,
`apps/web/tests/integration/authority-fences.test.ts`,
`apps/web/e2e/public-members.spec.ts` and W1's E2E file.

**Interfaces:**
`canPublishLinkedProfile(profile, eligibility, now): boolean`;
`withdrawPublication(profileId, actor, ports): Promise<void>`;
eligibility includes verified immutable identity link, approved games,
consent/version, current source membership and `validUntil` no later than 24 hours.
Logi role IDs/platform IDs are never fields of a public profile response.

- [ ] Add `withdrawal hides every locale and social preview`, `departure hides until re-review`, `expired 24-hour eligibility fails closed`, `delayed sync cannot republish`, `game affiliation does not grant site editor`, and `same nickname cannot link profile`. Cover cached media/search/feed representations as well as the page. Run the named integration files and observe failures.
- [ ] Implement explicit opt-in linkage/publication and withdrawal fences. Imported membership never creates an approved profile. Consent changes and public invalidation commit as one durable workflow; a failed invalidation retries while response gates already deny publication. Leave ordinary approved editorial content available during provider outages.
- [ ] Run database and browser tests across CS/EN, HLL/WDG, same/different guilds, stale data, revoked keys and provider-disabled mode. Capture public/private/withdrawn screenshots and verify browser payloads contain no service credentials or private member fields.
- [ ] Update consent, operations and integration documentation with exact evidence and known deployment limits. Commit `feat(members): enforce Logi-linked publication and withdrawal`.

## Handoff and rollout

W1/W3/W4 are plans for the website owner, not changes made by this contribution.
Commands above run inside that repository with its own AGENTS and isolated test
database. Publish consumer/producer contract revisions together before activation.
Keep a last-known-safe feature flag and per-source worker disable switch; failures
must not turn production back into fixture mode or retain revoked access.
