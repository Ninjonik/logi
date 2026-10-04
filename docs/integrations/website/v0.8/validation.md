# I3 offline validation

Date: 2026-09-29. Milestone base: `c71da56d76b320192f8f7b9657750d89ba15007c`.
The delivery PR records the exact tested revision. This extends the existing
collector/synchronization/membership branch without merging separate upstream SSO
work. No real guild, token, hosted OAuth, game provider or deployment was exercised.

## Commands and results

Use synthetic environment variables before tests and build (PowerShell):

```powershell
$env:NEXT_PUBLIC_CONVEX_URL='http://127.0.0.1:32199'
$env:CONVEX_SELF_HOSTED_URL='http://127.0.0.1:32199'
$env:INTERNAL_AUTH_SECRET='dev-internal-auth-secret'
$env:DISCORD_BOT_TOKEN='offline-synthetic-bot-token'
$env:JWT_SECRET='offline-synthetic-jwt-secret-32-characters'
$env:NEXT_TELEMETRY_DISABLED='1'
node --import tsx --test src/domain/membership/managed-roles.test.ts src/application/membership/reconcile-managed-roles.test.ts src/infrastructure/convex/member-role-operations.test.ts src/infrastructure/discord/managed-roles.test.ts discord-bot/src/sync/managed-member-roles.test.ts src/lib/api/member-role-operations-route.test.ts
npm test
npm run typecheck
npm run generate:openapi
npm run build
```

- I3 focused: **35/35 pass**. Domain/use-case, actual persistence handlers, transport,
  bot adapter and operator HTTP tests run without live provider access.
- Complete suite: **473 tests, 472 pass, one unchanged baseline failure** at
  `discord-bot/src/message-builders.test.ts:434`: expected `Alpha\nDelta\nGolf`,
  actual `Alpha\nEcho\nCharlie`. Neither that implementation nor its test changed.
  An initial run without the synthetic environment failed setup; it was not counted
  as runtime evidence. The results above are from the corrected complete run.
- `npm run typecheck`: pass. `npm run generate:openapi`: pass, no contract drift.
  OpenAPI 1.5.0 remains unchanged because role commands/audit are not service-key APIs.
- Direct ESLint across changed branch TypeScript/TSX/MJS: the three pre-existing
  explicit-any errors in `convex/competitions.ts:52/54/58` and 15 existing unused
  warnings. The broader I3 file list includes four more pre-existing warnings than
  the earlier I1 list. New I3 files have no errors/warnings. Existing `npm run lint`
  still targets unsupported `next lint`; use direct ESLint for actionable results.
- Production compilation and TypeScript: pass. Full build remains blocked while
  prerendering `/cs/competitions`: `ECONNREFUSED 127.0.0.1:32199`, the intentionally
  absent synthetic Convex endpoint. A fully completed production build is not claimed.
- Actual CS/EN/DE component, failure/retry, workspace isolation, keyboard audit and
  mobile viewport: [screenshots and procedure](./ui-validation.md).

Format new/changed I3 TS/TSX/MJS/JSON with repository Prettier. Preserve the existing
semicolon/two-space style in `convex/userAssignments.ts` to avoid unrelated churn.
Run direct ESLint on the files from `git diff --name-only` relative to the feature
ancestor, plus untracked I3 source files before commit. Check `git diff --check`.

## Behavior covered

Tests cover unmanaged roles; recruit/active/reserve/mercenary/pending transitions;
cross-game role ownership and shared clan preservation; revoked actors; deleted
roles/hierarchy; departures and rejoins; timeout after a successful side effect;
desired-version supersession; expired leases and stale completion; Retry-After;
actual dashboard/legacy group configuration conflicts; legacy assignment API with
no role authority; unlinked player edits; verified convergence before applied;
bounded audit retention; tenant-only operator listing; authority revocation during
the HTTP read; and the versioned closed fixture schema.

Regression failures were observed before fixes for initial missing implementations,
convergence proof, audit bounds, second-writer ownership and unlinked identities.
The final review added eight regressions, including independently reproduced OAuth
and role-cache revocation, explicit grants/denials, linked imported players, numeric
unlinked players, relink/unlink/user replacement, alias locks/versions and self-application
departure checks. The bot regression additionally checks the explicit provider subject.
Their RED outputs returned stale `ready`, rejected a valid linked player, accepted an
unlinked numeric player, or failed to share/supersede identity. All are now GREEN;
the unchanged complete-suite baseline is disclosed above. [Review disposition](./review.md).
No tests contact Discord. Convex handlers run against the isolated transactional
database fixture, which simulates rollback/index reads, not a deployed Convex service.

The tests do not establish real distributed scheduling, Convex transaction limits,
Gateway/REST ordering, bot hierarchy/permission configuration or sustained load.
Review the cross-system race and activation/rollback limits in the [handoff](./README.md).
