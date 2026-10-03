# Collector milestone validation

Date: 2026-09-28. Implementation starts at
`d8d8a07f4100ea1de292e3bdc9c721fedb0ed11b` on `feat/valkyria-integration`.
PR #158 pins the exact tested collector SHA. Its upstream ancestor is
`a34ef149883240ab6a9eb879e845b5f71a5786e6`; remote `main` was freshly checked at
`65a016402d77abe61b584dae19f46ac6d00b3867`. The additional upstream SSO changes
are outside this tested tree and this milestone makes no SSO acceptance claim.

Environment: Windows, Node 24.21.0, npm 11.19.0, resolved Next.js 16.3.6.
Dependencies, lockfiles, infrastructure and CircleBot were unchanged.

## Results

| Check                                                            | Result                                                                                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`, synthetic environment                                | 395 tests: 394 passed, 1 unchanged baseline failure                                                                                      |
| `npm run typecheck`                                              | Passed                                                                                                                                   |
| Direct ESLint on changed TS/TSX/preview files                    | 0 errors; 5 pre-existing unused-variable warnings in publicApi/OpenAPI                                                                   |
| `npm run lint`                                                   | Existing `next lint` script fails with invalid directory ending in `/lint`                                                               |
| Prettier on changed TS/TSX/preview/fixture and new handoff files | Passed                                                                                                                                   |
| `npm run generate:openapi`                                       | Passed; existing generated document schemas unchanged; new DTOs derive from runtime Zod schemas                                          |
| `npm run build`, synthetic loopback backend                      | Compilation and TypeScript passed; `/cs/competitions` prerender failed with `ECONNREFUSED 127.0.0.1:32199`                               |
| Actual component, simulated backend                              | Enable/disable/resume, failure/retry, workspace isolation, CS/EN and 390 px layout checked; [screenshots and limits](./ui-validation.md) |
| Handoff fixtures and relative links                              | Runtime schemas checked and local links resolved                                                                                         |
| `git diff --check`                                               | Passed                                                                                                                                   |

The full-suite failure is unchanged from [0.4](../v0.4/validation.md):
`buildEventEmbed alphabetizes match signup names within each group before laying them out in columns`,
`discord-bot/src/message-builders.test.ts:434`. It expects
`Alpha\nDelta\nGolf` and receives `Alpha\nEcho\nCharlie`. Bot code is untouched.
The total increased by 34 tests; all added tests pass.

## What the tests prove

Pure policies cover catalog ownership, private-field exclusion, zero/null,
freshness, disabled/generation/expired-fence rejection and retry delays.
Transport tests exercise allowed GET paths, credential isolation, redirects,
401/403, Retry-After, malformed/oversized responses, a hung transport, DNS address
policy, and a real claimed connection through the HTTP adapter boundary.

Provider tests use synthetic wire fixtures aligned to primary documentation:
CRCON envelopes/server/page identity, unresolved players, provisional sessions;
Wardogs capability absence and multiple scores; directory stable identity across
restart, 304 timestamp/cadence retention, missing listing/region and mismatched ID.
History tests cover persisted pending IDs, replay after a storage failure,
overlapping pages/new-head discovery, unfinished-session revisit and page-hint rewind.

Production Convex handlers run against an isolated persistence double. They check
claim exclusion, configuration ownership, changed source/expired lease/disable
fences, session/checkpoint upserts, separate connection identities, and key
resource/game/tenant/revocation enforcement. This checks transaction code paths;
it does **not** prove actual Convex transaction isolation, scheduler durability or
concurrent cloud execution. Those require deployment acceptance.

HTTP tests invoke the actual clan GET handler, mocking only Convex transport,
and check game scopes, envelopes, nullable data, no-store and rejected reads.
Management handler tests cover denied sessions, trusted guild binding, cross-origin
requests and browser attempts to inject an origin or credential reference.
OpenAPI tests check shared schemas and operation permissions. No provider, OAuth
or Discord credential was used.

## Reproduce

```powershell
$env:NEXT_PUBLIC_CONVEX_URL = 'http://127.0.0.1:32199'
$env:INTERNAL_AUTH_SECRET = 'dev-internal-auth-secret'
$env:DISCORD_BOT_TOKEN = 'synthetic-offline-test-token'
node --import tsx --test "src/domain/game-data/*.test.ts" "src/application/game-data/*.test.ts" "src/infrastructure/game-data/*.test.ts" src/infrastructure/convex/game-data.test.ts src/lib/api/game-data-route.test.ts src/lib/api/clan-route-http.test.ts src/app/api/v1/openapi.json/route.test.ts
npm test
npm run typecheck
npm run generate:openapi
npm run lint
$taskFiles = @(git diff --name-only d8d8a07 HEAD -- '*.ts' '*.tsx' '*.mjs')
npx eslint @taskFiles
git diff --check
```

Build reproduction uses the additional synthetic `CONVEX_SELF_HOSTED_URL`,
`JWT_SECRET` and `NEXT_TELEMETRY_DISABLED` values documented in
[0.4 validation](../v0.4/validation.md). A complete production build remains
unverified without a reachable backend; no hosted build/deployment was attempted.

Normal Convex deployment-aware codegen could not run without a configured
development deployment. The API declaration was generated from the installed
Convex `apiCodegen` template with the three new function modules; the existing
generated component declaration was retained. Runtime API JS is unchanged and
TypeScript validates the resulting declarations. Run normal `npx convex codegen`
against the intended development deployment during activation; this local type
generation does not prove deployed function registration.

## Acceptance still required

Connect a development tenant to its actual provider versions/permissions and TLS
origins, verify the configured CRCON server number and WWII-only history, check
real maximum payload sizes, and exercise scheduler recovery/disable during a live
request. Agree retention for private sessions. No live configuration, collection,
website deployment, OAuth/SSO flow, Discord role operation, merge or release is
claimed. W/I and D4 roadmap work remains pending.
