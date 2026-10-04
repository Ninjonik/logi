# Scoped keys and summary milestone validation

Validation date: 2026-09-28. The PR description pins the full commit SHA of the
validated tree. The administrator UI follow-up starts at
`1c6c1d586446870f5134047bf704f599e65e2300`, on `feat/valkyria-integration`,
and keeps the existing PR against upstream's default `main`. The tested branch's
upstream ancestor is `a34ef149883240ab6a9eb879e845b5f71a5786e6`. At final refresh,
`main` was `65a016402d77abe61b584dae19f46ac6d00b3867`; its additional SSO
authorization/documentation changes do not overlap this PR's files and are not
part of the tested feature-branch tree. This milestone includes no SSO edits or
new SSO acceptance claim. See the
[foundation validation](../v0.3/validation.md) for the original baseline and
its already-reproduced failures.

Environment: Windows, Node 24.21.0, npm 11.19.0, resolved Next.js 16.3.6.
No dependencies, lockfile or toolchain configuration were changed.

## Results

| Check | Result |
| --- | --- |
| Focused UI/domain/backend/HTTP/OpenAPI command below | 48 passed |
| `npm test` with synthetic environment | 360 passed, 1 pre-existing failure |
| `npm run typecheck` | Passed |
| `npm run lint` | Existing `next lint` script fails with an invalid project directory ending in `/lint` |
| Direct ESLint on all PR TypeScript files | 0 errors, the same 5 pre-existing unused-variable warnings in `convex/publicApi.ts` and the OpenAPI route |
| ESLint on the new UI, dictionaries and preview scripts | 0 errors and 0 warnings |
| Prettier on all PR TypeScript files | Passed |
| `npm run generate:openapi` | Passed; existing generated document schemas unchanged; summary schemas derive directly from the runtime Zod schemas |
| `npm run build` with unavailable loopback backend | Compilation and TypeScript passed; prerendering `/cs/competitions` failed with `ECONNREFUSED 127.0.0.1:32199` |
| Synthetic fixtures and local handoff links | Six responses checked; four DTOs validate against runtime schemas; local links resolve |
| Actual component in browser, with simulated API | Creation scopes, full-access mode, copy/hide, workspace changes, revocation, failure/retry and narrow layout verified; [captioned screenshots and procedure](./ui-validation.md) |
| `git diff --check` | Passed |

The unchanged full-suite failure is
`buildEventEmbed alphabetizes match signup names within each group before laying them out in columns`,
at `discord-bot/src/message-builders.test.ts:434`: expected
`Alpha\nDelta\nGolf`, actual `Alpha\nEcho\nCharlie`. The baseline had the same
failure. No bot implementation or bot test is changed by this PR.

## Reproduce

From the repository root, in PowerShell:

```powershell
$env:NEXT_PUBLIC_CONVEX_URL = 'https://offline-test.convex.cloud'
$env:INTERNAL_AUTH_SECRET = 'dev-internal-auth-secret'
$env:DISCORD_BOT_TOKEN = 'synthetic-offline-test-token'
node --import tsx --test src/components/app/api-key-manager.test.ts src/domain/api/event-summaries.test.ts src/infrastructure/convex/public-api-key-access.test.ts src/lib/api/authenticated-clan-route.test.ts src/lib/api/clan-route-http.test.ts src/app/api/v1/openapi.json/route.test.ts
npm test
npm run typecheck
npm run lint
$changedTs = @(git diff --name-only 'a34ef149883240ab6a9eb879e845b5f71a5786e6' HEAD -- '*.ts' '*.tsx')
npx eslint @changedTs scripts/preview-api-key-manager.mjs
npx prettier --check @changedTs
npm run generate:openapi
git diff --check
```

Build attempt, with synthetic values and no hosted authentication call:

```powershell
$env:NEXT_PUBLIC_CONVEX_URL = 'http://127.0.0.1:32199'
$env:CONVEX_SELF_HOSTED_URL = 'http://127.0.0.1:32199'
$env:INTERNAL_AUTH_SECRET = 'synthetic-build-secret'
$env:JWT_SECRET = 'synthetic-build-secret'
$env:DISCORD_BOT_TOKEN = 'synthetic-offline-test-token'
$env:NEXT_TELEMETRY_DISABLED = '1'
npm run build
```

## Functional evidence and limits

The focused tests exercise production domain mappers and actual Convex handlers
against isolated persistence. Added scenarios cover independent summary/raw
grants, write denial, persisted tenant/game ownership, wrong-table IDs,
revocation after authentication, empty-page continuation, inclusive timestamp
ties, training exclusion and future/private-field exclusion. They verify unknown
results despite a concluded event/raw telemetry, provisional imports, preserved
zero scores and explicit legacy HLL/null metadata.

The HTTP test invokes the actual Next.js `GET` handler and mocks only the
external Convex transport. It checks page filters, response envelopes,
match/event identity, no-store and denial of raw reads. OpenAPI tests exercise
the actual document route, response schemas and every operation's permission
metadata. Runtime projections and the new OpenAPI response schemas derive from
the same closed Zod objects.

The six handoff examples are synthetic HTTP responses, not responses captured
from a hosted tenant. They are schema-checked examples; production synchronization,
deployed Convex execution/concurrency, consumer crash/retry recovery, consent
withdrawal and real provider behavior remain unverified. The inherited consumer
scenarios are acceptance requirements, not claims of implemented website behavior.

The key manager's changed dashboard presentation has [actual component screenshots
with simulated data](./ui-validation.md). Discord presentation is unchanged.
A complete production build is not verified; its page-data phase requires a
reachable backend. No merge, deployment, hosted settings change, website edit or
live Discord message was performed.
