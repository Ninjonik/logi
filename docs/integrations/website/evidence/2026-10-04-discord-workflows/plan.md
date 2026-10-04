# Discord workflow acceptance plan

Baseline: `0eec5d4b6dce1daf2f5f9aea3026136308b49196`.

The owner requested completion of the remaining Discord workflows and the
previously agreed private player reports and CRCON live-panel extension. Keep
delivery in PR #158. Use the authorized Dorfmada test channel and isolated local
Convex; do not deploy to production. Only synthetic tickets/applications and
explicitly identified test accounts are eligible for side effects.

| Area | Required evidence |
| --- | --- |
| Legacy commands | Real `/player`, `/link`, `/notice`, ticket/application opening and closure; saved state and privacy/permission assertions |
| Events | Signup/change/withdrawal, notice persistence, published roster and reminder/recap controls; separate renderer proof from actual worker delivery |
| Player stats | Linked-member lookup, recorded-player/server search, periods and empty/error states; distinguish live history from fixture data |
| Player reports | Source-bound entry, private selection/modal, one tracked private ticket, staff/reporter access, duplicate/failure recovery and closure |
| HLL live panels | Typed public/live CRCON reads, connected-only leaders, map artwork, separate freshness, privacy opt-in, private details and scoped API parity |
| Final regression | Tests, typecheck, build, local Convex deploy, exact tested revision, screenshots and a security review with explicit scope |

For each repair, add a failing regression before changing behavior. Cover real
handler wiring as well as pure rules. Use injected failures for concurrency and
transport edge cases; do not induce Discord rate limiting or provider failures.
Record any missing second-account, populated-provider or hosted acceptance as
unverified. This plan is not a record of passed checks.
