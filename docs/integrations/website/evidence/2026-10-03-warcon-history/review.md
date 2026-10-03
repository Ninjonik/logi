# Warcon history review and disposition

The independent review examined every file in `af5a52a08b79b23e0ee491ee627887114424610d..051457a4afe744e0b8d991348f2d00e02bf3e64e`: 47 changed files, including 37 source inventory items. It also followed authorization, persistence, transport and session dependencies. This is the retained-history increment, not a new review of every earlier change in PR #158.

## Correctness finding and repair

**P2: repeated faction metadata could count one win twice.** The original provider detail and retained metadata schemas accepted two entries with the same faction name. The final-score participants could still be unique. Passing such a detail through the real Warcon mapper, retained record validator and report builder produced one game with two wins and a 200% faction share.

Correction `424e118b24e106ecc0b038d1f7698a24ac942d3f` rejects duplicate faction names at both boundaries. The provider reports `invalid_response`; a malformed retained record also cannot enter the report. There is no silent arbitrary choice of one conflicting color/name entry.

Two regressions were first observed failing, then passing:

- `completed-game import rejects duplicate faction metadata even with unique final scores` in `src/infrastructure/game-data/warcon.test.ts`;
- `duplicate faction metadata cannot inflate retained wins or appearances` in `src/domain/game-data/history-report.test.ts`.

The focused run passed 17 tests. The final full run passed 844 tests, with TypeScript and changed-source ESLint passing. Local Convex deployment succeeded against `http://127.0.0.1:32290`; post-fix HTTP pagination, correction, cursor invalidation, caller binding, revocation and disabled-source retention were repeated successfully. [Checks](checks.json) identify the final runtime revision and evidence digests.

The final production build passed on the corrected runtime. A subsequent generated-contract parity check exposed import/comment formatting drift between the installed Convex CLI and the repository's offline generator. Commit `902266798ad052b5ea0de08957b8efd653c3a6a8` contains that generator's output; function module inventory and exported types did not change. Repeated generation leaves no diff, and the follow-up typecheck passed.

## Security result and limits

Authoritative scan `e3ad749b-a19f-4ea0-bedd-bfbeec4821d3` completed with 37/37 source items covered, preflight 3/3 and **zero confirmed security findings**. See the [sealed report](security-review.md). The correctness defect does not grant additional authority: the configured provider already supplies the winner/game facts.

Reviewed controls include current API-key grants/revocation, durable dashboard session/admin checks, workspace-owned detail and sync reads, signed caller/filter/revision-bound cursors, bounded database pages, complete-report enforcement, React text rendering and restricted faction colors. The reviewer independently ran 27 focused tests on the original head.

The scan remains immutable at `051457a4`; the repair was verified through failing-then-passing regressions and the full suite rather than relabeling it as part of the earlier scan. No production deployment, hosted acceptance, provider write or real-player screenshot is claimed. References under `artifacts/` in the sealed report refer to its local scan package; the shipped regressions reproduce the repaired defect.

## Decisions retained

- Continue on the existing feature branch and PR with authorized local verification; production remains untouched. Cost: hosted activation is still a separate delivery step.
- Assemble reports from bounded pages at one dataset revision. Cost: a large archive may require a narrower date range or larger explicit consumer budget; incomplete totals are never shown as complete.
- Commit the archive, grant and dashboard together because they share the additive resource contract. Cost: a larger implementation commit; focused tests and the full review cover the boundaries.
- The generic metadata schema can express contradictory winner/outcome pairs, but the sole production mapper derives both from the same normalized winner. No reachable contradiction was confirmed, so no separate bug is asserted. A future producer must preserve this coupling or strengthen the schema before accepting independent outcome fields.

No unresolved confirmed correctness or security findings remain in this increment. The approved team-directory design, Valkyria www presentation and production activation remain separate work.
