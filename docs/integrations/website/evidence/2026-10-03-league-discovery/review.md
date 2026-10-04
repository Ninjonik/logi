# Review and security acceptance

## Immutable review scope

Reviewed `e9523230565a1a3086bbb15164f01d645a040923..ad0951ac01a2c2c2f12086eaf79c05fd35bc43dc`: the new League increment, 53 changed paths including all 45 source/test/configuration paths, plus relevant authorization, transport and publication dependencies. New modules were read in full; existing files received diff/context review. This is not a new audit of every historical PR #158 change.

The host rejected a fresh reviewer spawn with `agent thread limit reached`. An existing independent reviewer completed a read-only review; a separate architecture review informed the threat model. The fresh-context requirement was therefore not fully met. The source reviewer ran no tests or network requests; execution evidence below came from the parent worker.

Codex Security scan `eb5ae138-5330-4249-aaeb-af28f960b998` completed and sealed on 2026-10-03 at 18:53:24 UTC. Its immutable target is **ad0951a**, before fixes. It reported **one Medium finding**, not a clean verdict. The scan used no production database or remote exploit. Advisory Daybreak Blue access was granted.

## Findings and repairs

| Finding | Demonstration | Repair and verification |
| --- | --- | --- |
| Medium availability issue: human URLs exhaust shared durable capacity (`CWE-400`, `CWE-770`; `csf_92aff13cbe304fc241111996`) | Actual offline Convex handlers admitted 500 unverified IDs in 167 messages across nine allowed minute windows. New scanner entry was skipped; admin add failed with `Tracking limit reached`; Ignore retained all rows. | Persistent 50-record untrusted intake budget also covers existing scanner candidates. Fifty slots remain reserved for administrators. Safe transactional reclamation preserves history, explicit intent, active references/leases and every publication record. Quota and reclamation regressions fail before the repair and pass afterward. |
| Important functional issue: reference cleanup lost when intake is disabled or moved | Backend rejected deletes while disabled; worker discarded edits from the old room. | New admission is separate from cleanup of an existing versioned receipt. Regressions cover disabled/moved settings, attempted new IDs, deletion and replay. Actual Discord edit after moving input was observed in the isolated database: reference removed, pin and automatic reasons preserved. |
| Important functional issue: incomplete index reported as complete | A `Load more` button was missed; an empty header/tab shell was accepted as an empty list. | Continuation buttons/ARIA labels are recognized; unverified empty shells fail validation and retain the last valid index. Both cases have failing-before/passing-after tests. Unsupported pagination is still not traversed. |
| Acceptance regression: Resume briefly removes a stored fixture from the read API | Repeated actual HTTP sync acceptance received a removal envelope immediately after resuming an ignored match while refresh waited in the queue. A focused handler test reproduced the missing fixture. | Resume immediately reprojects the stored snapshot and queues a fresh read, preserving source age. The regression and repeated HTTP/change-feed acceptance pass after repair. |
| Archived reactivation gap | Expired unresolved rows could rearchive before any read after Resume. | **Refresh once** attempts one source read, then reapplies the original seven-/fourteen-day archive horizon. Tested with an expired unresolved row and an old kickoff. |
| Generated declarations absent from implementation commit | Offline Convex inventory generation found six modules missing from `api.d.ts` (12 lines). | Regenerated declarations included in the repair; generated-file parity is checked separately from ordinary Prettier formatting. |

The sealed scan is preserved unchanged. Repairs and regression evidence are later commits; there is no claim that the sealed scan audited those later bytes. One repair pass followed the independent review, with the HTTP-discovered Resume regression included before final acceptance.

## Confirmed boundaries

- Dashboard actions derive current authority from the session and recheck durable revocation. Service keys cannot administer tracking.
- Explicit `league-fixtures` grant, guild and Wardogs game scope are enforced; legacy keys do not gain the resource.
- A settings revision and row fence prevent old in-flight source work from committing under a changed policy.
- Exact URL/redirect identity, public-address pinning, response/time bounds and no script execution constrain external HTML.
- Existing managed publication ownership, durable pending markers and ambiguous-send recovery preserve message identity across restart.
- Public DTOs exclude local notes, credentials and Discord intake references. Unknown outcomes stay null.

## Decisions and limitations

- Kept one coherent implementation commit and a repair commit in the same PR, rather than the plan's per-task commits. Cost: less granular implementation reverts.
- External fixtures use their own scoped resource; native events remain the owner of rosters/attendance. Cost: the website needs an explicit new consumer.
- The inherited shared limiter counts **20 logical fetches/minute**, each with up to three validated redirects (at most 80 HTTP hops/minute). The initial plan's “20 origin requests” wording was corrected instead of redesigning the existing transport limiter.
- An unrecognized empty listing fails closed until real empty-state markup is verified. Cost: a genuinely empty provider page can show a stale/error state.
- Retained history, pins, ignored entries and publication recovery are never evicted to create capacity. A genuinely full retained collection still needs operator retention work. A human-intake quota can fill; administrators can pin legitimate links independently.
- **Refresh once** does not extend the archive horizon. A recovered schedule can change the computed horizon through actual source data.
- No retrospective assertion that every originally planned test was first run RED. The review/Resume regression failures are retained explicitly.
- Deferred minor findings: none. The independent reviewer did not promote any minor findings.

Not accepted here: production deployment, entire historical PR security coverage, completed-match outcome/no-show/dispute extraction, arbitrary Gateway-outage backfill, actual Discord bulk deletion, website rendering of this new collection, Report Player privacy, or HLL-specific new live panels.
