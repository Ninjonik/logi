# I3 delivery decisions

Earlier W2/I1 decisions and deferred ownership remain in
[0.7 delivery decisions](../v0.7/delivery-decisions.md). I3 is implemented here;
its earlier deferral is superseded by this milestone.

1. Only trusted dashboard/bot adapters attach authenticated actor provenance in
   the assignment transaction. Legacy bearer/import writes remain data-only.
   Cost: integration callers cannot grant roles and must use a later delegated-actor contract.
2. Root policy owns HLL; other games need explicit overrides. Clan role is shared
   under one guild owner, category roles cannot overlap other games/group/admin roles.
   Cost: conflicting old configurations must be corrected before operation.
3. Retry/periodic verification reuses an existing actor-backed intent and rechecks
   assignment, policy, departure and current Discord authority; it never creates
   authority from legacy imports. Cost: changed state needs a new staff request;
   failed/denied partial operations require operator inspection.
4. Keep existing unrelated baseline test/lint failures disclosed, preserve private
   SSO boundaries and the authorization to update this feature PR. Cost: the full
   repository is not all-green; no hosted provider/deployment qualification follows.
5. Retain the last 20 attempt records per operation and expose five with a lifetime
   count. Cost: this is a bounded troubleshooting history, not a permanent per-attempt archive.
6. Unlinked player data remains editable, but its role intent is explicitly denied
   without provider calls. Cost: verified linking and a new staff request are needed later.
7. The user's explicit decision is to keep all milestones in **PR #158**, with
   detailed documentation, review and final proof. This supersedes the temporary
   local stacked-branch choice; no second PR is created. Cost: the larger PR needs
   the milestone-by-milestone review guide and coordinated release acceptance.
8. Manual dashboard access is a desired Discord role, not a second independent
   execution grant. Both OAuth admin lists and true overrides can contain cached
   data, so fresh Discord Administrator/dashboard-role evidence is required.
   False overrides still veto dashboard-role access. Cost: a manual grant cannot
   execute membership commands until the Discord role has actually propagated.
9. Bind operations to an explicit stored Discord link and user record; retain the
   assignment key separately. Numeric IDs without `discordId` are unlinked, and
   a changed link supersedes queued work. Cost: old/imported profiles need proper
   linking and a new staff action; guessed identities cannot be backfilled.

## Final review disposition

Two Important findings were reproduced with failing regressions and fixed in one
TDD pass: stale cached actor authority and confusion between stable/Discord IDs.
See [review evidence](./review.md) for the exact failure, regression names and limits.

One Minor remains deferred: an expired or superseded attempt can retain historical
`running`/`claimed` text while the operation has the correct final/current state.
Use the operation status for recovery; that old attempt row does not prove a live worker.
This is an acknowledged audit-display limitation, not another authorization path.

The final reviewer did not establish website consumer behavior, private hosted OIDC,
verified Steam linking, reviewed match results, live Discord/provider behavior,
deployed Convex limits, sustained load or release readiness. These remain explicit
owner/activation tasks; cost: local evidence cannot substitute for end-to-end acceptance.
Browser evidence and full-suite/lint/build results were supplied by the implementer,
not independently repeated by the reviewer; cost: they remain one execution record.
Partial side effects after a cross-system race require inspection under current
authority; cost: this delivery does not promise automatic rollback of denied work.

No website, CircleBot or infrastructure checkout was edited. Website-owned tasks,
private hosted OIDC acceptance, I5 and D4 are still separate work. Scratch evidence
is retained after the earlier automatic cleanup rejection; deletion was not retried.
