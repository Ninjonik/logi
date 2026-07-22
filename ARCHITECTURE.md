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

Read modules should also be split by feature. For example:

- `convex/serverContext.ts` for dashboard server context
- `convex/users.ts` for user lookups
- `convex/serverMetadata.ts` for focused metadata reads
- `convex/serverRosters.ts` for roster-specific read models

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
