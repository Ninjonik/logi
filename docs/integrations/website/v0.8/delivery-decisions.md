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

No website, CircleBot or infrastructure checkout was edited. Website-owned tasks,
private hosted OIDC acceptance, I5 and D4 are still separate work. Scratch evidence
is retained after the earlier automatic cleanup rejection; deletion was not retried.
