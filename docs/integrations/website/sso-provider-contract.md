# Optional Logi identity provider contract

Status: implementation for isolated qualification. Provider activation is an
explicit, separate operator step. This document specifies the consumer contract;
it does not establish production deployment or hosted acceptance.

## Authentication and authorization

Logi remains the central Discord-backed authentication authority. Websites have
their own cookies, server-side session storage and application authorization.
They use an authorization redirect to reuse an active Logi session. Do not copy a
Logi cookie, share `JWT_SECRET`, or infer website administrator rights from an ID
token. Use scoped membership reads and current game-specific role policies for
authorization; the website must deny protected access on stale or unavailable
evidence.

The provider uses authorization code flow, PKCE S256, a required nonce, and
`client_secret_post`. Supported scopes are `openid` and `profile`; website clients
request `openid profile`. Authorization also requires an opaque state to echo for
the consumer's validation. Codes last at most 60 seconds and are single-use.
Access tokens are opaque and live at most one hour, capped by the central
session's expiry. Refresh tokens, implicit flow, dynamic client registration,
RP-initiated logout and back-channel logout are not supported or advertised.

Discovery: `/.well-known/openid-configuration` (also available beneath `/api/sso`).
The configured issuer is exactly `SITE_URL`, an origin without a trailing slash.
Authorization, token, userinfo and JWKS URLs are `/api/sso/authorize`,
`/api/sso/token`, `/api/sso/userinfo`, and `/api/sso/jwks` on that issuer. Discovery
advertises RS256 and public subject identifiers. Every protocol response uses
`Cache-Control: no-store`; malformed or duplicated parameters produce bounded
errors. A disabled or unconfigured provider returns 503 without redirecting or
issuing grants.

ID tokens contain `iss`, `aud`, `sub`, `iat`, `exp`, `nonce`, `sid`, `guild_id`,
`name`, and `picture`. Userinfo is a closed DTO containing only `sub`, `name`,
`picture`, `guild_id`, and `sid`. `sub` is the immutable authenticated Discord
subject; `guild_id` identifies the canonical Discord guild. Application registration uses
the internal Logi workspace record ID; this storage key is never substituted for
the Discord guild claim. Missing or deleted guild bindings deny issuance and reads. The consumer
checks the same subject, session and workspace in both responses. Membership
status, roles, imported aliases and platform accounts are separate data.

## Runtime configuration

| Variable | Runtime | Requirement |
| --- | --- | --- |
| `SITE_URL` | Next.js | Fixed HTTPS issuer origin, no trailing slash/path/query |
| `JWT_SECRET` | Next.js | Existing strong dashboard HMAC signing secret |
| `INTERNAL_AUTH_SECRET` | Next.js and Convex | Matching secret for trusted internal gateways |
| `LOGI_SSO_ENABLED` | Next.js and Convex | Exactly `true` to enable; absence/other values disable |
| `LOGI_SSO_PRIVATE_JWK` | Next.js only | Private RSA JWK, 2048–8192 bits, unique `kid`, RS256 signing use |
| `LOGI_SSO_ALLOW_LOOPBACK_HTTP` | Next.js and Convex | Default false; explicit isolated-development opt-in only |

The private RSA JWK must contain the private key material and a bounded key ID.
The runtime imports and self-verifies the configured pair before enabling the
provider. JWKS exposes only `kty`, `n`, `e`, `kid`, `alg`, and `use`. Keep the private
JWK out of Convex, client bundles, Git, shell output and PR evidence.

Normal registration accepts exact HTTPS callback URLs with no credentials,
fragments, whitespace or wildcard matching. Development opt-in accepts HTTP only
for explicit `localhost`, `127.0.0.1`, or `[::1]`; it never enables arbitrary HTTP
hosts. Set this flag only in an isolated local environment. Website URL and every
callback are validated again at the Convex boundary.

## Durable session and lifecycle

The Discord callback synchronizes the authenticated account, creates a durable
session bound to that exact user record and subject, and issues an HS256 dashboard
JWT with fixed issuer, `aud=logi-dashboard`, `sid`, and record binding. Sessions
last at most seven days. Every dashboard session validation checks the current
record, subject, expiry and revocation generation. Only the trusted internal
gateway can create sessions; imported aliases are not authentication evidence.

Code redemption verifies the client, exact callback, S256 verifier, current
application, user and durable session in one Convex mutation. Code consumption
and opaque token creation commit together using database-owned time. Every
userinfo read repeats the current application and session checks. Clients must
revalidate userinfo before protected requests; outages deny access rather than
extending cached authority.

Normal Logi logout revokes its current durable session. The same-origin Logi UI
operation `POST /api/sso/logout` revokes all of the user's central sessions; this
is not an OIDC logout endpoint and is intentionally absent from discovery. The
dashboard also preserves its existing global logout option. Steam verification
challenges for the session are cancelled on logout. Persistence failures return
an error while retaining the cookie for a real retry.

Deleting a registered application, changing its secret, relinking or merging a
user identity, deleting a user or expiring/revoking a central session invalidates
affected grants. User generations make all-session revocation constant-size.
Expired codes, tokens and sessions are pruned in bounded batches after a one-day
retention delay. Revocation is immediate; cleanup is not required for enforcement.

## Coordinated rollout and rollback

1. Keep the provider disabled. Back up configuration and register the target
   consumer's exact callback; use a new client secret stored only by its backend.
2. Deploy compatible Convex schema/functions and the dashboard together. Existing
   unbound dashboard JWTs require one re-login. Existing unbound codes and access
   tokens are not carried over; nullable migration fields permit the schema
   upgrade without treating old records as authenticated sessions.
3. Configure the operator signing key, fixed issuer and both enable flags. Run
   local maintained-client interoperability, session replay/revocation and actual
   Convex transaction contention checks before target activation.
4. On the website, verify discovery/JWKS, state/nonce, ID-token claims, closed
   userinfo binding, protected-request revalidation and scoped membership access.
   Verify role loss and central logout while a website session already exists.
5. Activate only after the actual hosted callback/cookie setup and role policies
   have been accepted. Local synthetic or in-memory tests do not prove them.

Disable both provider flags to stop new SSO issuance and subsequent userinfo
validation. Websites must deny protected access when validation is unavailable.
Keep the durable dashboard-session implementation and database records during
rollback. Do not restore acceptance of obsolete session JWTs or grants. RSA key
rotation currently replaces the active key; overlap of multiple signing keys is
not implemented, so coordinate consumer re-login and caches rather than promising
a seamless overlapping-key rollout.

## API surface decision

OIDC has its own standardized protocol paths and must not be exposed as an API-key
equivalent under `/api/v1`. API keys cannot create user login sessions. Workspace
application registration remains behind dashboard administrator authorization.
Game data, current membership and event synchronization remain independent scoped
`/api/v1` integrations.

## Protocol references

- [RFC 7636 — S256 and the independent Appendix B test vector](https://www.rfc-editor.org/rfc/rfc7636)
- [OpenID Connect Core — code flow, nonce and userinfo](https://openid.net/specs/openid-connect-core-1_0.html)
- [OpenID Connect Discovery](https://openid.net/specs/openid-connect-discovery-1_0.html)
