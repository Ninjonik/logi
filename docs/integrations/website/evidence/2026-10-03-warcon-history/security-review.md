# Security Review: logi-upstream

## Scope

Immutable Warcon retained-history diff af5a52a08b79b23e0ee491ee627887114424610d..051457a4afe744e0b8d991348f2d00e02bf3e64e, all 37 authoritative source items plus supporting changed documentation/test fixtures/images (47 files).

- Scan mode: branch_diff
- Target kind: git_diff
- Target ID: target_sha256_75c1149fff0135ad62d0a8a275300c96668fed243ce8a673446b970c5628ea7e
- Revision range: af5a52a08b79b23e0ee491ee627887114424610d...051457a4afe744e0b8d991348f2d00e02bf3e64e
- Snapshot digest: codex-security-snapshot/v1:sha256:198f3658b5cda27dd03501537da7f675aef4fd953d91ecde0e78ff86b1893b8a
- Inventory strategy: diff
- Included paths: .
- Excluded paths: none
- Artifacts reviewed: artifacts/01_context/threat_model.md, artifacts/final-code-review.md, artifacts/repro-duplicate-factions.ts

Limitations and exclusions:
- Production and hosted/provider acceptance not tested by reviewer; no provider credentials or network access used.
- Architecture review used sequential fallback after session thread-cap spawn failure.
- Later parent fixes are excluded; report remains pinned to original head.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 0 |
| Severity mix | none |
| Confidence mix | none |
| Coverage | complete |
| Validation mode | Offline source review and synthetic focused tests/reproduction |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

Logi is a Next.js dashboard and authenticated website API backed by Convex and a Discord bot. This exact increment archives completed Warcon observations during the existing fenced collector transaction and exposes workspace-scoped history and derived reports. Provider mapping is src/infrastructure/game-data/warcon.ts:210-283; durable storage is convex/gameHistoryStore.ts:31-105; HTTP delivery is src/lib/api/game-history-route.ts:22-146. Architecture mapping was performed sequentially because the required preflight worker spawn exhausted the session thread limit.

### Assets

- Retained player platform identifiers/display names and gameplay facts; workspace isolation and explicit history grants (convex/gameHistoryReads.ts:34-62).
- Correct source identity, history revisions, idempotent/corrected match attribution and change-feed projections (convex/gameHistoryStore.ts:45-103; convex/integrationChanges.ts:244-256).
- Internal gateway secret and dashboard session authority, held by trusted gateways rather than browser clients (convex/dashboardSessionStore.ts:8-47).

### Trust Boundaries

- Untrusted provider response -\> runtime schema -\> normalized archive; operator-owned source catalog controls provider origin, server and credential references (src/domain/game-data/contracts.ts:29-58; src/infrastructure/game-data/warcon.ts:54-105,210-283).
- Website caller -\> authenticated API key -\> transaction-time explicit resource/game/workspace grant (convex/gameHistoryReads.ts:34-51; convex/integrationChanges.ts:33-59).
- Browser session -\> server route -\> durable current session/admin authorization (src/app/api/servers/\[serverId\]/game-history/route.ts:14-32; convex/dashboardActor.ts:25-59).
- Signed HTTP continuation -\> Convex pagination, bound to workspace, principal, normalized filters and dataset revision (src/lib/api/game-history-route.ts:64-100,122-142; convex/gameHistoryReads.ts:73-109).
- Stored provider strings -\> React text and restricted faction color style, never executable HTML (src/components/app/game-history-panel.tsx; src/domain/game-data/warcon-history-facts.ts:3-20).

### Attacker Capabilities

- Anonymous callers can submit URLs/query strings but have no valid grant; website key holders can query their authorized workspace/resource/game, not another tenant.
- A compromised or erroneous configured provider can return bounded malformed gameplay data and names; it does not thereby own gateway secrets or Convex internal mutation authority.
- A revoked dashboard user or key holder may retain old cursors but must pass current authorization on every page.

### Security Objectives

- Retain facts independently from source availability while enforcing current authorization for list, detail and sync reads.
- Reject altered/cross-caller/cross-filter cursors; fail inconsistent revisions and incomplete report scans rather than publishing partial rankings.
- Avoid duplicate outcomes on replay/correction/credential rotation and preserve unknown outcomes and metrics.
- Bound DB page reads and reject invalid DTOs; expose no provider credentials, execute no provider fields.
- User-provided constraint: no production database changes, provider writes, credentials inspection, or URL retrieval during review.

### Assumptions

- User context identifies provider and synthetic local acceptance already performed; this review is read-only and does not independently verify production or provider runtime.
- Operator source configuration and INTERNAL_AUTH_SECRET are trusted; deployment secret values were not read.
- No SECURITY.md was found by inventory, and the official resolver emitted empty guidance for repository scope.
- No separate shared threat-model cache was read or replaced because scan userContext is nonempty.

## Findings

### No findings

No reportable findings survived the canonical discovery, validation, and reportability gates.

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| All 37 authoritative changed-source review items and 10 supporting changed files | Diff coverage | No issue found | Every source inventory item was reviewed, together with the synthetic fixture, 7 Markdown/MDX/JSON documentation/evidence files and 2 immutable-head screenshot assets (47 changed files total). Full list and code-review finding are retained in artifacts/final-code-review.md. Source review is pinned to 051457a4afe744e0b8d991348f2d00e02bf3e64e; later parent worktree edits are outside this scan. |
| Workspace, API key and dashboard authorization | Tenant isolation and privacy | No issue found | convex/gameHistoryReads.ts:34-62 rechecks internal gateway secret plus explicit current key grant/game/workspace or durable dashboard session/admin authority. convex/gameHistoryStore.ts:123-130 gates detail by workspace. convex/integrationChanges.ts:33-59,244-256 applies the same explicit resource/game grant to sync projections. Legacy/unrelated keys do not inherit history. Browser and API replies use no-store. |
| Signed cursors and consistent paginated reports | Cursor integrity and bounded reads | No issue found | src/lib/api/game-history-route.ts:64-100 binds HMAC to workspace, principal, canonical filters, position, revision and expiry, checks timing-safe signatures; :122-142 checks output workspace and revisions. convex/gameHistoryReads.ts:73-109 rejects revision drift and caps scanned rows at 20. src/application/game-data/history-report.ts refuses mixed revisions, future record revisions, repeated cursors, cancellation and over-budget partial reports. |
| Provider input, stable archive ownership and correction | Stored untrusted data and source identity | No issue found | src/infrastructure/game-data/warcon.ts:210-283 validates/project provider fields; protected existing HTTP transport caps responses and pins network destinations. convex/gameHistoryStore.ts:31-105 uses workspace/origin/server identity, rejects start-time conflicts, replaces corrections atomically and excludes credential/sourceDigest rotation from factual duplication. A reproduced P2 code correctness defect remains in original head: duplicate metadata faction names increment wins twice at src/domain/game-data/history-report.ts:70-82; see artifacts/final-code-review.md and artifacts/repro-duplicate-factions.ts. Not classified as a security vulnerability because the configured provider already supplies all winner/game facts and no additional authority, cross-tenant write or protected execution is gained. |
| Winner/outcome consistency and nullable metrics | Potential report integrity issue | Rejected | Generic retained schema accepts contradictory winner/outcome combinations, but the actual production producer derives both from the same normalized winner at src/infrastructure/game-data/warcon.ts:248-251. No shipped producer emits this contradiction; it is optional defensive schema hardening, not a separately confirmed bug. Player unknown outcomes/feed coverage remain nullable; K/D requires complete kills/deaths with positive deaths. |
| Dashboard rendering, contracts and evidence | Injection, accidental disclosure and partial UI reports | No issue found | src/components/app/game-history-panel.tsx renders provider strings through React text, restricts color values through the shared schema, aborts stale loads and clears prior report on error/reload. API docs, EN/CS/DE grant labels, generated binding diff and synthetic test assets were inspected. Immutable screenshots show synthetic names; live evidence contains aggregates only. No provider credential or shipped fixture-only auth route was introduced. |
