# Capability evidence, 2026-09-28

Historical baseline only. Later milestones implement several missing rows below;
use the [current PR handbook](../v0.10/pr-handbook.md), [web catalog](../v0.10/web-capabilities.md)
and [Discord reference](../v0.10/discord-reference.md) for delivery status.

Baseline: `6fbfe4e7d9c41e9a5bdc004c65f1e2d935c86e0b`. Source and isolated tests are
evidence for implementation only. Hosted tenant behavior is unverified throughout.

| Capability | Supported / missing / unverified | Evidence and integration consequence |
| --- | --- | --- |
| Events, training, registrations, signup windows | Supported in source and shared use-case tests | `src/application/events/*`, `convex/events.ts`, `convex/publicApi.ts`; reuse Logi workflows. |
| Rosters, reserves, attendance, membership sync | Supported in source and tests | `src/application/rosters/*`, `src/domain/assignments/*`; operational authority stays in Logi. |
| Discord announcements, buttons, forum and scheduled events | Supported in source; simulated tests; one baseline embed sorting test fails | `discord-bot/src/message-builders.ts`, `scheduled-events.ts`, `sync/events.ts`; live channel permissions and rendering unverified. |
| Signup/attendance reminders and delayed registration announcements | Supported in source and tests | `sync/signup-reminders.ts`, `sync/attendance-reminders.ts`, `src/domain/events/registration-announcement.ts`; no duplicate bot needed. |
| Result import, recap announcements and notification opt-out | Supported in source and tests | `src/lib/server-match-results.ts`, `discord-bot/src/sync/match-recaps.ts`, `src/domain/match-results/*`; raw telemetry is not authoritative confirmation. |
| HLL CRCON scoreboard import | Supported source adapter and normalization tests | `server-match-results.ts` imports `/api/get_map_scoreboard`; exact external session/event mapping must be retained. Real provider credentials unverified. |
| HLL/Wardogs event game fields and filtering | Supported; scoped backend fixture tests added | Stable persisted IDs are in `src/domain/games/game.ts`; explicit Wardogs selection is mandatory. |
| Live game-server status projection | Missing from current authenticated integration surface | No new server endpoint; `discord-bot/src/platform-status.ts` reports Logi services, not game-server telemetry. Unknown stays unknown. |
| Wardogs game-server controls | Unverified / no adapter established by this review | Game selection and HLL imports are not control support. Require a provider-specific contract, authorization and audit before implementation. |
| Resource/game scoped read-only keys | Added and tested in this milestone | Optional `readAccess`; all backend mutations deny before idempotency replay; existing revoke lifecycle retained. Legacy keys are still write-capable. |
| Cursor pages and incremental reads | Supported; isolated backend tests | Pages may be empty after game filtering and still have a cursor. Roster/user update indexes differ from creation-order collections; no global snapshot guarantee. |
| Durable outbound webhook queue, signatures and retries | Supported in source and isolated tests | `convex/webhooks.ts`, `convex/webhookDispatcher.ts`, `src/infrastructure/webhooks/*`; enqueue coverage is not universal across all dashboard/Discord mutations. |
| Durable consumer inbox, recovery and deletion reconciliation | Missing in this repository's website handoff | Website implementation required; fixture acceptance criteria provided. Do not claim an in-memory mock proves durable production deduplication. |
| Public-member consent and permission freshness projection | Missing from this milestone | Website owns public consent and explicit grants; raw operational user records are not public profiles. Restricted keys exclude raw users. |
| SSO | Source exists; production acceptance remains separate and unverified | Private offline review only. No hosted auth requests and no public disclosure of private review details. Keep consumer SSO disabled pending acceptance. |
| English command names with Czech help and fallback | Existing upstream support | `discord-bot/src/interactions.ts` registers English names with Czech/German description localizations and English fallback. No commands changed. |

The authenticated read contract is documented by API 1.1.0 in this branch. The
unauthenticated hosted OpenAPI retrieved on 2026-09-28 advertised 1.0.0; this does
not establish which changes or runtime semantics are deployed. No real tenant
key, Discord message, RCON command or SSO exchange was used for verification.
