# People integration: local acceptance evidence

The scoped member directory, published roster/attendance and verified collected-session
facts passed local qualification on **3 October 2026, Europe/Prague**. UTC timestamps
in the JSON records fall on 2 October. The runtime exercised actual Next.js HTTP
handlers and an isolated Convex database.

| Check                              | Observed result                                            | Evidence                                                |
| ---------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| Complete Logi and bot test suite   | 725 passed, 0 failed, 0 skipped                            | [Verification](verification.json)                       |
| TypeScript                         | Exit 0                                                     | [Verification](verification.json)                       |
| Production webpack build           | Exit 0                                                     | [Verification](verification.json)                       |
| People read API                    | 46 assertions passed                                       | [HTTP checklist](people-http-checks.json)               |
| Authenticated native roster writes | 17 assertions passed                                       | [HTTP/native checklist](native-writer-http-checks.json) |
| Tested source snapshot             | 44 file hashes matched before and after HTTP qualification | [SHA-256 manifest](source-manifest.json)                |

The test suite includes synthetic unit/integration tests. The HTTP checklists are
separate runtime observations; their counts include pagination and repeated state
checks, not 63 distinct product features. The build completed with webpack
`module.createRequire` import-trace and Nextra Git-timestamp warnings. This package
does not claim a clean full-repository lint run.

## Source identity and publication boundary

The tested source was an uncommitted 44-file overlay on
`ab232d5e22e791de28e1ee1be08ca400138ed6dc`. That base revision alone does not contain
the addition. The manifest records each tested repository-relative path and its
exact byte SHA-256. All 44 files matched the main checkout when this package was
prepared. The evidence files and the link added to the v0.14 README came afterward;
they do not change runtime code. The README's manifest entry therefore describes
its earlier tested copy, before the evidence link was appended.

The package contains selected results and check names. It excludes raw response
bodies, native record IDs, cookies, central-session IDs, API credentials, local
filesystem paths, private fixture helpers and raw logs.

## Observed behavior

People reads verified the following behavior through the real local API:

- Explicit resource/game grants are required, including for older API keys.
- Lists, details and atomic sync records retain their scoped identities and
  revisions; opaque cursors cover empty pages and the complete local baseline.
- Published native rosters expose the current immutable member identity and
  attendance state. Unpublishing produces a retained tombstone and hides detail.
- Session facts preserve nullable metrics, signed cash change and observed versus
  verified coverage. Only an explicit reviewed result with the matching digest
  associates a collected session with an event.
- Private notes, custom guest names and platform account IDs stay out of the DTOs.
- Attendance changes produce update hints. Identity changes and link revocation
  invalidate earlier baselines; revoked attribution disappears from fresh reads.
- Revoked API keys cannot continue reading.

The native roster writer follows the ordinary dashboard authorization contract:
the same-origin POST requires a current central session and current workspace
administration. The final mutation rechecks the session and event's workspace.
The browser cannot select its authoritative actor. Removing administration or
revoking the session stops subsequent writes. Rejected writes preserve the roster.
Trusted bot acknowledgement requires its configured gateway credential and the
matching guild; a successful acknowledgement updates the people read model and
its change feed. These native management paths do not give the website roster or
attendance write access.

## Reproducing the checks

Use a credential-free checkout. These are the repository commands corresponding
to the stored successful test/typecheck/build invocations. The offline test run
uses synthetic configuration and an unused loopback Convex address; run typecheck
after the build finishes if both share Next.js generated types.

```powershell
$env:NEXT_PUBLIC_CONVEX_URL = "http://127.0.0.1:32199"
$env:CONVEX_SELF_HOSTED_URL = "http://127.0.0.1:32199"
$env:SITE_URL = "https://logi.example.test"
$env:INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
$env:JWT_SECRET = "offline-synthetic-jwt-secret-32-characters"
$env:DISCORD_CLIENT_ID = "000000000000000001"
$env:DISCORD_CLIENT_SECRET = "synthetic-client-secret"
$env:DISCORD_BOT_TOKEN = "synthetic-no-network-token"
npm run test
npm run build -- --webpack
npm run typecheck
```

For a narrower repeat, run the checked-in contract, projection and route tests:

```text
node --import tsx --test src/domain/api/people-summaries.test.ts src/infrastructure/convex/people-summaries.test.ts src/lib/api/people-route.test.ts src/infrastructure/convex/roster-writers.test.ts src/lib/api/roster-write-route.test.ts src/app/api/v1/openapi.json/route.test.ts
```

To repeat HTTP acceptance, use a separate local Convex instance and Next.js
runtime with matching local-only configuration. Create synthetic native members,
events, a published roster, a collected session, reviewed session linkage and
explicit people-reader grants. Establish a synthetic durable central session for
native management tests. Follow the two checklists and the
[v0.14 contract](../../README.md), retaining opaque cursors between requests.
The private seed helpers are intentionally not a deployable part of Logi; no
hosted fixture endpoint or reusable account credential is included here.

## Limits and paired website evidence

Account ownership and the central login were **trusted synthetic fixtures**.
This run did not perform live Steam OpenID, real Discord OAuth, Discord role
delivery, production collection, a production migration or hosted acceptance.
HLL/Warcon parser coverage uses stored source fixtures; the player facts checked
over HTTP came from a synthetic collected session. The assertions prove local
binding, filtering and propagation, not ownership of a real Steam account.

Publication still requires the website's explicit member binding and consent.
Statistical coverage remains collected sessions, not career totals. Source
generation, attribution freshness and large-baseline limits remain as described
in the contract.

The paired website's browser checks and screenshots are documented separately in
the [Valkyria website evidence](https://github.com/ValkyriaWDG/www/blob/feat/logi-people-sync/docs/evidence/logi-people-2026-10-03/README.md).
