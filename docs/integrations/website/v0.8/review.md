# Final integration review and disposition

Date: 2026-09-29. Delivery: [PR #158](https://github.com/Ninjonik/logi/pull/158).
This records an independent, fresh-context **automated code review**, not a maintainer
approval or a production security certification. The review examined the cumulative
feature diff `a34ef149883240ab6a9eb879e845b5f71a5786e6..b4f8ee055789b0880867e8ab420771782ac0e81e`,
the architecture/plan and offline evidence. It independently ran the original
27 focused I3 tests. Two Important findings and one Minor finding were returned;
no Critical finding was reported.

The implementer accepted both Important findings and completed one regression-driven
fix pass. The reviewer did not re-review the fixes. Post-fix proof is the observed
RED → GREEN regression run, **35 focused passes**, and the full **472/473** run with
the same disclosed baseline embed-order failure. The PR body pins the final tested
commit; [validation](./validation.md) gives commands and limitations.

## Important 1 — stale cached actor authority

**Before:** fresh Discord evidence could show no Administrator permission and no
dashboard role, yet `guild.adminIds` or a true `adminAccessOverrides` still authorized
a queued role operation. The former is refreshed through OAuth synchronization;
the latter also receives automated role observations, so neither proves a current
independent manual grant.

**After:** execution uses the fresh Discord Administrator permission or configured
dashboard role. A false override vetoes role-derived access; a true override cannot
replace Discord evidence. The existing manual access action still requests the
dashboard role, but membership commands wait until Discord confirms it. Current
recruitment support roles and the restricted self-application path retain their
separate checks.

**Observed RED:** both cached-source regressions returned `ready` instead of `denied`;
the manual-grant regression authorized a desired role before Discord confirmed it.
**GREEN:** those cases deny; a confirmed explicit grant succeeds, an explicit denial
vetoes that role, and freshly observed Discord Administrator remains bootstrap authority.

Regressions in [persistence tests](../../../../src/infrastructure/convex/member-role-operations.test.ts):

- `freshly revoked Discord authority overrides the OAuth admin cache`
- `freshly revoked Discord authority overrides the role-derived override cache`
- `explicit dashboard role grants require fresh Discord confirmation and explicit denials still veto the role`

## Important 2 — assignment ID confused with Discord subject

**Before:** the queue treated a 17–20 digit assignment `userId` as a Discord identity.
It rejected a linked player with a stable nonnumeric ID and accepted an unlinked
import whose stable ID happened to look like a Discord snowflake.

**After:** resolve only the stored explicit `users.discordId`, bind it to the user
record ID, and preserve the assignment identifier separately. Re-read that mapping
before execution/completion. Relink, unlink and record replacement supersede old
work. Use the Discord subject for provider calls, leave/rejoin fencing, self-application,
cross-game clan preservation, desired versions and per-member locks. Numeric imports
without a link remain editable but get `denied / target_not_linked` without provider work.

**Observed RED:** valid linked imports were denied; unlinked numeric imports queued;
alias operations failed to supersede each other; self-application rejected the stable
ID; the bot did not consume the explicit subject. **GREEN:** the regression set checks
the correct provider ID, rejected stale links, shared alias lock/version, and departure
fencing. The operator DTO and actual UI distinguish an unlinked Logi ID from Discord ID.

Regressions in the same persistence test file:

- `linked imported identity keeps its stable assignment key and targets only its explicit Discord account`
- `a numeric imported identifier without an explicit Discord link cannot queue a grant`
- `relink, unlink or replacement of the stored player invalidates queued Discord work`
- `aliases of one linked account share the desired version and Discord lock`
- `self application and leave/rejoin checks resolve a stable player to the linked Discord subject`

The [bot adapter test](../../../../discord-bot/src/sync/managed-member-roles.test.ts)
also asserts the provider receives the explicit Discord ID. The existing cross-game
test now uses different assignment aliases for HLL and Wardogs.

## Minor — incomplete historical attempt label, deferred

Superseding an operation or reclaiming an expired attempt can leave an earlier audit
row as `running / claimed`. The operation itself carries the correct current/final
status and stale completion is fenced. This can mislead historical troubleshooting;
it does not authorize an extra write or report the operation as applied.

Use the operation status and latest attempt during recovery. A later audit-only
change should finalize interrupted historical rows and test supersession/crash
recovery. This Minor was deliberately not bundled into the Important fix pass.

## Review limits

- Website implementation W1/W3/W4 and I2 is owned by the website team; only the Logi
  contracts and producer changes are delivered here.
- Private hosted OIDC qualification, I5 verified Steam linking and D4 reviewed results
  were not accepted as complete by this review.
- No live Discord/provider calls, hosted deployment, real Convex transaction limits,
  distributed scheduling, sustained load or credential configuration were tested.
- Screenshots/browser interaction and full-suite/lint/build evidence were supplied
  by the implementer; the reviewer independently repeated only the focused suite.
- A Discord side effect can race a later Convex revocation. Partial denied/failed
  operations need operator inspection; automatic rollback is not promised.

Earlier I1 findings (legacy access-cache cleanup and merge-user invalidation) and
their completed fix pass remain documented in [0.7 validation](../v0.7/validation.md).
All delivery decisions and costs are in [0.8 decisions](./delivery-decisions.md) and
the linked previous milestone record.
