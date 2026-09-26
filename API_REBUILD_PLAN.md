# Clan API and System Area Rebuild Plan

## Purpose and decisions

Rebuild Logi's external API so a clan can run its own website against Logi,
including reading and changing all clan-owned data. This is deliberately a
clean break: no compatibility promise is required for the old `/api/v1` clan
API, and it is acceptable to remove or replace its endpoints.

The following product decisions are settled:

- One API key has full access to its clan's persisted, clan-owned data. Do not
  add API-key scopes, expiry, IP restrictions, key rotation workflows, or
  per-key rate limits beyond the existing basic request limit.
- Authenticated clan API access includes private clan data: members, platform
  IDs, private notes, applications, unpublished rosters, and Discord
  configuration. It never exposes Logi runtime secrets or credentials such as
  `INTERNAL_AUTH_SECRET`, bot tokens, OAuth credentials, or server environment
  variables.
- Public endpoints remain intentionally restricted. Never use an authenticated
  clan projection as a public response.
- Use the real persisted/document schemas and existing validation schemas where
  appropriate. Do not create a parallel, reduced external DTO layer merely to
  hide clan-owned fields.
- Omitted game scope means `hell_let_loose`, including legacy records without a
  persisted `gameId`. `game=all` is explicit cross-game aggregation.
- External list requests must be bounded and paginated. There must be no route
  that responds with every record or a giant complete-clan export.
- Write operations need idempotency keys. Webhook requests are HMAC signed.
- Admin UI gets a new **System** section. Imports and Helper Data move there,
  and Webhooks gets its own page under it.
- No v1 compatibility or migration route is required. Update or replace the
  OpenAPI document and docs to match the final API exactly.

## Repository and architectural constraints

Read `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, and the root
`AGENTS.md` before changing behavior. In particular:

- Route handlers parse HTTP and authenticate only. Business rules belong in
  `src/domain` and workflows in `src/application`; reuse existing focused
  gateways/read models when they already own the behavior.
- `convex/` remains the persistence/transaction boundary. Do not edit
  `convex/_generated/`.
- Reuse dashboard-side authorization only for dashboard routes. API-key
  authorization must be verified server-side from the key's owning guild.
- Run Prettier only on task files, focused tests while iterating, then
  `npm run typecheck`; run broader tests for cross-cutting changes.

## Current state (uncommitted work already present)

The following partial multi-game work exists in the current worktree and must
be preserved or intentionally superseded:

- `src/lib/api/game-scope.ts`: parses `?game=`; missing value is HLL, `all` is
  explicit, invalid values return a query error.
- `src/lib/api/clan-game-scope.ts`: scopes the old complete clan payload.
- `convex/publicApi.ts`: adds explicit `gameId` to events, groups, rosters,
  assignments, stratmaps, and matches in the old clan projection.
- `/api/v1/clan` and `/api/v1/clan/[collection]` use the above behavior.
- OpenAPI and `content/configuration/settings.mdx` describe the current partial
  behavior.
- Tests: `src/lib/api/game-scope.test.ts` and
  `src/lib/api/clan-game-scope.test.ts`.

The old implementation is not an acceptable final architecture: `getClanData`
in `convex/publicApi.ts` loads all collections before filtering/paginating.
Replace it with bounded resource-specific reads, then remove dead helpers and
old bulk endpoint documentation.

### Tenant read-projection backfill

Roster synchronization reads use a denormalized optional `guildId` on rosters,
and clan user synchronization reads use one `clanApiUserProjections` record per
guild/user. Both are populated by normal roster and assignment writes. After a
schema deployment, an operator must explicitly run the bounded
`migrations:backfillClanApiReadProjections` mutation for `rosters` and `users`
until each returns `nextCursor: null`. This is deliberately separate from
deployment: it is resumable, does not modify roster contents or assignments,
and avoids silently treating a parent event timestamp as a roster update.

## Existing API inventory

External v1 routes currently are:

```text
/api/v1/openapi.json
/api/v1/docs
/api/v1/clan
/api/v1/clan/[collection]
/api/v1/clan/articles
/api/v1/public/matches[/[eventId]]
/api/v1/public/players/[playerId]
/api/v1/public/clans/[clanId]
/api/v1/public/competitions/[slug]
```

Routes below `/api/servers/[serverId]/**` are dashboard/session adapters, not
an external API. They currently contain many useful write paths (events,
groups, articles, rosters, assignments, presets, settings, imports). Extract
or reuse their gateway/use-case behavior; do not expose these dashboard routes
or rely on browser session cookies for the clan API.

## Target authenticated clan API

Keep a versioned namespace; `/api/v1/clan` is acceptable because compatibility
is explicitly waived. All endpoints require:

```http
Authorization: Bearer logi_...
```

Responses use `{ "data": ... }`; errors use
`{ "error": { "code": string, "message": string } }`. Return 401 for an
absent/revoked/invalid key, 400 for validation/query errors, 404 for a missing
record within the key's guild, 409 for an idempotency conflict, and 429 for
rate limiting.

### Required conventions

- List routes accept `limit` (default 25, maximum 100), an opaque `cursor`,
  `sort` (only allow documented stable sort keys), and `updatedSince` ISO time
  where the entity has `updatedAt`.
- List responses always contain `page`, `nextCursor` (`null` at end), `limit`,
  and `total` or a clearly documented `total` endpoint. Prefer a count route
  for expensive total counts rather than making every page query count all
  documents.
- Game-owned resources accept `game` with values `hell_let_loose`,
  `hell_let_loose_vietnam`, `wardogs`, and `all`. Default is HLL. Returned
  game-owned records always have explicit `gameId`; normalize missing legacy
  values through `resolveGameScope`.
- Shared resources (for example articles/calendar items and global settings)
  do not pretend to be game-specific and ignore/reject `game` consistently.
- Do not accept generic arbitrary `filter[field]` traversal. Define explicit,
  indexed query parameters per resource (date range, status, event ID, game,
  etc.).
- Every mutation accepts `Idempotency-Key`. Store the guild ID, method/path,
  body hash, result status/body, and expiry in Convex. The same key plus same
  request returns the stored result; the same key plus a different request is 409. Decide/document a reasonable retention period (24 hours is suitable).

### Resource surface to implement

Implement a focused endpoint for each persisted clan concern. Exact HTTP verbs
may follow the existing dashboard behavior, but do not collapse unrelated
features into an untyped `collection` route.

```text
GET    /clan/meta                 # guild identity, enabled games, per-resource counts,
                                  # API limits, server time/sync marker
GET    /clan/events
POST   /clan/events
GET    /clan/events/{eventId}
PATCH  /clan/events/{eventId}
DELETE /clan/events/{eventId}
POST   /clan/events/{eventId}/signup       # only if external self-service is intended
POST   /clan/events/{eventId}/actions/...  # use named actions, never arbitrary action strings

GET/POST /clan/rosters
GET/PATCH/DELETE /clan/rosters/{rosterId}
GET/POST /clan/groups
GET/PATCH/DELETE /clan/groups/{groupId}
GET/POST /clan/assignments
GET/PATCH/DELETE /clan/assignments/{assignmentId}
GET/POST /clan/articles
GET/PATCH/DELETE /clan/articles/{articleId}
GET/POST /clan/calendar-items
GET/PATCH/DELETE /clan/calendar-items/{calendarItemId}
GET/POST /clan/stratmaps
GET/PATCH/DELETE /clan/stratmaps/{stratmapId}
GET/POST /clan/topic-presets
GET/PATCH/DELETE /clan/topic-presets/{presetId}
GET/POST /clan/squad-presets
GET/PATCH/DELETE /clan/squad-presets/{presetId}
GET    /clan/matches
GET    /clan/matches/{eventId}
GET    /clan/performance-history
GET/PATCH /clan/settings            # guild/frontend settings and Discord configuration;
                                     # omit runtime-only secrets by construction
GET    /clan/users                   # bounded, clan-scoped member/user view
GET    /clan/users/{userId}
```

Do not blindly promise every listed mutation if the dashboard has no safe
equivalent yet. For each such case, first extract/use a domain/application
workflow and tests, then expose the route. The final OpenAPI contract must only
list working operations.

### Data ownership and cross-tenant checks

Every resource ID lookup must prove the resource belongs to the API key's guild
before reading or mutating it. Never trust a supplied `guildId`/`serverId` in
the request body. Derive the guild from the API key. For event-linked resources
(rosters, stratmaps, match statistics), verify the parent event belongs to the
guild. For user data, scope to assignments/membership in the guild rather than
allowing unrestricted global user lookups.

### Internal API-key helpers

Refactor `src/lib/public-api.ts` and `convex/publicApi.ts` into narrowly named
operations:

- authenticate a hashed bearer key and return the owning guild identity;
- update `lastUsedAt` safely without making every GET fail if telemetry update
  is unavailable;
- apply the existing rate limit consistently and return standard rate-limit
  headers from every authenticated route;
- fetch a bounded resource page or one guild-owned record;
- execute idempotent mutation work;
- enqueue webhook deliveries after successful mutations.

Never log the bearer value or an HMAC secret. Continue storing API key hashes,
not key plaintext.

## Webhooks

### Persistence

Add Convex schema tables for webhook subscriptions and deliveries. Suggested
subscription fields:

```text
guildId, url, eventTypes, secret, enabled, createdAt, updatedAt,
lastDeliveredAt, lastFailureAt
```

The signing secret must be available to the dispatcher; store it only in the
server-side database and reveal it to the admin exactly once when created or
rotated. Never return it in normal list/read operations.

Suggested delivery fields:

```text
webhookId, guildId, eventType, payload, attempt, status,
nextAttemptAt, responseStatus?, lastError?, createdAt, deliveredAt?
```

Index by `guildId`, `webhookId`, and `status/nextAttemptAt`. Validate URLs:
HTTPS in production, no localhost/private-network targets in production, sane
length limit, and no credentials embedded in the URL.

### Delivery contract

POST JSON to the configured URL with these headers:

```text
Content-Type: application/json
User-Agent: Logi-Webhooks/1.0
X-Logi-Event: <event name>
X-Logi-Delivery: <delivery id>
X-Logi-Timestamp: <unix seconds>
X-Logi-Signature: sha256=<HMAC_SHA256(timestamp + "." + rawBody, secret)>
```

Payload must include `id`, `type`, `createdAt`, `guildId`, and a resource
snapshot/identifier. Start with mutation events that are actually wired:
`event.created`, `event.updated`, `event.deleted`, `roster.updated`,
`article.created`, `article.updated`, `article.deleted`, and
`settings.updated`. Add other events only when their mutations enqueue them.

Dispatch asynchronously through a Convex action/scheduled job, not inline in
an HTTP response. Retry transient failures with bounded exponential backoff;
do not retry permanent 4xx except 408/429. Record delivery status. Add a
dashboard "send test" action that enqueues `webhook.test` rather than directly
calling arbitrary URLs from the browser.

### Admin UI/routes

Add dashboard-only routes under
`/api/servers/[serverId]/webhooks` (list/create) and
`/api/servers/[serverId]/webhooks/[webhookId]` (update/delete/test). They use
`getServerContext(serverId)` and require `canAdmin`.

Add a page at:

```text
/[locale]/dashboard/servers/[serverId]/system/webhooks
```

The UI must list URL, enabled state, event selections, last delivery/failure,
and provide create/edit/delete/test controls. Reveal a new/rotated signing
secret once with a copy control and warning. Do not put the secret in page
props after first reveal.

## System settings area

### Navigation

Modify `src/components/app/app-sidebar.tsx` to add a configuration-level
**System** navigation item for admins. Add new translation keys in all three
supported dictionaries (`en`, `cs`, and `de`), not hardcoded English.

Suggested routes:

```text
/servers/[serverId]/system                 # System overview / API keys
/servers/[serverId]/system/imports
/servers/[serverId]/system/helper-data
/servers/[serverId]/system/webhooks
```

### Move existing UI, do not duplicate it

`src/app/[locale]/(dashboard)/dashboard/servers/[serverId]/settings/page.tsx`
currently renders Website API, Imports, and Helper Data alongside normal game,
frontend, and Discord settings. Move those cards to the System pages. Keep
normal Settings limited to game, frontend, and Discord configuration.

Reuse the existing components:

- `ApiKeyManager`
- `ImportEventsButton`
- `ImportDiscordMembersButton`
- `AutoLinkPlatformIdsButton`
- `LinkMissingDiscordIdsButton`
- `MigrateMembershipStatusButton`
- `DedupePlayerStatsButton`
- `RefreshPerformanceHistoryButton`
- `HelperDataActions`

Preserve current game selection behavior for imports: default HLL when no
game is selected. The System layout/page must still call `getServerContext`
and hide content from non-admins.

Update `content/configuration/settings.mdx` (or add a focused System/API wiki
page and link it) to describe API keys, API limits, and webhook signing.

## Recommended implementation order

1. **Stabilize contracts and helpers**: define game, cursor, page, count,
   `updatedSince`, rate-limit, and idempotency helper types/tests. Remove the
   old generic `filter[field]` API contract from the intended external surface.
2. **Authenticate once correctly**: add key-to-guild authentication helper and
   a reusable authenticated route wrapper. Test missing, malformed, revoked,
   and cross-guild keys.
3. **Bounded reads**: implement `meta`, then events/groups/articles/rosters,
   using Convex queries that fetch only one resource type per request. Do not
   keep calling `getClanData`.
4. **Writes**: migrate the existing validated dashboard workflows one resource
   at a time. Add idempotency before exposing each mutation.
5. **Other reads**: assignments, presets, stratmaps, calendar, matches,
   performance history, settings, and scoped users.
6. **Webhooks**: schema, server API, dispatcher/retry, routes, and UI. Wire
   delivery enqueueing to migrated mutations.
7. **System UI move**: introduce navigation and pages; remove moved cards from
   Settings. Update all three locale dictionaries and wiki content.
8. **OpenAPI and cleanup**: generate/hand-maintain accurate docs for only
   supported operations; remove obsolete bulk clan route and its contract/tests.

## Test and acceptance checklist

- A request with no `game` returns HLL plus legacy missing-game records; an
  explicit non-HLL game and `game=all` behave correctly.
- List limits above the cap, invalid cursors/sorts/dates, and arbitrary filter
  traversal are rejected with 400.
- No endpoint sends a complete clan database payload or unbounded list.
- Each resource cannot be read or changed by a key belonging to another guild.
- Authenticated data includes the agreed private clan data; public routes do
  not begin leaking it.
- Every write performs the same validation/business workflow as its dashboard
  equivalent and is safely replayable with `Idempotency-Key`.
- Same idempotency key + same body returns original result; same key + changed
  body returns 409.
- Successful supported mutations enqueue exactly one webhook delivery; test
  events use HMAC verification, record success/failure, and retry as designed.
- Secrets and bearer keys never appear in responses except one-time creation /
  rotation reveal, logs, or OpenAPI examples.
- API key, Imports, Helper Data, and Webhooks appear in System; normal Settings
  no longer duplicates them. Navigation works for `en`, `cs`, and `de`.
- Run focused tests, `npm run test`, `npm run typecheck`, `npm run format:check`,
  and `npm run build` before handoff. Manually verify the System pages in the
  browser if a preview is available.
