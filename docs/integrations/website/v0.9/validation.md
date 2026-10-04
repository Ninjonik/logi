# I5 implementation evidence

Base: `151f94af7b7266e33f84b4e401d939ea2ab2377f`. Commit containing this document
is the I5 implementation snapshot. Fresh branch review follows I5 and D4 together.

## Checks

- Domain, application, Steam transport and persistence/HTTP tests were written and
  observed failing before implementation. The transport test executes the real
  pinned library with a synthetic HTTP response; it does not perform cryptography
  against a live assertion.
- Focused command: `node --import tsx --test src/domain/identity/platform-link.test.ts src/application/identity/verify-platform-link.test.ts src/infrastructure/steam/openid-verifier.test.ts src/infrastructure/convex/platform-identity-links.test.ts src/lib/api/platform-links-route.test.ts`.
- `npm run typecheck` passes. Direct ESLint on I5's changed TypeScript files passes.
- Focused result: **18/18 pass**. Full suite before the final additional bounded-history
  assertion: **490 total, 489 passed, one baseline failure**; the added test also passes.
- Full-suite evidence requires the documented synthetic environment from
  [0.8 validation](../v0.8/validation.md). A first run without it failed loading
  environment-dependent bot modules; it was rerun correctly. The unchanged
  `buildEventEmbed` column-order assertion remains the only suite failure.
- [Actual synthetic browser verification](ui-validation.md) covers CS/EN/DE,
  callback, unlink/history, provider failure, retry and narrow viewport.

The in-memory database fixture serializes competing attempts and exercises
rollback; it is not evidence of real multi-process Convex contention. Actual
indexed mutation reads/writes rely on Convex serializable transactions. No
deployed schema, hosted callback, live provider or Discord call was made.
Production build and final cumulative review are recorded in the D4 delivery.

## Decisions and costs

- The existing plan uses `I5` rather than `Task I5` headings, which `task-start`
  cannot parse. The exact brief was extracted manually; evidence remains in the
  local task ledger. Cost: task extraction was checked manually.
- Choose pinned `passport-steam-openid` and a bounded transport instead of the
  initially evaluated unbounded verifier. Strict provider response compatibility
  is intentional. Cost: a changed Steam response needs a reviewed adapter update.
- One active Steam identity per account; unlink before replacement, and revoke
  proof on identity merges/administrative relinking. Cost: affected users must
  verify again; old claimed platform IDs are deliberately preserved.
- Retain 20 proof history entries, ten challenges and 24-hour nonce digests with
  bounded opportunistic cleanup. Cost: longer audit retention requires a separate
  deployment export; dormant nonce rows can remain until another link start.
- Management is account-session-only, with same-origin writes. No clan bearer
  API lifecycle is exposed. Cost: external apps cannot link on the user's behalf.
- Cookie logout cancellation is best effort during persistence failure. This
  does not repair the separate existing global JWT/logout model. Cost: hosted
  session-revocation acceptance remains I4's independent responsibility.
- Preserve the existing unrelated embed-order test failure and unsupported
  `next lint` script; use direct ESLint for this milestone. Cost: full upstream
  checks remain non-green until their separate fixes.

These choices are implementation rulings under the existing integration design;
none authorizes production activation or changes the website's ownership.
