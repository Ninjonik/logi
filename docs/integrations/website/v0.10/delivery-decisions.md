# Delivery decisions and costs

These are implementation rulings within the existing authorized Logi scope, not
permission to deploy or change website/identity-provider repositories. Earlier
[0.8 decisions](../v0.8/delivery-decisions.md) and
[0.9 decisions](../v0.9/validation.md#decisions-and-costs) still apply.

| Decision | Reason | Cost / limit |
| --- | --- | --- |
| Execute I5 before D4 | Verified attribution needs account-owned proof | Claims remain unresolved until users verify |
| Extract D4 brief manually | Existing helper parses `Task N`, not the plan's `D4` heading | Brief extraction checked manually; task-done still records exact commit/tests |
| Keep one PR and the existing branch | Explicit user instruction | Large review is split by documented boundaries, not by PRs |
| Add `result-summaries`; retain 0.4 DTO | Confirmation must not silently redefine existing imports | Consumers explicitly adopt another resource/grant |
| Preserve the two default API key resources | An additive resource should not expand default authority | Reviewed-result access requires an extra selection |
| Use existing data-admin policy and session-derived actor | Result review is dashboard data management; no role grant | Existing policy's stored authority limits remain; this is not fresh Discord authorization |
| No bearer confirmation/linking | Service credentials identify a consumer, not a reviewer | Website links to Logi until actor delegation is accepted |
| One transaction appends audit and public head | Prevent partial publication and stale overwrites | Real Convex contention/limits still need target acceptance |
| At most 4 sources, 300 distinct players, 16 participants | Bound transaction work and response size | Larger series must be divided/reviewed separately |
| Latest 50 source candidates / 20 history rows in UI | Bound reads while retaining stored history | Older sources need a known ID; full audit export is future work |
| Manual scores for combined sessions and Wardogs | Aggregation and WDG history are not proven provider capabilities | Reviewer must choose scores explicitly |
| Frozen identity attribution at review time | Audit must describe evidence used for that decision | Unlink affects future review, not historical snapshots; public output is counts only |
| Keep legacy competition and recap semantics | Preserve existing import callers | Legacy finalization is not new human confirmation |
| Ignore malformed legacy drafts only for new review staging | Old contract permits empty participant labels | Such imports need explicit labels before a review can exist |
| Strip result storage fields from generic event responses | Final review reproduced bypass of result/game grants | Consumers use the dedicated result resource; old event schema is preserved |
| Fix the signup-order baseline within the authorized embed work; keep unrelated lint/toolchain issues separate | Root cause is host-dependent collation and compact column order | Full tests now pass; lint/build limits remain |
| Synthetic local UI and handlers | Live provider/login/Discord actions are outside this proof | No claim of deployed identity, ingestion or website acceptance |
| Bind recap recipient separately from player/data ID; recheck after Discord lookup | Imported IDs and account consent must not be confused with a Discord subject | Requires compatible optional schema and protocol-2 bot/functions |
| Withhold old unbound recaps and older delivery clients | Existing rows do not prove the intended recipient | No automatic backfill, resend or repair of prior unsubscribe clicks |
| Keep recap consent and sending outside bearer `/api/v1` | A consumer key is not the recipient's authenticated consent | Own-account dashboard/Discord action and internal delivery only; [proof and limits](recap-delivery-follow-up.md) |

## Remaining owner work

- Website W1/W3/W4 and I2: consume and reconcile data, handle restart/reset and
  duplicate deliveries, enforce fresh membership, manage sessions, consent and
  publication in its own backend. This checkout does not implement those owners' code.
- Private hosted OIDC I4: provider/session/revocation qualification is separate.
  The new Steam identity flow does not complete optional Logi SSO.
- Operators: target schema/codegen, provider origins/credentials and capabilities,
  Discord intents/role hierarchy, real Steam callback, concurrent mutations,
  sustained throughput and rollback acceptance.
- Later product decisions: authenticated website commands, role moderation/game
  controls, formal result retraction and longer/exportable audit browsing.
- The previously reviewed audit-label Minor is fixed for new transitions in the
  [reliability follow-up](reliability-follow-up.md). Pre-fix orphaned historical
  rows are not backfilled; their operation status remains authoritative.

Final fresh review findings and their one-pass disposition are recorded in
[review](review.md). Local task scratch was retained after automatic approval
review rejected its recursive cleanup; no alternate deletion was attempted.
