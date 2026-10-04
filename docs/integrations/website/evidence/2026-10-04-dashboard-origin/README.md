# Dashboard writes behind a reverse proxy

## Regression and provenance

Creating a Wardogs match registration could return `403 {"error":"forbidden"}`
before checking the administrator. The dashboard displayed the localized
administrator/session error for this origin denial as well.

The event gate was introduced in `22d009ef150ced2d911894307e07bf13b99fd009`
(`fix(events): harden match team writes after review`, 2026-10-04 12:35:04 UTC).
It is in PR #158's head, but not in the merge commit's first parent. PR #158
was merged at 14:38:54 UTC as `c6a3154e8aabab8a2917ac489bc54adf34bf3374`.
Commit `a5d2abc035f5c6bd07bf5009785d900fb928b0a6` subsequently localized the
denial message; it did not introduce the origin check.

The faulty comparison used the browser's `Origin` and `new URL(request.url).origin`.
A reverse proxy may deliver the request to a different internal host, port or
protocol. The old tests used the same public origin for both, hiding the failure.
The new registration regression test failed with `403 !== 200` before the fix.

## Change and security boundary

Dashboard origin checks now use the origin of the operator-controlled `SITE_URL`,
following the existing roster write pattern. Route adapters inject that origin
into testable handlers; image uploads reuse their existing `siteUrl` port.
The same correction covers events, API keys, provider registrations/connections,
history retention, League tracking, public panels, membership/event policies,
team directory writes, team snapshot refreshes and image uploads.

There is no trust fallback to request URLs, `Host`, `Forwarded` or
`X-Forwarded-*`. Administrator checks, durable session/actor checks, workspace
binding, validation, rate limits, and persistence are unchanged. Existing
missing-Origin behavior is unchanged, including the older optional-Origin
checks in game-data connections, public-panel settings and League tracking.

No database/schema migration, Convex deployment, provider-key storage change or
Discord runtime change is part of this patch. `/api/v1` bearer-based contracts
are unchanged: this is a repair to the cookie-authenticated dashboard transport,
not a new product operation. Public wiki troubleshooting is updated.

## Verification on 2026-10-04

Local baseline: `e8a87439a272283350a52b72400e7bcf851c4aff`.
The patch was then rebased onto main `7ed7f40d5fc0fb6180a447680aaa76e0838b9ec9`
(PR #177, preserving game filters after edits). Typecheck passed again and the
complete offline suite again returned 1,163 passes and the same 3 failures.
Runtime: Windows, Node 24.21.0, installed Next.js 16.3.6. All tests used fakes or
the offline environment from `.github/workflows/verify.yml`; no production
credentials or database were used.

| Check | Observed result |
| --- | --- |
| New public/internal origin regression before fix | Failed: expected 200, got 403 |
| Seven focused HTTP/adapter test files | 45 passed, 0 failed |
| `npm run typecheck` (equivalent `tsc --noEmit`) | Passed |
| Complete `npm run test` with the CI fixture environment | 1,163 passed, 3 failed, 1,166 total |
| Same failing role test file on a clean detached baseline | Same 3 failures; 21 passed, 24 total |
| Real local Next.js HTTP route, six origin cases | All 6 matched their expected status |
| `npm run build -- --webpack` | Compilation and TypeScript passed; full build blocked during `/en/competitions` prerender by `ECONNREFUSED 127.0.0.1:32199` |

The first complete test invocation omitted the required offline environment and
also failed fixture initialization. The configured rerun above is the useful
comparison. Do not treat the complete test suite or full build as green.

The three pre-existing failures are in
`src/infrastructure/convex/member-role-operations.test.ts` (lines 92, 492, 522),
each reporting `Missing expected rejection` for `/owner/`:

- `actual staff assignment queues atomically while legacy service and import paths do not`
- `dashboard and legacy group writers reject a second owner for membership roles`
- `configuration rejects shared category roles across games before persisting`

Focused command:

```sh
node --import tsx --test src/lib/api/event-route-handlers.test.ts src/lib/api/game-data-route.test.ts src/lib/api/membership-policy-route.test.ts src/lib/api/match-team-refresh-route.test.ts src/lib/api/teams-dashboard-route.test.ts src/lib/api/image-upload.test.ts src/lib/api/website-event-command-route.test.ts
```

Coverage includes Wardogs/HLL registration creation, event updates/conclusion,
public-origin image URLs, proxied policy/team requests, wrong-game validation,
denied administrators, authorization errors, missing/opaque/foreign/internal
origins, host-header spoofing, mismatched configured origins, and no persistence
or cache changes on denied event writes. Review confirmed every newly required
origin port is wired from configuration and no remaining dashboard comparison
uses `new URL(request.url).origin`.

## Local HTTP proof and operator verification

With `SITE_URL=https://logi.test`, run the app on loopback:

```sh
node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 32184
curl -i -X POST http://127.0.0.1:32184/api/servers/origin-smoke/api-keys -H 'Origin: https://logi.test' -H 'Content-Type: application/json' --data '{}'
```

This returns **400**, `Enter a key name of up to 80 characters.` The intentionally
invalid body reaches validation after the origin gate, before authentication
or persistence. The recorded [HTTP proof](./http-proof.json) also checks five
denial cases returning **403**. It is a real local Next.js route test, not a
production login or administrator-write proof.

For hosted Logi, set `SITE_URL=https://logibot.tech` in the **Next.js server's**
runtime configuration and deploy this web patch. After deployment, an analogous
empty-body API-key request with `Origin: https://logibot.tech` should reach 400.
Then verify a real administrator's intended Wardogs registration and reload it
to confirm persistence. Do not create duplicate registrations while retrying.
Inspect the session/actor and current workspace authorization separately if it
still fails after origin acceptance.

The hosted internal request URL/configuration was not available for inspection.
The reported production symptom is consistent with this reproduced defect;
hosted resolution remains unverified until deployment and the real save.
Separate unavailable SSO discovery/JWKS endpoints are not repaired by this patch.
