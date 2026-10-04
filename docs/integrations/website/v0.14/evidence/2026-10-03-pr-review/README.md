# PR #158 review, repairs and local verification

Review completed on **3 October 2026**. Tested runtime:
`550ec1b3fd8d36d292a567cfa4a765c0cd462f82`.
All Logi changes stay in PR #158. This package supersedes earlier test totals;
older evidence retains its original revision, date and acceptance limits.

## Repairs delivered

| Area | Result |
| --- | --- |
| Upstream integration | Merged main at `b2606d9`; retained upstream membership, topic presets and event lifecycle behavior alongside the integration guards. |
| Roster scope | Roster creation now reads assignments for the event's game; HLL and Wardogs assignments cannot be mixed through this path. Legacy HLL assignment behavior is covered. |
| Event cancellation | A website can cancel a scheduled event before the meeting. Cancellation has its own use-case, idempotent receipt and job cleanup; it does not award attendance points or manufacture a result. |
| Login entry | Direct Discord login remains available when there is no central session. Noninteractive SSO requests remain noninteractive. |
| API key management | Create/list/revoke require the exact current dashboard session, native identity and workspace administration inside the Convex operation. The dashboard route uses fresh access, bounded input and no-store responses. |
| Source configuration | Dashboard configuration requires a current actor in the final mutation; operator-only configuration is internal. The HTTP body is bounded before complete decoding and authority is checked again after reading it. |
| Warcon private reads | Dashboard reads carry a current actor through reserve and completion. Service reads retain their explicit key grants. Missing or mixed credentials are rejected. |
| Steam account proof | Pending verification binds a durable central session; completion rechecks its identity, expiry and revocation transactionally. Old unbound pending attempts must restart. Existing completed verified links are retained. |
| League resilience | Retry-After is bounded to 24 hours in transport and persistence, including repair of old oversized cooldowns. Direct text extraction avoids repeated subtree cloning. |
| CI | Pinned Node/Bun/actions, frozen lockfile, generated contract parity, typecheck and regression tests. Removed two invalid tracked gitlinks; local directories were preserved. |

Functional merge fixes are in `345b29f`; CI checkout metadata is in `811a978`;
authorization/provider repairs are in `550ec1b`. No runtime changes follow that
tested revision in this evidence delivery.

## Observed verification

| Check | Result | Evidence |
| --- | --- | --- |
| Full Logi and bot regression suite | **753 passed; 0 failed, skipped or cancelled** | [Verification record](verification.json) |
| Focused repair regressions | **70 passed** | Checked-in regression tests listed below |
| TypeScript | **Passed** | Verification record and CI |
| Next.js production webpack build | **Passed** | Verification record |
| Convex schema/functions/code generation | **Passed against an isolated loopback instance** | Verification record |
| Local SSO and event commands | **22 assertions passed** | [HTTP checklist](http-checks.json) |
| Native roster management and bot acknowledgement boundary | **17 assertions passed** | HTTP checklist |
| People projections and synchronization | **50 assertions passed** | HTTP checklist |
| Dashboard key/source administration | **9 assertions passed** | HTTP checklist |
| GitHub CI | **Passed** | [Run 37090034133](https://github.com/Ninjonik/logi/actions/runs/37090034133) |
| Security diff review | **Completed; four low-severity findings repaired; one qualification deferred** | [Security disposition](security-review.json) |

The **98 HTTP assertions** exercise actual Next.js handlers and an isolated
Convex database. They include pagination and repeated state checks, not 98
different features. The higher people count includes additional pages in the
retained synthetic database. The central login, Discord observations, Steam
ownership and game facts are synthetic fixtures. The SSO authorization/token
HTTP exchange is real local application code; it is not a completed Discord or
Steam provider login.

The CI run checks GitHub's merge revision
`0250b8fab9fed535f317627e1b9d919e1617cbd6`, combining head `550ec1b` with
base `b2606d9`. Its generated-contract, type and 753-test steps passed. It does
not run the isolated HTTP fixture harness or production deployment.

Build warnings remain for webpack `module.createRequire` traces and Nextra Git
timestamps. Lint on the repair delta had **0 errors and 4 existing warnings**.
The broader 310-file changed-source lint pass had **4 errors and 18 warnings**;
the errors were confirmed at the upstream baseline (roster-board effect state
updates and roster-command repository `any` types). A clean repository-wide
lint result is not claimed.

## Security scope and evidence limits

Codex Security scan `f3b4e926-ff57-4739-90ca-8aafcfb3ed64` is sealed against the
immutable diff `b2606d9` to `345b29f`. All **306 classified changed source files**
were reviewed across identity, providers, membership/Discord and integration
boundaries, including supporting direct Convex access. The follow-up fix delta
at `550ec1b` was reviewed and regression-tested separately; the old scan revision
was not silently relabeled as the repaired revision.

The four reportable findings concern completion-time authorization for source
configuration, Warcon dashboard reads and Steam verification, plus persistent
League backoff bounds. All four have source fixes and regression evidence at
`550ec1b`. Two original-code behaviors were reproduced in isolated synthetic
tests; two narrow authorization races were qualified by source analysis and
post-fix regressions. No hosted exploitation is claimed. The inherited API key
authorization cache issue was also hardened, but is not counted as a new diff
finding.

Coverage remains **partial** because the original parser's potential resource
impact was not benchmarked and deployed worker isolation was not tested. The
repeated-allocation pattern was removed and a nested-markup regression passes;
that does not retroactively prove a denial-of-service vulnerability. There are
no remaining confirmed findings from this review without a code repair. This
statement is bounded to the reviewed diff and is not a whole-repository or
production security certification.

The private sealed report, SARIF, source excerpts and retained reproduction
artifacts remain outside Git. This package publishes only qualified summaries,
test labels, revision/object digests and results. It excludes credentials,
cookies, record IDs, raw responses, environment files and private fixture code.

The plugin reports aggregate usage across five threads: **29,651,277 total
tokens**, including **28,406,016 cached input tokens** and **114,666 output
tokens**. These are the plugin's rollout accounting, not a billing estimate.

## Reproduction and source identity

Use a credential-free checkout and the synthetic environment in
[`verify.yml`](../../../../../../.github/workflows/verify.yml). Run:

```text
bun install --frozen-lockfile
npm run generate:openapi
node scripts/generate-convex-api-offline.mjs
npm run typecheck
npm run test
npm run build -- --webpack
node docs/integrations/website/v0.14/evidence/2026-10-03-pr-review/verify.mjs
```

Representative checked-in regressions:

- `src/infrastructure/convex/dashboard-admin-fencing.test.ts`
- `src/lib/api/game-data-route.test.ts`
- `src/infrastructure/convex/warcon-cache.test.ts`
- `src/infrastructure/convex/platform-identity-links.test.ts`
- `src/infrastructure/convex/league-cache.test.ts`
- `src/infrastructure/wardogs-league/fetch-match.test.ts`
- `src/infrastructure/wardogs-league/parse-match.test.ts`

The [source manifest](source-manifest.json) binds committed runtime input trees
and a normalized digest of **956 application TypeScript files** checked against
the private runtime before and after HTTP acceptance. The verifier checks that
the current checkout retains those inputs and that the sanitized evidence has
not changed; it does not rerun HTTP or external provider tests. A later runtime
change requires new evidence. Git history containing the tested revision is
required; evidence-only Markdown changes are allowed.

For HTTP reproduction, provision a separate loopback Convex database and Next.js
runtime with matching synthetic configuration. Follow [the checklist](http-checks.json)
and [the contract](../../README.md): create scoped synthetic assignments, published
rosters, source/session facts, verified ownership fixtures and current durable
sessions. Test current grants and revocation on both HTTP and final database
operations. Private fixture helpers are intentionally absent from production
source. No production seed or hosted fixture endpoint is provided. Both local
test processes were stopped after this run.

## Capability and visual reference map

| Reference | What it covers |
| --- | --- |
| [People v0.14](../../README.md) | HLL and Wardogs members, published rosters, attendance and collected-session facts; explicit identity, consent and freshness limits |
| [SSO v0.13](../../../v0.13/README.md) | Central login reuse, current role evidence and website sessions |
| [Event commands](../../../event-commands.md) | Website create/update/cancel, native Logi ownership, receipts and conflicts |
| [Warcon v0.11](../../../v0.11/README.md) | Fifteen supported gameplay reads, scoreboard, stored session data and source health |
| [League v0.12](../../../v0.12/README.md) | Public HTML match preview and cache; unverified completed-result states |
| [Discord reference](../../../v0.10/discord-reference.md) | Commands, buttons, modals, permissions and automation |
| [Delivery handbook](../../../v0.10/pr-handbook.md) | Cumulative feature and review entry points |
| [Earlier people UI proof](../2026-10-03/README.md) | Dated paired website proof; earlier test totals remain historical |
| [Warcon screenshots](../../../v0.11/evidence/2026-10-02-warcon/README.md) | Earlier scoreboard active/resumed/disabled states |
| [League screenshots](../../../v0.12/evidence/2026-10-02-league/README.md) | Earlier English/Czech preview and stale states |
| [Website PR #84](https://github.com/ValkyriaWDG/www/pull/84#issuecomment-5963935373) | Wardogs server navigation, list/banner/detail and paired people consumer proof |

This backend review adds no new screenshot acceptance. Existing screenshots are
dated visual references, not evidence of the new transaction guards.

## Activation and remaining work

- Deploy compatible Logi web, bot and Convex versions together. Configure matching
  trusted gateway credentials. Updated key/configuration clients must supply the
  current gateway-derived actor; older clients fail closed. Restart any unbound
  pending Steam verification after upgrading.
- Keep provider credentials server-side and issue explicit per-resource/game
  read grants. Source configuration and its current generation must be enabled
  before people statistics can be exported. Website roster/attendance remains
  read-only; membership, roles and statistics remain Logi-owned.
- Complete hosted OIDC callbacks, real Steam ownership, production collector,
  scheduler/webhook, migration and load acceptance separately. No deployment,
  production Convex access, merge or real Discord/provider mutation occurred in
  this review.
- Preserve the website's documented activation gates and consent rules. The
  Wardogs server list/detail exists in website PR #84; an individual live-player
  table embedded in that website remains a separate UI addition. The Warcon
  read integration and external scoreboard link already cover the source data.
- Completed League result semantics and populated provider event/kill feeds
  still need real corresponding source samples. Unsupported metrics remain null;
  collected-session statistics are not career totals or proof of attendance.
