# Website handoff 0.8 — managed Discord membership roles

Date: 2026-09-29. Implements I3 on top of [0.7 membership observations](../v0.7/README.md),
[0.6 synchronization](../v0.6/README.md) and [0.5 collectors](../v0.5/README.md).
OpenAPI remains **1.5.0**: this milestone adds no bearer-key role command.
[PR #158](https://github.com/Ninjonik/logi/pull/158) contains the entire delivery
and pins the exact tested revision. Start with the [whole-PR review guide](./review-guide.md).
Evidence is local and synthetic.

## Staff workflow

Saving/removing an assignment in the authenticated dashboard, migrating membership
status as an administrator, applying through the bot, closing a recruitment
application or rolling back failed application setup now records a durable role
operation in the **same transaction** as the assignment. The actor comes from the
authenticated session/interaction, never the submitted form body. Assignment data
can be saved before Discord succeeds; it is not proof that roles were applied.

Membership settings shows the latest 100 operations across the workspace's games:
actor, target, origin, version, status, update time, reason and latest five attempts.
Up to 20 attempts are retained per operation; lifetime attempt count remains.
Refresh is explicit. Failed reads remove old rows; changing workspace clears them.
Unlinked player records remain editable but produce a denied `target_not_linked`
operation without a Discord request. This does not verify platform/Steam identity.

| Status                | Meaning and recovery                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pending` / `running` | Waiting for the bot or executing a bounded attempt                                                             |
| `retry_scheduled`     | Transient error, unknown provider result or rate limit; automatic retry                                        |
| `applied`             | A fresh read confirmed the complete managed role set; checked periodically                                     |
| `denied`              | Actor, target, departure, permission or hierarchy check failed; correct the cause and save a new staff request |
| `superseded`          | A newer request, assignment or policy replaced this desired state                                              |
| `failed`              | Six consecutive failed/crashed attempts; correct the cause and save a new staff request                        |

The audit is session-only at `GET /api/servers/{workspaceId}/member-role-operations`.
It resolves the Discord guild from a fresh administrator context, rechecks access
after the query, validates a closed response schema and returns `Cache-Control: no-store`.
There is no force/retry button that bypasses current permissions.

## Ownership and authority

- Root recruitment settings own legacy HLL. Other games require an explicit
  membership-settings override; they cannot inherit HLL's managed roles implicitly.
- Clan role has a single guild-wide owner. An existing clan role is preserved while
  another game's current managed intent still requires it. That other intent cannot
  authorize adding a missing clan role. Category roles belong to one game only.
- Category roles cannot overlap group-linked roles, the dashboard administrator
  role or the clan role. Both dashboard and legacy API configuration/group writes
  reject conflicts. Existing conflicts block role operations until corrected.
- Only enabled membership policies manage roles. Pending/removal desires no managed
  roles; recruit desires clan plus category recruit roles; active desires clan plus
  category final roles for member, reserve member and mercenary. Unmanaged roles
  remain untouched. Removing a role from policy does not authorize its removal later:
  resolve old role assignments separately before transferring ownership.
- Every attempt re-reads assignment/policy and current actor permission. Dashboard
  operations require a fresh Discord Administrator permission or the configured
  dashboard role, with an explicit false override vetoing that role. Cached OAuth
  `adminIds` and true `adminAccessOverrides` cannot grant execution authority.
  Manual dashboard access controls the desired Discord role: it becomes sufficient
  for these commands only after Discord confirms the role. Administrator bootstrap
  authority still requires fresh Discord evidence. Recruitment operations also
  accept the category's current support role. Self-application is restricted to the
  applying member and configured pending/automatic recruit flow; rollback requires
  their assignment to be absent.
- Assignment `userId` is an internal/imported identifier, not necessarily Discord ID.
  Enqueue resolves the user record's explicit `discordId` and stores both that subject
  and the user record ID. A numeric imported identifier alone is never a link.
  Every preparation/completion re-resolves the mapping; relinking, unlinking or
  replacing the user supersedes old work. Versions and locks use the resolved Discord
  subject across assignment aliases; self-application and departures use it too.
  Audit DTOs keep `userId` and nullable `discordUserId` distinct. The UI labels an
  unlinked numeric player as a Logi ID, rather than implying Discord verification.
- Departure revisions survive rejoin. An operation predating a known departure
  cannot resume granting roles to a rejoined member. An unavailable observation is
  not a new grant; execution also requires a fresh exact Discord member read.
- Legacy API assignments, imports, merges and ordinary data maintenance do not
  create role authority. Their changed assignments can supersede an older operation.
  Reconciliation never derives a new grant from imported assignment data.

Existing group-role behavior is separate. Import filters do not become a continuous
role writer. No kick, ban, general moderation or arbitrary role-edit API is added.

## Worker and failure handling

The bot has an independent ten-second recovery pass, rotating over at most four
available guilds, plus the existing full-sync hook. It claims one due operation per
guild/pass. A durable 45-second lease serializes every game for a guild/member pair;
fences reject stale completions. Another process can reclaim an expired attempt.
Success is due for verification again after five minutes; actual cadence depends
on backlog. Six consecutive failures stop automatic attempts; a verified success
resets that consecutive-failure count.

Before each single-role PUT/DELETE, the worker refreshes guild roles and exact
actor/target/bot members and rechecks persisted authority after that awaited read.
It requires Manage Roles/Administrator on the bot, roles below its highest role,
and an eligible present target. It refuses managed/integration roles, @everyone,
screening-pending members, bots, the guild owner and targets at/above the bot.
Deleted configured roles deny the operation. These checks use Discord's
[guild role endpoints](https://docs.discord.com/developers/resources/guild)
and [role hierarchy](https://docs.discord.com/developers/topics/permissions).

Writes use idempotent per-role endpoints, remove obsolete roles before adding new
ones and preserve unrelated roles. A timeout after Discord success is retried by
observing actual state. Only a verified complete state can become applied; merely
receiving a successful write response is insufficient. Logi operation ID and actor
are included in Discord's audit reason.

Each Discord request has a five-second deadline, fixed origin, no redirects/cache
and a 512 KiB streamed response limit. Attempts have a 15-second work budget checked
before writes and at most 20 writes; an in-flight read/Convex round trip may finish
after that budget. Retries use bounded exponential delay, six consecutive attempts,
and bounded Retry-After up to 24 hours. Discord cooldown is shared with I1 refreshes.
Provider error bodies/tokens are never operator audit reasons.

Discord and Convex cannot share a transaction: revocation or a policy change in the
interval between the final check and the Discord request can still race a side
effect. Fencing prevents recording stale success, and subsequent authorized work
re-observes state, but this is not instantaneous revocation or automatic rollback
of every partially applied denied operation. Operators must inspect denied/failed
requests and reconcile them under current authority.

## Compatibility and activation

Additive tables: `memberRoleOperations`, `memberRoleLocks`, `memberRoleAudits`;
optional `memberObservations.departureRevision`. No destructive data migration or
bulk role backfill. Existing internal assignment callers may omit actor provenance
and retain data-only semantics. Old operations are not fabricated from history.
The new I3 tables have not been deployed in this delivery. If a pre-release I3
runtime was independently installed, stop its workers before upgrading: older
unbound operations are refused, and its former `userId` lock shape needs an explicit
test-environment migration to the new `discordUserId` index. Do not infer links or
copy numeric identifiers as proof. The pre-I3 production schema has no such records.

For a separately authorized activation, deploy compatible Convex schema/functions,
web and bot together, run target Convex codegen and restart the bot. Retire old bot
and web writers before allowing staff actions; an old runtime cannot participate
in the new queue/ownership checks. Existing Discord token/internal secret remain
server-side. Verify GuildMembers intent, bot guild access, Manage Roles, hierarchy,
restart recovery, real backend limits and isolated test roles before production use.
Rolling back only the bot would restore the old immediate role writer and is not
a safe mixed-version rollout. No such deployment or live Discord action was done.

Public `/api/v1` assignments deliberately cannot issue these commands. Delegated
website commands need a separately reviewed actor/session/guild/game/action/target
contract. The website keeps OAuth sessions, authorization, CMS, consent and publication.
I2 and W1/W3/W4 remain consumer-owned; I5 verified Steam linking and D4 reviewed results
remain next Logi milestones. Optional OIDC acceptance stays in the private workstream.

Evidence: [validation](./validation.md), [synthetic audit fixtures](./fixtures.json),
[actual UI screenshots](./ui-validation.md), [review findings and disposition](./review.md),
[delivery decisions](./delivery-decisions.md).
