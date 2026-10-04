# Integration research, 2026-09-28

## Evidence boundary

| Source                                                                          | Inspected revision / state                                                                                                          |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Logi feature branch                                                             | `cd69579f4d1da07c5da9f859e6741b0c2e5ac793`, clean; [PR #158](https://github.com/Ninjonik/logi/pull/158) open against default `main` |
| Logi upstream main                                                              | `65a016402d77abe61b584dae19f46ac6d00b3867`; its SSO changes are not part of the feature branch's tested runtime                     |
| Website source, read only                                                       | `9d4fe3c6781019db9c0614377d1a5d85e7098230`; [PR #37](https://github.com/ValkyriaWDG/www/pull/37) open                               |
| Hosted unauthenticated [OpenAPI](https://logi.igportals.eu/api/v1/openapi.json) | Advertises `1.0.0`; new summary routes were absent. This is document discovery, not a tenant/runtime test                           |
| CRCON source                                                                    | `57b7bea4dd38aae83d219f30442f15cf8797e710`                                                                                          |
| Warcon source                                                                   | `0bc123cea2aee1e0b5e76c5c278badb2a03ce267`                                                                                          |
| Wardogs TypeScript client candidate                                             | `1fa515520f37793c59ce108da02dfd17692068af`; inspected as a reference, not installed                                                 |

Only PR #158 was open in Logi at refresh; Issues were disabled and the account
retained WRITE permission. No credentials, hosted auth flow, real game server,
Discord member operation or website checkout was used. Website source inspection
does not rerun or certify that project's tests.

## What exists, and what is missing

Paths in this table are relative to Logi unless prefixed `website:`.

| Area                     | Verified source behavior                                                                                                                                                        | Next gap                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| API least privilege      | `src/domain/api/key-access.ts`, `convex/publicApi.ts`, `src/components/app/api-key-manager.tsx`: resource/game read grants, revocation, summary defaults and localized admin UI | Hosted acceptance; new resources need their own explicit grants                                                                                |
| Events/results on web    | `src/domain/api/event-summaries.ts`: closed event/match DTOs; results only unknown or provisional                                                                               | Actual website transport and persistence; confirmed/corrected provenance                                                                       |
| HLL ingestion            | `src/lib/server-match-results.ts`: manual CRCON `/games/{id}` links become `/api/get_map_scoreboard?map_id=...`, storing results and player statistics                          | Configured bounded collector, stable provider identity, retries/checkpoints and live safe snapshot                                             |
| Player identity          | Existing importer has platform-ID matching plus legacy name/nickname heuristics; current platform-link flows accept submitted IDs                                               | Introduce proof-of-control provenance separately from claimed IDs; ambiguous/unverified players stay unresolved                                |
| Wardogs                  | Explicit game ID and shared event/assignment workflows                                                                                                                          | No provider adapter in inspected Logi; external options now exist, but actual host/build is unknown                                            |
| Discord lifecycle        | `discord-bot/src/index.ts` handles member add/update/remove; `sync/member-access.ts` also performs full member sync                                                             | Observation generation/revision, freshness, race-safe reconciliation and scoped membership API                                                 |
| Recruitment and teams    | `content/configuration/tickets.mdx`, `convex/discordMembership.ts`: applications, recruit/member/mercenary transitions and managed recruitment roles already exist              | Reliable role-operation retries/audit and explicit reconciliation ownership; reuse these flows                                                 |
| Groups/imports           | `content/configuration/members.mdx`: assignments are per workspace/game; linked group roles filter imports/signup choices                                                       | A group role link is not automatic two-way role synchronization                                                                                |
| Webhook producer         | `convex/webhooks.ts`, `webhookDispatcher.ts`, `crons.ts`: durable claims, HMAC, bounded retry policy; dispatcher claims one delivery per minute invocation                      | Complete mutation coverage, bounded backlog drain, timeout/Retry-After and durable deletion/version contract                                   |
| Website data integration | `website:apps/web/src/modules/integrations/logi/README.md`: boundary reserved; contract version 0.2 is a normalized model, not a wire API                                       | Transport, mapping, database schema, worker/inbox and publication integration                                                                  |
| Website OAuth            | `website:apps/web/src/modules/auth/auth.ts`: Better Auth Discord login, `identify`, database sessions; OAuth tokens discarded                                                   | Preserve it; optional Logi OIDC is a separate provider acceptance and migration task                                                           |
| Website permissions      | `website:apps/web/src/modules/access/*`: explicit role mappings, game scope, membership freshness and local recovery grant separation                                           | Replace the configured website bot lookup with a scoped Logi membership source after equivalent evidence; support per-game guild configuration |
| Public members           | `website:packages/db/src/schema/community.ts`: independent profile and consent/publication gates                                                                                | Link only verified identities, reconcile departure and consent withdrawal without publishing operational records                               |

The website's current private-read freshness limit is 5 minutes; privileged
writes require an observation within 60 seconds. Its membership client presently
uses a separately configured bot-token lookup. The target must not require the
website to receive Logi's global bot token or internal Convex secret. Its existing
role/version and transaction authority checks must survive the adapter change.

## HLL provider evidence

The [CRCON API guide](https://github.com/MarechJ/hll_rcon_tool/wiki/Developer-Guides-%E2%80%90-CRCON-API)
documents tokens inheriting a dedicated user's permissions. Use only required
read permissions and verify the installed version's endpoint/method contract.

The pinned [views](https://github.com/MarechJ/hll_rcon_tool/blob/57b7bea4dd38aae83d219f30442f15cf8797e710/rconweb/api/views.py)
implement `get_public_info`. Pinned [scoreboards](https://github.com/MarechJ/hll_rcon_tool/blob/57b7bea4dd38aae83d219f30442f15cf8797e710/rconweb/api/scoreboards.py)
provide GET `get_scoreboard_maps` with `page`, `limit`, `server_number`, and
`get_map_scoreboard` with `map_id`. Newest-first offset pages can shift when new
games arrive: overlap and session-ID deduplication are required. These are source
observations, not a tested provider connection. Keep raw player information private.

## Wardogs provider options

| Option                      | Evidence                                                                                                                                                                                                     | Recommended use                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Direct WDRCON               | Public [console JavaScript](http://rcon.wardogs.com/js/api.js) reads `/v1/capabilities`, `/v1/status`, `/v1/players`, optionally `/v1/server-id`; it also contains mutation methods                          | Primary candidate when an authorized server endpoint is available; explicit read-method allowlist and protected transport             |
| Existing Warcon instance    | Project [README at inspected revision](https://github.com/warcon-app/warcon/blob/0bc123cea2aee1e0b5e76c5c278badb2a03ce267/README.md) describes server-scoped capability keys and stored match/player history | Optional adapter if the community already uses it; a view-only key for named servers. Do not deploy another panel as a prerequisite   |
| Wardog Servers              | Provider's own [developer docs](https://wardogservers.com/devs) and [OpenAPI](https://api.wardogservers.com/openapi.json) describe public server-browser snapshots, freshness and history                    | Optional lower-trust public server-status fallback; no membership, identity verification, player-level match confirmation or controls |
| Community TypeScript client | [Source](https://github.com/Yuban32/wardogs-rcon-api/tree/1fa515520f37793c59ce108da02dfd17692068af) supplies typed protocol helpers                                                                          | Reference candidate; no dependency selected or installed in this plan                                                                 |

The public console was retrieved without connecting it to a server. Its adapter
uses a bearer password and an HTTP base; that is not permission to send secrets
over the public internet. Production must use a verified HTTPS endpoint or an
explicitly protected private path. Capabilities vary by build. The console models
faction score arrays, so do not force every WDG observation into HLL's two sides.

Warcon is an independent project, not an official publisher contract. Its
reverse-engineered [protocol notes](https://github.com/warcon-app/warcon/blob/0bc123cea2aee1e0b5e76c5c278badb2a03ce267/docs/wardogs-api.md)
are supplementary evidence; the selected host still needs acceptance.

Wardog Servers requests server-side access, conditional ETag polling around its
reported refresh interval and attribution when displaying its data. Preserve its
snapshot freshness/region coverage, distinguish stable join/server identity from
restart-specific instance identity, and treat a missing listing as unknown.
It is independent community data, not publisher-certified results.

## Discord and authentication references

- [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2): `identify`
  identifies the user; `guilds.members.read` covers that user's member lookup,
  not a complete community directory. Login grants neither website admin rights
  nor the bot's management authority. [Better Auth Discord](https://better-auth.com/docs/authentication/discord)
  supports reusing the website's existing provider integration.
- [Discord Gateway](https://docs.discord.com/developers/events/gateway#privileged-intents):
  member lifecycle requires the appropriate `GUILD_MEMBERS` privileged intent and
  its application configuration/approval where applicable. Reconnect recovery and
  periodic REST reconciliation remain necessary.
- [Discord permission hierarchy](https://docs.discord.com/developers/topics/permissions#permission-hierarchy):
  managed role/target operations must respect the bot's position and permissions.
  Existing role names or a Discord administrator bit are not implicit website grants.
- [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html),
  [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636.html) and
  [OIDC Core](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation)
  define the proposed OAuth/OIDC acceptance baseline: transaction binding, exact
  redirects, S256, issuer/audience/signature/expiry and replay handling. This list
  is not a public report of current provider findings.
- [Steam browser authentication](https://partner.steamgames.com/doc/features/auth#website)
  uses OpenID 2.0 to prove and link a SteamID. It is distinct from Discord OAuth2
  and Logi OIDC; a submitted ID or public profile lookup is not that proof. SteamID
  authentication alone does not establish game ownership or website permissions.
- [Convex scheduled functions](https://docs.convex.dev/scheduling/scheduled-functions)
  make mutation scheduling atomic; external actions are not automatically retried.
  Durable leases, retry state and idempotent commits therefore belong in persistence.

## Research limits

The selected WDG host, endpoint/version, provider IDs, guild topology and actual
role mapping remain unknown. Continue with disabled configurations and synthetic
fixtures; activation requires these facts, not additional guesses. External docs
can change: pin a provider version and sanitize real wire examples at acceptance.
No external source reviewed here establishes tenant permissions or deployment.
