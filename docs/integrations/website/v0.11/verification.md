# Warcon implementation, review and proof · October 2, 2026

This checkpoint adds an implemented Warcon adapter to PR #158. It supersedes the
adapter gap recorded in the earlier [live probe](../v0.10/live-provider-probe.md).
The [handoff](README.md) is the complete consumer/operator reference.

## Verified behavior

| Layer | Evidence and result |
| --- | --- |
| Actual Warcon + actual Logi HTTPS transport/adapter | All fifteen gameplay views parsed successfully, including analytics for 24h/7d/30d and the normalized collector snapshot. Live adapter probe saw 57 players. |
| Production Next build → isolated native Convex → actual Warcon | Seventeen successful view reads (fifteen views, three analytics ranges). Live scoreboard returned 100 players with fresh status/player observations. |
| HTTP access/cache acceptance | 33 total checks passed across actual provider reads, synthetic data, shared cache, missing/legacy/wrong-resource/HLL/other-guild/revoked keys, query rejection, disabled connections, internal-secret enforcement and administrator route. |
| Scheduled collectors and actual local persistence | Both sources have successful snapshot/history reads. Synthetic source stores exactly one completed Wardogs session; actual provider has zero completed sessions and no history error. |
| Browser | Actual built dashboard shows synthetic K/D/cash/ping and 0/12/7 faction scores; observed timestamp advances from 20:06:02 to 20:06:17 Europe/Prague without a manual refresh. Disable + refresh clears players and displays an error. Resume restores the table. No browser warnings/errors at the successful-state check. |
| Automated tests | **592 passed, 0 failed, 0 skipped**, including 28 additional tests covering this extension. |
| TypeScript | `tsc --noEmit` passed. |
| Production build | `next build` passed with fresh loopback Convex configuration. |
| Changed TS/TSX lint | Zero errors, one existing unused-variable warning in the OpenAPI route. Repository-wide lint was not rerun; previous unrelated failures remain documented. |
| Convex | Official local `convex dev --once --typecheck try --codegen enable` passed. Generated API declarations were regenerated, not edited by hand. |

The machine-readable [evidence package](evidence/2026-10-02-warcon/README.md) pins
runtime source hashes, exact check output, sanitized HTTP/collector records and
screenshots. It distinguishes the runtime commit from later proof-only changes.

## Review scope and fixes

The review covered all new Warcon domain schemas, query/path construction,
transport changes, adapter mappings, collector wiring, cache transactions,
authorization, HTTP routes, dashboard polling, locale text and OpenAPI. Existing
SSO, production operations and unrelated application features were not re-reviewed
in this increment. No independent second reviewer or agent review is claimed.

- The fixed endpoint allowlist rejects crossed routes, other server IDs,
  duplicate/inapplicable parameters and command endpoints before loading a secret.
  All provider traffic in this pass used GET.
- Explicit projections remove unknown fields at every modeled nesting level.
  Live Steam IDs and names are deliberate under the new explicit grant. Existing
  legacy keys and snapshot-only keys cannot obtain player rows.
- Shared leases, final authorization, connection generations, source fingerprints
  and bounded retention prevent stale writes, concurrent duplicate work and
  cross-guild cache reuse. Revocation is checked even for cached data.
- Career aggregation is guarded by a single-server visibility check, because
  upstream aggregates across all key-visible servers. Leaderboards always request
  server scope. A broader career key fails closed.
- Review reproduced an optional-view failure incorrectly blocking a healthy live
  view. The regression failed first, then passed after moving ordinary failures
  to per-query backoff. Provider 429 still blocks new reads across the connection.
- Review reproduced incorrect completed-match ordering across ISO timezone
  offsets. Comparison now uses instants and stored session timestamps normalize
  to UTC. The regression checks both valid and reversed intervals.
- Source timestamps govern freshness; neither cache access nor a new fetch makes
  old observations current. UI reads clear on errors, stop while collapsed, and
  re-evaluate freshness after receiving the response.
- Synthetic completed-match tests retain zero scores, negative cash deltas and
  unknown feed-derived metrics. Match 404 maps to absent detail, not a final result.

## Actual provider limitations

At the recorded actual-provider checks, one match was still in progress and no
completed match existed. Its detail returned absent, as expected from upstream's
completed-only route. The kill endpoint reported `configured:true` with zero
events. This is successful compatibility evidence for those states, **not** proof
of a populated actual kill stream or actual completed-match ingestion. Both
populated paths were tested with isolated synthetic responses; the completed
session was also stored by the real local collector.

The earlier probe recorded the feed as disabled. Its later enabled state was
observed, not changed by this work. We issued no feed/configuration/moderation
mutations. `scoreCap` and `matchSeconds` were unknown in real responses and remain
nullable. The catalog's map ID differs from the live display name; filtered reads
use catalog IDs.

## Reproduce

Install the repository dependencies using its lockfile, then run from its root:

```sh
node --import tsx --test src/infrastructure/game-data/warcon.test.ts src/infrastructure/game-data/warcon-http.test.ts src/infrastructure/convex/warcon-cache.test.ts src/application/game-data/read-warcon.test.ts src/lib/api/warcon-route.test.ts
npm test
npm run typecheck
npm run build
node docs/integrations/website/v0.11/evidence/2026-10-02-warcon/verify.mjs
```

Supply isolated local runtime environment variables for build/deployment checks;
do not load the supplied production Convex environment. The historical evidence
used a new native local Convex SQLite database and a separately generated TLS
fixture service; no production database was read, deployed or mutated.

For a configured target, inject `LOGI_URL`, `LOGI_API_KEY` and
`LOGI_WARCON_CONNECTION` privately and run:

```sh
node docs/integrations/website/v0.11/smoke-warcon.mjs
```

This GET-only consumer script validates every typed view, uses actual catalog
IDs, emits no player names/IDs or credentials, and reports skipped career/match
reads if there is no corresponding source record. It does not deploy or enable
anything. Use a single-server upstream Warcon key for career. Respect a returned
429; the script intentionally does not retry aggressively.

## Acceptance boundaries

No production deployment, merge, actual consuming Valkyria website integration,
Discord gateway/slash interaction, OAuth/Steam login, hosted SSO, persistent SSE,
long-duration soak, load test or provider write is claimed by this checkpoint.
The dashboard session is a synthetic local reviewer, not an OAuth proof. Earlier
real Discord evidence remains in the [cumulative handbook](../v0.10/pr-handbook.md).
The existing Discord command now recognizes the provider label and consumes its
stored snapshot; there is no new live scoreboard slash command.

The website still needs its backend adapter and publication policy; the intended
production Logi runtime needs deployment, private source configuration, the new
read grant and activation. Real nonempty kill-feed/completed-match acceptance
remains open until those records exist. Local credentials and raw provider
responses stay outside Git. Public proof contains aggregate results and synthetic
player screenshots only. Temporary runtime services are stopped after acceptance.
