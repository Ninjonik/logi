# Website integration 0.9 — proof-backed Steam identity

Logi remains the data authority behind the website's own backend. This milestone
adds account-owned Steam identity proof. It inherits the [0.8 role contract](../v0.8/README.md)
and does not change existing summaries, recruitment, OAuth/OIDC, role grants or
publication consent. Reviewed event results follow in D4.

## Account lifecycle

User settings separates manually entered platform IDs from **Verified Steam account**.
Manual IDs remain claims, including IDs collected by the existing recruitment link.
No migration verifies those claims, merges accounts, or creates a link implicitly.

1. An authenticated account starts `POST /api/platform-links/steam/start` with
   `{ "locale": "cs" }`. Allowed locales are `en`, `cs`, `de`. A matching `Origin`
   is required. The response contains the Steam redirect URL.
2. The server creates a random 256-bit challenge, stores its SHA-256 digest, and
   binds it to the exact verified Logi cookie digest, explicit Discord subject and
   current user record. Expiry is ten minutes; a new attempt cancels older attempts.
   Attempts are limited to one per account per 30 seconds, retaining ten challenges.
3. Steam returns to the fixed canonical `SITE_URL/api/platform-links/steam/callback`.
   The challenge is claimed atomically before network verification. Invalid, failed,
   expired, cancelled or already claimed attempts cannot be retried.
4. A reviewed OpenID **2.0** library performs server-side `check_authentication`.
   Exact return URL, HTTPS Steam provider/identity, signed fields, nonce timestamp,
   duplicate fields, session and record binding are checked. Requests have an eight
   second deadline, an 8 KiB response limit and no redirects or provider discovery.
5. A single Convex mutation rechecks expiry and binding, rejects a used nonce or
   an already active Steam ID, then inserts the proof and consumes the challenge.
   Uniqueness is enforced by an indexed read and insert in the same serializable
   transaction. There is at most one active Steam account per Logi user.
6. `DELETE /api/platform-links/steam`, with the account cookie and same-origin
   request, revokes the proof and cancels all pending/verifying challenges.
   Future attribution must check current proof. Account merges and administrative
   Discord identity changes revoke proof rather than transferring it.

`GET /api/platform-links/steam` returns only that account's latest 20 link records.
Each is `{ platform, platformId, logiUserId, method, verifiedAt, revokedAt }`;
timestamps are epoch milliseconds, method is `steam_openid`, and `revokedAt: null`
means active. The same sanitized history is included in account data exports.
No raw assertion, signature, challenge, session cookie or nonce is exposed in it.
Nonce digests are retained for at least 24 hours and pruned in bounded batches.
Personal-data erasure must also remove/revoke this account's link records and
challenges; the existing privacy request flow remains a request, not automatic erasure.

Responses use `Cache-Control: no-store`; callback redirects also use
`Referrer-Policy: no-referrer`. Verification failure returns a generic status on
the English account page; successful return preserves the initiating locale.
Cookie logout attempts to cancel this session's challenges before deleting the
cookie. This is not a new global JWT-revocation system; I4 remains separate.

## Integration and deployment boundary

There is deliberately **no `/api/v1` bearer operation** to start, complete or
unlink account proof. A clan service key cannot stand in for the account holder.
New result attribution will consume active proofs internally; web publication
still requires a separate website policy/consent decision. Proof establishes
control of an account, not a game license, Discord role, membership or result accuracy.

Set `SITE_URL` to the canonical HTTPS origin without a path. HTTP is accepted
only on loopback for development. No Steam Web API key is needed. Deployment must
verify provider callback compatibility and cookie/proxy behavior on its real origin.
This delivery uses synthetic assertions and never signs into a real Steam account.

## Dependency review

Pinned direct dependency: `passport-steam-openid@1.1.12`, MIT,
[reviewed upstream commit](https://github.com/danocmx/passport-steam-openid/tree/c22ac9253b63a6e2bc9e10058b0153149c3fc94c).
The middleware-independent `handleRequest`, `profile: false` and injected HTTP port
are used; Passport login/session middleware is not enabled. Upstream declares no
Node engine; local Node **24.21.0**, TypeScript and the focused transport tests are
the compatibility evidence. Resolved dependencies: `passport@0.6.0`,
`passport-strategy@1.0.0`, `pause@0.0.1`, `utils-merge@1.0.1` (MIT).
The repository intentionally ignores its npm lockfile; the direct version is exact.

The package requires Steam's specific HTTPS identity, signed-field sequence and
association handle. Protocol drift fails closed and requires a reviewed update.
`steam-signin@1.0.5` was evaluated but not selected because its verification request
does not expose a bounded HTTP transport. See the official
[Steam authentication documentation](https://partner.steamgames.com/doc/features/auth)
for the distinction between OpenID identity and game ownership APIs.

## Evidence

- [Validation and decisions](validation.md)
- [Synthetic identity fixtures](fixtures.json)
- [Browser proof](ui-validation.md)
- [Cumulative review guide through 0.8](../v0.8/review-guide.md)

Real provider login, deployed Convex concurrency/load, hosting, website UI and
private hosted SSO remain outside this source-only milestone.
