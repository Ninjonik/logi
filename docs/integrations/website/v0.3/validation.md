# Milestone validation

The implementation checks below were run at
`013c625ab62358e272314c0750e0134e06c3a9f6`. The later documentation clarification
of the website-backend/Logi ownership boundary changes no runtime code; its
validation is a documentation diff and local-link check, recorded in the PR.
The original implementation baseline is
`6fbfe4e7d9c41e9a5bdc004c65f1e2d935c86e0b` on upstream's default `main` branch.
No contribution rule specified `dev` as the PR base. Both `main` and the prepared
feature branch matched that baseline before editing. Issues were disabled.
Before publishing, the feature commit was rebased onto current `main`,
`a34ef149883240ab6a9eb879e845b5f71a5786e6`. Its intervening public-site changes
do not touch the API/SSO sources or the baseline failing Discord test.

Environment: Windows, Node 24.21.0, npm 11.19.0, resolved Next.js 16.3.6.
Dependencies were installed using
`npm install --ignore-scripts --no-package-lock --no-audit --no-fund`.
No dependency, lockfile or toolchain configuration was changed.

## Commands and outcomes

| Check | Result |
| --- | --- |
| Focused backend-key, HTTP-auth and OpenAPI tests below | 33 passed |
| `npm test` with synthetic environment below | 346 passed, 1 failed; baseline had the identical failure (322 passed, 1 failed) |
| `npm run typecheck` | Passed |
| `npm run lint` | Existing script fails: `next lint` is not a supported command in the installed Next.js version; reports an invalid project directory ending in `/lint` |
| Direct `npx eslint` on changed TypeScript | 0 errors; 5 pre-existing unused-variable warnings in `convex/publicApi.ts` and the OpenAPI route; verified against baseline source |
| Prettier check on changed TypeScript | Passed after formatting the changed files |
| `npm run generate:openapi` | Passed; generated response schemas have no semantic change |
| `npm run build` with the offline backend URL below | Compilation and TypeScript pass; full build is blocked while prerendering `/cs/competitions`, which fetches a Convex backend |
| `git diff --check` | Passed |

Focused functional proof, from the repository root:

```sh
node --import tsx --test src/infrastructure/convex/public-api-key-access.test.ts src/lib/api/authenticated-clan-route.test.ts src/app/api/v1/openapi.json/route.test.ts
```

Reproduce the full isolated suite in PowerShell:

```powershell
$env:NEXT_PUBLIC_CONVEX_URL = 'https://offline-test.convex.cloud'
$env:INTERNAL_AUTH_SECRET = 'dev-internal-auth-secret'
$env:DISCORD_BOT_TOKEN = 'synthetic-offline-test-token'
npm test
npm run typecheck
```

The existing failure is
`buildEventEmbed alphabetizes match signup names within each group before laying them out in columns`
at `discord-bot/src/message-builders.test.ts:434`: expected
`Alpha\nDelta\nGolf`, actual `Alpha\nEcho\nCharlie`. Neither that implementation
nor its test is changed. Missing bot environment variables cause additional
startup failures, so use the same synthetic values for baseline comparison.

Run lint and formatting against this PR's exact TypeScript file set:

```powershell
$changedTs = @(git diff --name-only 'a34ef149883240ab6a9eb879e845b5f71a5786e6' HEAD -- '*.ts' '*.tsx')
npx eslint @changedTs
npx prettier --check @changedTs
```

Build attempt with a deliberately unavailable loopback backend, without tenant
credentials or a hosted authentication request:

```powershell
$env:NEXT_PUBLIC_CONVEX_URL = 'http://127.0.0.1:32199'
$env:CONVEX_SELF_HOSTED_URL = 'http://127.0.0.1:32199'
$env:INTERNAL_AUTH_SECRET = 'synthetic-build-secret'
$env:JWT_SECRET = 'synthetic-build-secret'
$env:DISCORD_BOT_TOKEN = 'synthetic-offline-test-token'
$env:NEXT_TELEMETRY_DISABLED = '1'
npm run build
```

## Evidence limits and remaining acceptance

The new backend tests invoke actual Convex handlers with isolated persistence.
They prove permission checks, nine write denials before cached replay, legacy
compatibility, tenant/game isolation, malformed-policy denial, revocation after
authentication, parent-scoped rosters and continuation past empty filtered pages.
They do not emulate Convex transport, deployment, transaction concurrency or a
production tenant. Existing webhook tests cover signatures, enqueue/idempotency
and outbound retry behavior; this PR does not implement a consumer inbox.

The JSON fixture pack contains six proposed normalized examples and fifteen
consumer scenarios. Scenario descriptions are requirements, not executed
production synchronization tests. Durable consumer replay/recovery, tampering
rejection, deletion confirmation, consent withdrawal and membership freshness
must be proved in the website-owned workstream. See the linked follow-up drafts.

Dashboard/Discord screenshots: **N/A**. This is a backend permission and contract
change; it adds no dashboard form, embed or command presentation. Functional
proof is reproducible through the tests above. No deployment, merge, repository
setting change, real Discord message or game-server control was performed.
