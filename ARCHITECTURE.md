# Architecture

## Purpose

This repository serves three runtimes:

- the Next.js dashboard in `src/app`
- Convex cloud functions in `convex/`
- the Discord bot in `discord-bot/`

The architecture goal is to keep business behavior understandable without having to understand all three runtimes at once.

## Rule Of Thumb

Code should flow inward:

1. frameworks receive input
2. adapters load and save data
3. application use-cases orchestrate work
4. domain modules decide behavior

Domain code must not depend on Next.js, Convex, or Discord.js.

## Layers

### `src/domain`

This is the business core. It should contain:

- entities and value-oriented types
- pure policies
- validation rules
- derivations and state transitions

It must not contain:

- `ctx.db`
- `NextRequest`
- `discord.js`
- cache invalidation
- HTTP response logic

Current domain modules:

- `src/domain/events`
- `src/domain/rosters`
- `src/domain/assignments`
- `src/domain/shared`

Examples:

- `deriveEventStatus`
- `toggleSignup`
- `upsertNotice`
- `mergeRosterWithEventState`
- `setRosterAttendanceStatus`

### `src/application`

This layer coordinates use-cases. It depends on interfaces rather than framework APIs directly.

It should contain:

- use-case classes
- ports and repository interfaces
- orchestration between multiple domain modules

It should not contain low-level storage details or Discord API details.

Current application modules:

- `src/application/assignments`
- `src/application/discord-sync`
- `src/application/events`
- `src/application/ports`
- `src/application/rosters`

Example:

- `UpsertAssignmentUseCase`
- `RemoveAssignmentUseCase`
- `ToggleSignupUseCase`
- `UpsertNoticeUseCase`
- `SyncRosterMembershipForEventUseCase`
- `SyncRosterMembershipForUserUseCase`

### `src/infrastructure`

This layer adapts external systems to the application and domain layers.

It should contain:

- Convex repository implementations
- Discord gateways
- testing fakes
- clock/logger implementations

Current infrastructure modules:

- `src/infrastructure/convex`
- `src/infrastructure/testing`

### `src/app` and `src/lib`

These are the web-facing layers.

`src/app` should own:

- pages
- route handlers
- request parsing
- response formatting

`src/lib` contains web-facing wrappers and utility modules. Its role should stay narrow:

- web-specific gateways
- presentation helpers
- cache orchestration

Business rules should not live in `src/lib/server-*` modules. Those files should delegate to read-models, gateways, and use-cases.

### `convex/`

Convex files are cloud function entrypoints and persistence adapters.

A Convex mutation or query should ideally do only this:

1. validate input
2. authenticate or verify internal secret
3. load data using `ctx.db`
4. delegate rule decisions to shared domain/application modules
5. save changes
6. return serialized results

Convex files should not be the long-term home of business rules.

Every exported `query`, `mutation` and `action` is reachable by anyone who
knows the deployment URL, which the browser bundle contains. Each one must
therefore establish its caller itself, in one of three ways:

- the internal secret (`secret` argument checked with `assertInternalSecret`)
  for calls from the Next server, the bot and scripts;
- a dashboard session or actor gateway (`assertSessionGateway`,
  `authorizeDashboardAdmin`, `authorizePlatformAdmin`) when the server acts for
  a signed-in person;
- a client grant (`verifyClientGrant` in `convex/clientGrants.ts`) for the few
  live browser subscriptions and edits. The page signs it with
  `issueClientGrant` after checking the session; Convex takes the user from the
  grant, never from a browser-supplied `userId`.

A caller-supplied user ID is only trustworthy behind the internal secret.
Browser writes to workspace settings go through Next routes, not `useMutation`.
Responses for members must leave out manager secrets such as stats-server tokens
and the calendar feed capability, and unpublished rosters.

Read modules should also be split by feature. For example:

- `convex/serverContext.ts` for dashboard server context
- `convex/users.ts` for user lookups
- `convex/serverMetadata.ts` for focused metadata reads
- `convex/serverRosters.ts` for roster-specific read models

### Convex hot paths

Production runs a self-hosted Convex backend that keeps every version of a
document for the retention period. Reads and writes that recur on a timer, a
cron or a live subscription therefore decide the backend's load, and a few
careless ones can take the whole deployment down. These rules apply to every
function that such a path calls:

- No whole-table `.collect()` in anything that runs on a timer, a cron or a
  subscription. `events`, `discordPublications` and similar tables grow for
  as long as a clan exists; read them through an index that bounds the
  result to what the pass needs (the weekly series, the matches that end
  after a cutoff, one owner's publication keys).
- Bound every periodic read with an index: an equality on the owner (guild,
  series, connection) plus a range on the field the pass filters by, and a
  `.take()` where the number of rows the pass can act on is limited anyway.
  A string prefix becomes a range of `[prefix, prefix with its last
character stepped up)` on the same index (`publicationKeyRange`).
- Never rewrite a large document just to refresh a lease. A claim patches
  the lease fields only (`generation`, `fence`, `leaseUntil`, `nextAt`,
  `retainUntil`); the payload is written once, when the read finished, and
  dropped only when it stops being valid. Copying it back into the same
  document on every lease stores a new version of it each time.
- Prefer small status rows next to large payload rows. A table that is both
  read every few seconds and holds a large payload (a live read, a message
  cache) should keep the lease, timestamps and counters in a row of their
  own, so the frequent readers and writers never touch the payload.
- In the bot, run a pass that reads many rows on its own cadence (once at
  start, then every 15 minutes for the recurrence pass), not on the
  one-minute reconcile tick, and back off a pass whose backend call keeps
  failing instead of retrying it every minute.
- The request path never writes. A mutation that patches one document on
  every API request (a `lastUsedAt`, a rate-limit counter) makes parallel
  requests conflict on that document and retry inside Convex; the backend
  degraded on exactly this. Authenticate through a query, count rate limits
  in the web process, and record usage from a separate mutation that writes
  at most once per interval and re-checks before it writes.
- A function pays for its whole module graph. Convex evaluates a function's
  module, with everything it imports, on each fresh isolate, so under
  parallel load a function in a 1.2 MB module costs about 100 ms of CPU
  before it reads anything, while one in a 10 KB module costs a few
  milliseconds. Keep what runs on every request or every tick in small
  modules (`convex/apiKeyAuth.ts`), and keep Zod schemas, use-cases and
  repositories out of modules that only project or read. Measure with
  `npx esbuild convex/<module>.ts --bundle --platform=node --format=esm
--external:convex --metafile=out.json`.
- Zod is 537 KB once bundled and nothing of it tree-shakes, so one schema
  defined at the top level of any imported file costs the whole library. A
  domain file that exports both schemas and pure projections keeps the
  schemas in a sibling `<name>.schema.ts` (`settings.schema.ts`,
  `change.schema.ts`, `observation.schema.ts`); the pure file re-exports
  the inferred types with `export type { … } from "./<name>.schema"`, which
  is erased at runtime, and only the functions that validate import the
  schema file. The same holds for Convex modules: a helper another module
  calls inside its transaction lives in a module without function
  definitions (`imageAssetStore.ts`, `membershipAccess.ts`,
  `clanTeamStore.ts`), because `mutation({ … })` at the top level of a
  module is a side effect that bundles the module's whole graph into every
  importer. The website's per-request reads live in `publicApiReads.ts`;
  the idempotent writes, their use-cases and the stratmap catalogue stay in
  `publicApi.ts`.

Tests of these functions assert which index a read uses (see
`src/infrastructure/convex/event-recurrence.test.ts`) and which fields a
claim patches (`hll-live-cache.test.ts`), so a later change cannot quietly
bring a whole-table read back.

### `discord-bot/`

The bot is a runtime adapter. It should:

- listen to Discord events and interactions
- load or write data through Convex
- render messages, components, and embeds
- call shared business logic where behavior is not Discord-specific

The bot should not own the core rules for rosters, signups, or membership state.

## How Runtimes Communicate

### Dashboard

The dashboard reads data either:

- through Convex-backed server helpers in `src/lib`
- through Next.js API routes

The dashboard should not contain business rules beyond simple UI state and formatting.

### Convex

Convex is the persistence and transaction boundary.

This means:

- domain logic can be pure and stateless
- use-cases can be framework-agnostic
- the actual read/write transaction still happens inside the Convex function

### Discord Bot

The bot talks to Convex using function references in `discord-bot/src/convex.ts`. Shared scheduling, payload, and rule decisions should live in `src/domain` or `src/application`, leaving bot files focused on Discord API work.

## Domain Split

The current target split is:

- `events`
- `rosters`
- `assignments`
- `discord-sync`
- `match-results`
- `membership/tickets`
- `users`

Migration order matters. The highest-priority slices are:

1. events
2. rosters
3. assignments
4. discord-sync

## Testing Strategy

There are three intended test layers.

### Unit Tests

Unit tests target `src/domain`. These should be the majority of the suite.

Good unit test targets:

- event status transitions
- signup behavior
- notice windows
- roster merge behavior
- assignment validation

### Use-Case Tests

Use-case tests target `src/application` with fakes or in-memory adapters.

These tests verify orchestration:

- which repositories are called
- which objects are saved
- multi-step business workflows

### Integration Tests

Integration tests are most useful for:

- Convex entrypoints
- Next route handlers
- Discord interaction flows

These tests should be fewer and focused on wiring, not every edge case.

## File Placement Rules

When adding new code:

- pure business rule: put it in `src/domain/<module>`
- workflow spanning repositories or multiple domain policies: put it in `src/application/<module>`
- adapter to Convex/Discord/HTTP/cache: put it in `src/infrastructure` or runtime-specific folders
- React UI concern: put it in `src/components` or `src/app`

If a file needs `ctx.db`, `NextRequest`, or `discord.js`, it is not domain code.

## Adding A New Module

For a new domain such as `notifications`:

1. create `src/domain/notifications`
2. add types and pure policies first
3. add tests beside those policies
4. create `src/application/notifications` if orchestration is needed
5. add adapters from Convex or the bot only after the domain behavior is defined

Recommended pattern:

```text
src/domain/notifications/
  notification.types.ts
  notification-policy.ts
  notification-policy.test.ts

src/application/notifications/
  send-notification.use-case.ts

src/application/ports/
  notification-repository.ts
```

## Editing Existing Behavior

When changing an existing feature:

1. find the domain rule first
2. update or add tests
3. update the application use-case if orchestration changed
4. update Convex/web/bot adapters only if required

If the change currently lives only in a Convex file, prefer extracting the rule into `src/domain` before adding more logic there.

## Transitional State

Remaining exceptions should be rare, explicit, and documented. There should be no intentional grab-bag Convex read module.
