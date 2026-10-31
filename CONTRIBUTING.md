# Contributing

## Principles

Contributions follow these principles:

- isolated business logic
- smaller framework entrypoints
- explicit domain boundaries
- test coverage around edge cases

Avoid adding new business behavior directly into:

- `convex/*.ts`
- `src/app/api/**`
- `discord-bot/src/interactions.ts`

unless the behavior is truly adapter-specific.

## Before You Change Code

Identify which kind of change you are making:

- UI-only change
- domain rule change
- workflow/use-case change
- integration or adapter change

Then edit the correct layer first.

## Expected Workflow

1. Add or update tests first when touching business rules.
2. Keep domain modules pure.
3. Keep use-cases explicit and narrow.
4. Keep Convex, web routes, and Discord handlers thin.
5. Run tests and typecheck before finishing.
6. Update the matching public wiki page in `content/` whenever a user-visible feature, permission, workflow, condition, or screen changes. Add new wiki coverage for new features.

## Testing Commands

```bash
npm run test
npm run test:domain
npm run bot:test
npm run typecheck
```

## Where To Put Code

### Business rules

Put them in `src/domain/<module>`.

Examples:

- state transitions
- validations
- policy decisions
- derived statuses

### Workflows

Put them in `src/application/<module>`.

Examples:

- loading several aggregates
- calling multiple repositories
- deciding save order

### Adapters

Put them in:

- `convex/` for Convex entrypoints
- `discord-bot/` for bot runtime handlers
- `src/app` and `src/lib` for web-facing integration
- `src/infrastructure` for reusable implementations and fakes

## Testing Expectations

For business changes, include tests for:

- normal flow
- invalid flow
- edge cases
- regression cases you are fixing

If a piece of code is hard to test, that is usually a sign it belongs in a different layer.

## Current Runtime Split

- `src/domain` owns pure rules such as event state, signup rules, roster sync, attendance transitions, and score calculation.
- `src/application` owns workflows such as event upsert/conclude/reconcile, roster upsert, roster attendance updates, assignment changes, and Discord sync payload shaping.
- `src/infrastructure/convex` owns repository implementations for those use-cases.
- Focused Convex read modules such as `convex/serverContext.ts`, `convex/serverMetadata.ts`, `convex/serverRosters.ts`, and `convex/users.ts` should stay feature-scoped.
- `convex/*.ts` should validate input, create repositories/use-cases, and persist adapter-specific results.
- `discord-bot/src/*.ts` should parse Discord events, call Convex or shared modules, and render Discord output.

## Read Models And Gateways

- Add Next.js read access through `src/lib/read-models/*`.
- Add write-side web integration through `src/lib/gateways/*`.
- Avoid adding new grab-bag `server-*` modules. If a compatibility wrapper is needed, keep it thin and re-export from a focused read-model or gateway.

## Shared Write Infrastructure

Equivalent dashboard, integration, and bot writes use one application operation
and one persistence implementation. Separate authenticated entrypoints are
expected; a separate copy of the business workflow is not. SSR and server
actions can call their Convex gateway directly without an HTTP round trip to
Logi's own `/api/v1` endpoints.

```text
Dashboard action/route -> session-authenticated Convex adapter --+
Integration /api/v1    -> key/actor-authenticated Convex adapter -+-> shared application command
Bot interaction       -> trusted Convex adapter ----------------+       -> repository port
                                                                      -> Convex repository adapter
                                                                      -> database transaction
```

Current examples:

| Operation                                              | Shared application implementation                    | Persistence implementation                                 |
| ------------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------- |
| Articles                                               | `src/application/articles/article-commands.ts`       | `src/infrastructure/convex/article-repository.ts`          |
| Groups and assignment cleanup                          | `src/application/groups/group-commands.ts`           | `src/infrastructure/convex/group-repository.ts`            |
| Calendar items and explicit collection replacement     | `src/application/calendar/calendar-item-commands.ts` | `src/infrastructure/convex/calendar-item-repository.ts`    |
| Roster scope checks, save, publication, draft deletion | `src/application/rosters/manage-roster.ts`           | `src/infrastructure/convex/roster-command-repositories.ts` |
| Squad and topic preset saves                           | `src/application/presets/save-preset.ts`             | `src/infrastructure/convex/preset-repositories.ts`         |
| Stratmap metadata and initial state                    | `src/application/stratmaps/save-stratmap.ts`         | `src/infrastructure/convex/stratmap-repository.ts`         |

When adding or changing an operation:

1. Trace every dashboard, v1, and bot caller. Change the common policy/use-case
   first, with explicit ports for persistence, time, and external effects.
2. Authenticate at each entrypoint and pass trusted actor/tenant scope. Shared
   resource ownership, game compatibility, validation, and dependent writes must
   have one implementation inside the Convex transaction. Keep intentional
   capability differences explicit, such as dashboard-only Discord publish
   choices and API exclusion of draft events.
3. Keep transport concerns outside that workflow: parsing and response mapping,
   API scopes/rate limits, idempotency receipts, and Next.js cache invalidation.
   Generic clan v1 writes use `src/lib/gateways/clan-write-cache.ts` and
   `src/lib/api/clan-mutation-response.ts` to invalidate reads while preserving
   the recorded HTTP response. A cache failure is logged without turning an
   already committed write into an HTTP write failure.
4. Preserve existing v1 paths, status codes, field semantics, omission/clearing
   behavior, and response envelopes. Ask the maintainer about conflicting
   product rules before resolving them. Squad order numbers are supplied data;
   topic IDs and optional message blocks must not be synthesized on save.
5. Add parity/regression tests at the application and adapter layers as needed.
   Cover normal and invalid writes, tenant/game boundaries, dependent state,
   publication, retries, and cache effects. Existing examples are
   `src/infrastructure/convex/shared-management.test.ts` and
   `src/lib/api/clan-mutation-response.test.ts`.
6. Update the feature's v1 contract/OpenAPI and public wiki when behavior changes,
   then run focused tests, the complete suite, typechecking, and Convex bundle
   checks. Deploy Convex as required by [AGENTS.md](AGENTS.md#commands).

Read models can remain different: dashboard aggregates, paginated API resources,
and live queries serve different contracts. Share their policies and projections
when appropriate without dropping authorization, scoping, or field redaction.

## Testing Placement

- Put pure rule tests next to the domain module.
- Put orchestration tests next to the use-case in `src/application`.
- Put adapter and normalization tests in `src/infrastructure` when mapping is the risk.
- Add integration tests only for important runtime wiring paths.

## Namespace changes

- No intentional compatibility shim should be preserved just to keep an old Convex module namespace alive. Update the callers instead.

## Notes For Frontend Changes

Frontend components should:

- stay focused on rendering and user interaction
- call routes or server helpers for side effects
- avoid carrying hidden business logic

If a component needs complicated rule logic, move that logic into a domain or application module first.

## Notes For Discord Bot Changes

Bot handlers should:

- parse Discord interactions
- call Convex or shared logic
- render Discord-specific output

Do not embed general signup or roster rules directly in handlers if the dashboard or Convex layer also depends on them.
