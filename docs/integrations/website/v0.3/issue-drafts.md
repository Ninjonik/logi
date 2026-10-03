# Follow-up issue drafts

Upstream `Ninjonik/logi` Issues were disabled on 2026-09-28. Issue search could
not run for that reason; the open-PR list was empty at baseline. Search again
before publishing these drafts. None is an allocated issue or closure claim.
Private provider-review findings are deliberately excluded.

The [dated integration roadmap](../roadmap/README.md) expands these drafts into
thirteen proposed implementation tasks with owners, interfaces and acceptance
tests. D1–D4 cover collection/results, W1–W4 cover website synchronization and
publication, and I1–I5 cover membership, managed roles and identity. These local
task IDs are not allocated upstream issues. Implemented key UI remains separate
from this future-work backlog.

## Publish consent-aware website projections

**Partial delivery:** [Handoff 0.4.0](../v0.4/README.md) implements independently
scoped, minimized event/match reads with unknown/provisional result semantics.
Confirmed-result provenance and the member-consent contract remain open; this
draft is not complete or ready for closure.

**Problem:** Clan records are operational documents. Read-only authorization
does not minimize their fields or establish public-member consent.

**Scope:** Add configurable, allowlisted Logi API projection contracts for events
and confirmed match provenance, including missing upstream data behavior. The
website's own backend consumes those contracts and applies its publication
policy. Agree the website-owned member-consent interface;
keep raw platform IDs, private notes, credentials and tactical fields private.
Do not create a second operational event/signup/roster master.

**Acceptance:**
- Schema and tests separate tenant, game, source instance and opaque IDs.
- Unknown consent/publication fails closed; withdrawals invalidate public caches.
- Missing scores/media remain null; imports cannot implicitly confirm a result.
- OpenAPI, wiki and versioned consumer fixtures change together.
- Before closure, attach exact-revision tests and synthetic examples; no live
  tenant readiness claim without separate tenant evidence.

## Prove durable website synchronization and invalidation

**Problem:** Read endpoints and outbound webhooks do not provide a complete
consumer synchronization implementation or snapshot-isolated deletion stream.

**Scope:** Implement the consumer port in the website's own backend and add any
necessary producer features, such as tombstones or a change feed, upstream in
Logi. Keep website read models derived from Logi's authoritative records. The
website workstream owns its consumer implementation; this contribution owns
Logi changes and their versioned handoff.

**Acceptance:**
- Fixed filters/updatedSince and independent cursor/completed watermark survive
  restart, empty pages, timestamp ties, timeout, 429 and invalid-cursor recovery.
- Raw-body HMAC, time/guild/type/header checks precede durable dedupe/enqueue;
  crash/restart and duplicate/out-of-order delivery tests refetch authoritative data.
- Full reconciliation handles deletion without interpreting partial/outage data
  as absence; privacy withdrawal and membership removal suppress publication/access.
- A real test persistence adapter proves transaction/restart behavior; mocks alone
  are labeled as unit evidence. Link consumer and upstream exact revisions.

## Add provider-backed game-server snapshots before controls

**Problem:** Existing platform-status embeds and HLL scoreboard imports do not
establish live game-server status or Wardogs control support.

**Scope:** First implement read-only, configured provider adapters and safe
nullable snapshots in Logi, exposed through its API to the website backend.
Inventory actual Wardogs provider capabilities. Controls
remain a later change with actor authorization, game-scoped grants and auditing.

**Acceptance:**
- No hardcoded tenant/server IDs or provider/global bot secrets in public output.
- Timeout/unknown/stale states differ from offline and zero population.
- Provider fixtures cover tenant/game isolation and unsupported operations.
- Any changed Discord presentation has captioned screenshots labeled simulated
  unless verified on an explicitly authorized test guild; API/wiki parity required.

## Add administrator controls for restricted-key provisioning

**Implemented in the current milestone:** The key manager now supports explicit
resource/game selections, read-only defaults, permission summaries and English,
Czech and German copy. [UI validation](../v0.4/ui-validation.md) includes actual
component screenshots with simulated API data. This is source/browser evidence;
deployment and production workspace acceptance remain unverified.

**Problem:** The authenticated management endpoint now supports `readAccess`,
but the existing key-creation form still creates legacy full-access keys.

**Scope:** Add resource/game controls and clear permission summaries with upstream
localization. Keep existing key compatibility explicit and credentials one-time.

**Acceptance:**
- English/Czech wording and fallback are consistent; least-privilege selection is
  explicit and validated at every boundary.
- A scoped bearer key cannot manage or escalate credentials.
- Rotation/revocation, denied operations and empty policy are tested.
- Attach real captioned UI screenshots and exact tested revision before closure.
