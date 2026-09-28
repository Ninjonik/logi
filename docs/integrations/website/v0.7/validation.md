# W2 + I1 offline validation

Date: 2026-09-28. Branch `feat/valkyria-integration`, milestone base
`cb24accac852d4cde656fb267d4cf3e65ddcdd91`; W2 commit `406edb4`.
PR #158 records the final exact tested SHA. This milestone is based on the
existing collector branch, whose upstream ancestor is
`a34ef149883240ab6a9eb879e845b5f71a5786e6`. Separate upstream SSO changes are not
part of this tested tree. No hosted auth acceptance is claimed.

Tests use production handlers with isolated in-memory transactional storage,
injected/mocked provider responses and a Discord.js client that never logs in.
They prove code-path behavior, not deployed Convex scheduling/isolation, real
Gateway ordering or actual guild/provider permissions. No live Discord, game
provider, website, deployment or hosted settings calls were made.

## Evidence

- Scoped lookup tests cover guild/game binding, explicit grant and policy, no
  member enumeration, key/policy revocation during REST, fresh receipt versus
  stale evidence, unknown guild versus departure, body limit/cancellation,
  Discord Retry-After and exact-subject response validation.
- Durable observation tests cover new departure during REST/full sync, rejected
  old epoch, failed/incomplete snapshot, legacy member-cache protection, refresh
  reservations/cooldowns/budget and policy/epoch cursor resets.
- Actual assignment create/remove handlers append membership invalidations;
  writer guards also cover import/group/setup/migration entrypoints. Existing
  `integration.changed` subscribers receive no membership IDs.
- Gateway tests exercise role removal/change and reconnect/ready/resume events,
  and prove persistence precedes reconciliation requests. No messages or roles
  are sent to Discord.
- W2 tests cover actual event writers and migration, atomic record/revision,
  lossless decimal revisions, scope removals, retention resets, signed cursors,
  rollback, 100 pending deliveries, fair guild rotation, bounded concurrency,
  expired/stale leases, retry ceilings and Retry-After.
- Management handler tests cover session denial, trusted guild binding,
  same-origin POST, closed bounded payloads. OpenAPI describes exact lookup and
  dual grants. Browser evidence is [captioned separately](./ui-validation.md).

The full suite's unchanged baseline failure is
`buildEventEmbed alphabetizes match signup names within each group before laying them out in columns`,
`discord-bot/src/message-builders.test.ts:434`: expected `Alpha\nDelta\nGolf`,
actual `Alpha\nEcho\nCharlie`. That embed implementation/test is unchanged.
PR #158 pins the exact tested SHA. Current milestone results:

| Check                              | Result                                                             |
| ---------------------------------- | ------------------------------------------------------------------ |
| Focused W2/I1/HTTP/OpenAPI tests   | 55 passed                                                          |
| Full suite                         | 434 tests, 433 passed, one unchanged baseline failure              |
| Typecheck                          | Passed                                                             |
| OpenAPI generation                 | Passed; existing generated schemas unchanged                       |
| Direct task-file ESLint            | Three pre-existing errors, eleven legacy warnings                  |
| Legacy `npm run lint`              | Unsupported `next lint` invocation                                 |
| Synthetic-backend production build | Compilation/TypeScript passed; backend-dependent prerender blocked |
| Wire fixtures and local links      | Five observations, policy settings and 21 relative links verified  |
| Browser verification               | CS/EN/DE, failure/retry, workspace isolation and 390px viewport    |
| `git diff --check`                 | Passed                                                             |

Direct task-file ESLint retains three pre-existing explicit-any errors in
`convex/competitions.ts` (52/54/58, only its mutation import changed) and eleven
legacy unused-variable warnings across migrations/publicApi/userAssignments/
webhooks/OpenAPI. New production files have no lint errors. `npm run lint`
still invokes the unsupported `next lint` command; no toolchain change is made.
Import-only `userAssignments.ts` keeps its existing formatting.

Build with a synthetic unreachable backend compiles and passes TypeScript, then
fails during `/de/competitions` prerender at `127.0.0.1:32199` (ECONNREFUSED).
A complete production build remains unverified without a reachable backend.

## Reproduction

```powershell
$env:NEXT_PUBLIC_CONVEX_URL = 'http://127.0.0.1:32199'
$env:CONVEX_SELF_HOSTED_URL = 'http://127.0.0.1:32199'
$env:INTERNAL_AUTH_SECRET = 'dev-internal-auth-secret'
$env:DISCORD_BOT_TOKEN = 'offline-synthetic-bot-token'
$env:JWT_SECRET = 'offline-synthetic-jwt-secret-32-characters'
$env:NEXT_TELEMETRY_DISABLED = '1'
node --import tsx --test src/domain/membership/*.test.ts src/application/membership/*.test.ts src/infrastructure/discord/*.test.ts src/infrastructure/convex/member-observations.test.ts discord-bot/src/sync/membership-*.test.ts src/lib/api/membership-*.test.ts src/domain/integrations/*.test.ts src/infrastructure/convex/integration-*.test.ts src/infrastructure/webhooks/*.test.ts src/lib/api/integration-route.test.ts src/app/api/v1/openapi.json/route.test.ts
npm test
npm run typecheck
npm run generate:openapi
$taskFiles = @(git diff --name-only cb24acc HEAD -- '*.ts' '*.tsx' '*.mjs')
npx eslint @taskFiles
npm run lint
npm run build
git diff --check
```

Activation acceptance must still exercise deployed schema/indexes, transaction
rollback, crash recovery, real provider timeouts, intent/permission failures,
startup/reconnect during a member departure, key/policy revocation and rollback.
Do not activate optional SSO or live role management on the strength of fixtures.
