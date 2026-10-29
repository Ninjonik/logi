# Verified Steam identity

Account-owned Steam proof is separate from manually entered platform IDs, Discord roles, and publication consent. Reviewed results use current verified links for player attribution.

## Account lifecycle

User settings separates manually entered platform IDs from **Verified Steam account**.
Manual IDs remain claims, including IDs collected by the existing recruitment link.
Manual claims do not verify ownership, merge accounts, or create a proof link.

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
cookie. Dashboard session revocation follows the [session contract](../sso-provider-contract.md#durable-session-and-lifecycle).
