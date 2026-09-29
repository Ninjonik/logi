# I5 + D4 final review record

Date: 2026-09-29. One independent fresh-context automated reviewer inspected
`a34ef149883240ab6a9eb879e845b5f71a5786e6..69c72f992513647f491e16e26ac0dc20d627db4b`,
using the cumulative package, plans/specification, implementation rulings and
source. It inspected I5's adapter and installed OpenID library, transaction and
identity paths, D4's scope/projection and cumulative collector/membership behavior.
It independently ran **95 focused tests; 95 passed**, and reproduced the finding
below with production Convex handlers over the isolated database fixture.

No files/index/branch were changed by the reviewer. Its verdict was **with fixes**:
no confirmed Critical finding, one Important/P1 finding, no new confirmed Minor.
One TDD fix pass followed; no second review was requested. This is not maintainer
approval, a production security certification or a claim that every possible path
has been audited.

## Important finding — generic events bypassed result scope

At the reviewed head, `convex/eventResultStore.ts:54–56` stored the minimized
reviewed-result head on the event. `convex/publicApi.ts:2068` spread the entire
document through its generic serializer. An `events` grant therefore also exposed
`reviewedResult` and `reviewedResultGameId`, bypassing the independent result grant.

The reviewer reproduced a confirmed HLL event moved to Wardogs. An events-only key
restricted to Wardogs could retrieve the previous HLL participants, scores,
provenance and attribution counts through generic event list/detail, even though
the dedicated result projection correctly hid the prior-game result. Private
Steam/Discord identifiers were not in that minimized head. Severity remains
Important/P1 because the documented resource/game boundary was bypassed.

### Fix and evidence

- The common serializer now calls `omitResultStorage`, dropping both storage
  fields from generic API documents. This covers event list/detail, mutation
  responses, idempotent response bodies and their generic event webhook payloads.
- Dedicated `result-summaries` remains the authorized result projection. The
  stored audit/head is preserved; the fix does not destroy or reassign results.
- OpenAPI's generator uses the same omission rule for generic event schema
  properties, examples and required fields. The generated file was regenerated.
- Three regression tests were added and observed failing before the fix. The
  read fixture was completed with the legacy event's required scheduling fields
  before confirming the intended failure (`true !== false` for exposed storage).
- Regression coverage: missing result grant; HLL → Wardogs scope move; list and
  detail; event update/conclude response and webhook; stored head retained;
  dedicated mismatched-game result remains null; generic OpenAPI excludes fields.
- The affected three-file suite passed **34/34** after the fix. Typecheck passed.
  Direct ESLint of the fix reports zero errors and four existing unused-variable
  warnings in `publicApi.ts`. Full suite: **511 tests, 510 pass, one unchanged
  baseline embed-column failure**. Full build limits remain in [validation](validation.md).

The final pushed fix commit is pinned in the PR description. Passing regressions
close this reproduced finding; they do not replace hosted authorization acceptance.

## Declined-to-judge rulings

Every reviewer exclusion was considered by the implementing agent:

| Reviewer exclusion | Ruling | Cost / remaining acceptance |
| --- | --- | --- |
| Website W1/W3/W4 and I2 | Accept ownership boundary; deliver contracts and fixtures | Website is incomplete until its owner implements those workflows |
| Hosted OIDC I4 and global JWT revocation | Accept separate private milestone; Steam challenge checks do not fix the existing global session model | Hosted logout/revocation must be qualified independently |
| Live Steam, CRCON/WDG and Discord | Accept authorized offline scope | Real provider compatibility and identity proof remain unverified |
| Real Convex concurrency, limits and load | Accept fixture limitation; actual mutations use transactional indexed reads | Must test target contention, scheduling and throughput |
| Full suite/build/lint/screenshots not rerun by reviewer | Use the implementing agent's recorded commands and actual captures, with stated failures | Those checks are not independent reproductions |
| Fresh Discord authority for D4 | Accept existing data-admin policy for result management; no I3 grant occurs | Existing stored data authority limits remain |
| Retraction, long-history export and automatic deletion | Keep separate explicit product work | Current UI reads only recent history; no new retention/export command |
| Atomic undo of a Discord effect after revocation | Preserve the documented distributed-system limit and operator recovery | Partial denied role work may need manual inspection |

Earlier I3 review and its deferred historical audit-label Minor remain in
[0.8 review](../v0.8/review.md). Current validation limits are in
[verification](validation.md).
