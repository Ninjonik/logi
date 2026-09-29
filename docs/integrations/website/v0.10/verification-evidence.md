# Verification and proof for PR #158

Fresh local run: 2026-09-29, Node **24.21.0**, Windows. Tested runtime source:
**`46fd6a0d06d48b923ad558b76d0a107cf2caa5af`**. The following commit only packages
documentation and evidence; the PR body pins its final delivery hash. No runtime
source fix is hidden in this documentation pass.

## Executed checks and committed output

| Check | Actual result | Proof |
| --- | --- | --- |
| `npm run test` | **551/551 pass**, 0 fail, 0 skipped, exit 0 | [Full named test output](evidence/2026-09-29/tests.txt) |
| `npm run typecheck` | Pass, exit 0 | [Output](evidence/2026-09-29/typecheck.txt) |
| `npm run generate:openapi` | Pass, exit 0; no generated change | [Output](evidence/2026-09-29/openapi.txt) |
| Official-template offline Convex generation | Pass, exit 0; no generated change | [Output](evidence/2026-09-29/convex-codegen.txt) |
| Direct ESLint over cumulative changed TS/TSX files | **3 existing errors, 17 warnings**, exit 1 | [Diagnostics](evidence/2026-09-29/eslint.txt), [exact file list](evidence/2026-09-29/eslint-files.txt) |
| `npm run lint` | Fails: existing script invokes unsupported `next lint`, exit 1 | [Output](evidence/2026-09-29/lint-script.txt) |
| Production command registration payload capture | Pass for all six commands in EN/CS/DE, exit 0; fake sink | [Output](evidence/2026-09-29/command-registration.txt), [serialized definitions](evidence/2026-09-29/discord-commands.json) |
| `npm run build` | Compilation and TypeScript pass; full build **fails** on `/en/competitions` prerender, exit 1 | [Complete output](evidence/2026-09-29/build.txt) |

The [machine-readable manifest](evidence/2026-09-29/manifest.json) records revision,
runtime, commands, exit codes, elapsed times, output hashes and generated-diff
check. Logs contain stdout/stderr with the local repository path replaced by
`<repository>` and trailing horizontal whitespace trimmed; no failures are removed.
The command-capture script was corrected
for a local import path before its successful recorded run; that harness setup
error was not a production-code failure.

The three lint errors are `no-explicit-any` at `convex/competitions.ts:52,54,58`.
The build's missing endpoint is the intentionally unserved synthetic
`127.0.0.1:32199`, producing `ECONNREFUSED`. Neither output proves a clean lint or
complete production build. Target-aware Convex codegen and a configured build are
still operator acceptance tasks.

## Reproduce

Use the pinned runtime revision for identical source, or compare runtime paths
against it before interpreting a new run. From the repository root, with installed
dependencies and no real credentials:

```powershell
$env:NEXT_PUBLIC_CONVEX_URL='http://127.0.0.1:32199'
$env:CONVEX_SELF_HOSTED_URL='http://127.0.0.1:32199'
$env:INTERNAL_AUTH_SECRET='dev-internal-auth-secret'
$env:DISCORD_BOT_TOKEN='offline-synthetic-bot-token'
$env:JWT_SECRET='offline-synthetic-jwt-secret-32-characters'
$env:SITE_URL='https://logi.example.test'
$env:NEXT_TELEMETRY_DISABLED='1'

npm run test
npm run typecheck
npm run generate:openapi
node scripts/generate-convex-api-offline.mjs
$files = Get-Content docs/integrations/website/v0.10/evidence/2026-09-29/eslint-files.txt
node node_modules/eslint/bin/eslint.js @files
npm run lint
node --import tsx docs/integrations/website/v0.10/evidence/2026-09-29/capture-commands.mjs
npm run build
git diff --exit-code -- convex/_generated src/lib/api/generated-openapi-schemas.ts
node docs/integrations/website/v0.10/evidence/2026-09-29/verify-proof.mjs
```

The evidence script is a local fake registration capture; it never calls Discord
login, sends a message or sets real guild commands. It writes only the adjacent
metadata JSON and uses synthetic process variables. Test/build variables are not
deployment configuration. Do not run the bot or deploy Convex as a verification
shortcut against these fixtures.

## Which tests support each capability?

All linked files are included in the fresh full-suite run. The table summarizes
what they exercise, not coverage percentages or proof of a deployed environment.

| Boundary | Representative source tests | Behavior exercised |
| --- | --- | --- |
| Restricted API and safe DTOs | [Key authority](../../../../src/infrastructure/convex/public-api-key-access.test.ts), [HTTP](../../../../src/lib/api/clan-route-http.test.ts), [OpenAPI](../../../../src/app/api/v1/openapi.json/route.test.ts) | Resource/game/tenant isolation, write denial, revocation, minimized response/schema parity |
| HLL and Wardogs | [CRCON](../../../../src/infrastructure/game-data/hll-crcon.test.ts), [HLL sessions](../../../../src/infrastructure/game-data/hll-sessions.test.ts), [WDG RCON](../../../../src/infrastructure/game-data/wardogs-rcon.test.ts), [directory](../../../../src/infrastructure/game-data/wardogs-public-directory.test.ts), [persistence](../../../../src/infrastructure/convex/game-data.test.ts) | Provider normalization, capabilities, identity/freshness, bounded retries, leases/checkpoints and unresolved IDs |
| Changes and webhooks | [Writer coverage](../../../../src/infrastructure/convex/integration-change-coverage.test.ts), [atomic reads](../../../../src/infrastructure/convex/public-api-sync-read.test.ts), [runner](../../../../src/infrastructure/webhooks/delivery-runner.test.ts), [signatures](../../../../src/domain/webhooks/signature.test.ts) | Transactional projection changes, cursor/reset/isolation, replay/tombstones, signed bytes, delivery retries |
| Membership observations | [Use-case](../../../../src/application/membership/read-membership.test.ts), [Discord adapter](../../../../src/infrastructure/discord/membership.test.ts), [bot ingress](../../../../discord-bot/src/sync/membership-ingress.test.ts), [lifecycle](../../../../discord-bot/src/sync/membership-events.test.ts) | Exact subject, freshness, limits, departure and epoch fences, failure/partial-reconciliation behavior |
| Managed roles | [Reconciliation](../../../../src/application/membership/reconcile-managed-roles.test.ts), [Convex queue](../../../../src/infrastructure/convex/member-role-operations.test.ts), [bot worker](../../../../discord-bot/src/sync/managed-member-roles.test.ts) | Authenticated actor, explicit target binding, role ownership/hierarchy, retry/expiry/supersession and audit closure |
| Verified Steam link | [Proof workflow](../../../../src/application/identity/verify-platform-link.test.ts), [persistence](../../../../src/infrastructure/convex/platform-identity-links.test.ts), [HTTP](../../../../src/lib/api/platform-links-route.test.ts) | Session-bound challenge, nonce replay, unique proof, unlink/relink and same-origin account actions |
| Reviewed results | [Domain](../../../../src/domain/match-results/result-revision.test.ts), [confirmation](../../../../src/application/match-results/confirm-result.test.ts), [persistence](../../../../src/infrastructure/convex/event-results.test.ts), [HTTP](../../../../src/lib/api/event-results-route.test.ts) | Immutable versions, CAS, source/proof revalidation, cross-game scope, zero/null and confirmed/corrected state |
| Recap delivery | [Preference handler](../../../../discord-bot/src/interactions/match-recap-preference.test.ts), [queue](../../../../src/infrastructure/convex/match-recaps.test.ts), [sender](../../../../discord-bot/src/sync/match-recaps.test.ts) | Exact unsubscribe, explicit Discord recipient, fresh consent/binding recheck and mixed-version withholding |
| Discord game status | [Actual handler](../../../../discord-bot/src/interactions/server-status.test.ts) | 15 cases: permission/DM denial, explicit game, isolation, private defer, freshness, zero/unknown, localization, bounds and timeout |
| Signup presentation | [Message builders](../../../../discord-bot/src/message-builders.test.ts) | Locale-independent order and actual builder/component layout data |

The original red/green steps, focused counts and fixed findings are retained in
[review](review.md), [reliability](reliability-follow-up.md),
[recaps](recap-delivery-follow-up.md), [status](server-status-command.md), and the
versioned validations. Their counts describe those earlier runs, not extra fresh
independent reruns today. The current public suite does not qualify optional SSO.

## Visual proof index

The 36 committed captures are organized by the following existing proof pages.
Those pages record browser interactions and preview commands. No new UI behavior
was introduced or re-captured in this documentation pass.

| Presentation | Captioned evidence | Fixture boundary |
| --- | --- | --- |
| Scoped key provisioning | [0.4 UI proof](../v0.4/ui-validation.md) | Actual component and local fake key lifecycle |
| HLL/WDG connection settings and recovery | [0.5 UI proof](../v0.5/ui-validation.md) | Actual settings component, synthetic sources/status |
| Membership role-sharing policy | [0.7 UI proof](../v0.7/ui-validation.md) | Actual component, isolated policy data |
| Managed role operations/history | [0.8 UI proof](../v0.8/ui-validation.md) | Actual component and queue fixture |
| Steam proof/link/unlink | [0.9 UI proof](../v0.9/ui-validation.md) | Actual workflow with synthetic provider verification; real navigation disabled |
| Reviewed results/corrections/three factions | [0.10 UI proof](ui-validation.md) | Actual component/handlers, synthetic session authority/database |
| Recovered role history and signup sorting | [Reliability follow-up](reliability-follow-up.md#reproduce-the-presentation-proof) | Actual role component / simulated Discord builder output |
| Recap preference responses | [Recap follow-up](recap-delivery-follow-up.md) | Static simulated Discord layout using production preference builder |
| Server status in CS/EN/DE | [Status command](server-status-command.md#reproduce-the-visual-proof) | Static simulated Discord layout using actual production projection/builder |

## Review and unrun checks

The earlier independent automated I5/D4 review ran 95 focused tests and found an
Important/P1 result-grant bypass; the recorded correction and regression tests are
in [review.md](review.md). Earlier role findings and their disposition remain in
the [0.8 review guide](../v0.8/review-guide.md). Later role-attempt audit-label
closure, recap fixes and this documentation inventory have implementer review.
No new independent review, maintainer approval or security certification is claimed.

Not proven here: real provider credentials/build capabilities, live Discord
installation/permissions/role effects/messages, real Steam callback, hosted auth,
website adapter/inbox/session/consent behavior, Convex OCC across real processes,
load/scheduler limits, deployment/migration/rollback. In-memory handlers, synthetic
transport and screenshots do not establish these outcomes. Optional OIDC remains
unqualified and its sensitive evidence stays in private coordination.

The documentation pass also validates its relative links, command inventory,
artifact hashes, wiki MDX syntax and unchanged runtime diff. The committed
[read-only proof verifier](evidence/2026-09-29/verify-proof.mjs) reproduces these
checks; MDX syntax compilation does not claim a complete Nextra production build.
GitGuardian is a separately reported
GitHub check; its success is not a substitute for feature or hosted acceptance.
