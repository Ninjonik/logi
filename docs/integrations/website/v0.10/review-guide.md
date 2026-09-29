# PR #158 — cumulative review map

Logi is the operational data backend; Valkyria's website retains its own backend,
login sessions, access decisions, CMS, consent and publication. All work stays in
[PR #158](https://github.com/Ninjonik/logi/pull/158). The PR body pins the tested
head and measured diff totals. This is source delivery, not production activation.

Start with the [delivery handbook](pr-handbook.md) for the complete web/API and
Discord command catalogs, activation sequence and remaining ownership. The
[fresh verification package](verification-evidence.md) commits named test output,
build/lint diagnostics, command payloads and a hashed evidence manifest.

## Implemented boundaries

| Boundary | Review entry point | Implementation and proof |
| --- | --- | --- |
| Scoped resource/game keys and safe summaries | [0.4](../v0.4/README.md) | `src/domain/api/`, `convex/publicApi.ts`, key manager, HTTP/OpenAPI scope tests |
| HLL status and private session collection | [0.5](../v0.5/README.md) | `game-data` domain/application/adapters, `convex/gameData*.ts`, fences/checkpoints/provider fixtures |
| Wardogs status and explicit directory source | [0.5](../v0.5/README.md) | Capability probing, stable source identity, nullable/unsupported fields; no invented historical API |
| Recoverable changes and webhook invalidations | [0.6](../v0.6/README.md) | Transaction wrapper, revision log, atomic refetch, cursor scope/expiry, bounded delivery/recovery |
| Exact-subject Discord membership | [0.7](../v0.7/README.md) | Stored observations, epoch/departure fences, per-key/game role allowlist and unknown freshness state |
| Managed Discord roles | [0.8](../v0.8/README.md) | Trusted actor, explicit Discord links, per-member locks, hierarchy checks, retries and operator audit |
| Verified Steam identity I5 | [0.9](../v0.9/README.md) | Fixed Steam OpenID 2.0 provider, session-bound single-use challenge, nonce replay/uniqueness, unlink/relink invalidation |
| Reviewed result revisions D4 | [0.10](README.md) | Explicit source/event link, active proof attribution, append-only confirmation/correction, CAS, minimized scoped DTO and W2 projection |
| Personal recap delivery | [Follow-up](recap-delivery-follow-up.md) | Explicit Discord binding, exact opt-out, fresh preparation and mixed-version gate; legacy result semantics retained |
| Discord game-server status | [Command handoff](server-status-command.md) | Manager-only private command using existing safe snapshots, explicit game, source/freshness and bounded output/wait |

The architectural path remains framework entrypoint → adapter → application →
domain. Convex owns durable transactions; provider network calls run outside them.
I5 uses pinned `passport-steam-openid@1.1.12` with a bounded transport and no Steam
API key. D4 adds no dependency. No provider password enters a browser response.

## New review path

1. `src/domain/identity/platform-link.ts`, `verify-platform-link.ts` application,
   Steam adapter and `convex/platformIdentityLinks.ts`: identity proof, exact return
   binding, one-time claims, replacement/replay and logout boundaries.
2. `src/domain/match-results/result-revision.ts`, `player-link.ts`, `confirm-result.ts`
   application: pure lifecycle, unknown/zero, N participants, proof-at-review semantics.
3. `convex/eventResults.ts` and `eventResultStore.ts`: scoped session/data authority,
   transaction conflict, source revalidation, immutable history and legacy import hook.
4. `result-summaries.ts`, public API, `integrationMutation.ts`, OpenAPI: minimized
   projections, independent grants and changes/refetch/tombstone coverage.
5. Actual settings/result components, all three dictionaries, matching wiki pages,
   [I5 screenshots](../v0.9/ui-validation.md), [D4 screenshots](ui-validation.md)
   and [consumer fixtures](README.md#consumer-fixtures-and-mapping).

Earlier architecture and role review are preserved in
[0.8's review guide](../v0.8/review-guide.md) as a historical checkpoint. Its I5/D4
pending rows and test counts are superseded by this delivery.

## Why this is a large PR

The user's earlier “17k” snapshot at `c71da56` contained 16,360 additions and 759
deletions across 158 files. Later delivery adds managed-role reliability, identity
proof and reviewed results, with regression tests, contracts, fixtures and visual
evidence. The PR body measures implementation, tests/previews, documentation and
generated schemas separately. Screenshot binaries do not count as text lines.
There is one new pinned identity dependency; this is not a vendored SDK dump.

## Trust and compatibility checks

- A consumer key is not a person. Account linking, result review and role actions
  require their own account/bot workflows; no caller-supplied admin flag establishes
  authority. Result data administration intentionally retains the existing Logi
  policy; role execution requires I3's fresher Discord evidence.
- IDs for accounts, Discord members, source players, events and imported matches
  are separate. Names and claimed IDs cannot silently link them.
- Scores remain unknown/provisional until a reviewer acts. Review does not imply
  publication consent, player attendance or ownership of a game license.
- Confirmed/corrected snapshots retain history when sources or identity links
  change. Current consumer DTOs omit private player/reviewer identifiers and notes.
- Website recovery must handle signed-cursor resets, tombstones, duplicate events
  and loss of authorization. The producer code does not implement those consumers.
- Optional schema additions need compatible deployed functions and target codegen.
  No bulk identity verification, result confirmation or new key-grant migration runs.
  Coordinate web/bot versions and preserve audit rows during rollback.

## Proof and remaining acceptance

See [server-status command](server-status-command.md) for the latest **551/551**
suite, **15/15** focused tests and CS/EN/DE proof. The
[recap delivery follow-up](recap-delivery-follow-up.md) records its **536/536**
checkpoint, recipient/opt-out regressions and deployment compatibility.
The previous [reliability follow-up](reliability-follow-up.md) records its **517/517**
checkpoint, closed role-audit Minor and locale-independent signup ordering.
See [validation](validation.md) for exact commands and earlier baseline failures,
[fresh automated review](review.md) for findings/disposition and
[decisions](delivery-decisions.md) for deviations and costs. Review is not
maintainer approval. The full test suite now passes; repository lint and the full
production build still have the documented baseline/environment failures.

Logi plan tasks D1–D4, W2, I1/I3/I5 now have local implementation. Website-owned
W1/W3/W4 and I2, private hosted OIDC I4, actual provider configuration and live
acceptance remain outstanding. The role-attempt label fix applies to new transitions;
pre-fix historical rows were not backfilled. No website/CircleBot checkout, infrastructure, DNS or hosted OAuth
configuration was changed; no merge or deployment occurred.
Legacy unbound recap rows are also withheld without migration. Recap delivery
requires the compatible schema/functions/bot; it does not guarantee exactly-once
DMs or cancellation of an in-flight Discord request.

The website's PR #37 is now merged; a read-only refresh of its main at
`d61c38fcd217c36f6a06ca6d273bb4de371afc71` still finds the Logi adapter boundary
reserved with a README only. Remaining website tasks concern adopting Logi data
and authorization, not building the entire site. Evidence is in the command handoff.
