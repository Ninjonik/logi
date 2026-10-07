# Website handoff 0.7 — scoped Discord membership

Date: 2026-09-28. Extends [0.6 synchronization](../v0.6/README.md) and
[0.5 game data](../v0.5/README.md). OpenAPI version: **1.5.0**.
Implementation scope: W2 + I1. This is source and offline evidence, not hosted
acceptance. PR #158 pins the exact tested revision. The website keeps its own
backend, sessions, authorization rules and publication consent.

## Configure the two access gates

1. In System → Website API, create a **read-only** key with the explicit
   `membership-summaries` resource and only the required games. Default summary
   keys remain unchanged. Legacy full-access keys cannot read this projection.
2. In System → Discord membership integrations, refresh the list, choose allowed
   Discord role IDs for each game, enable the policy and save. Missing/disabled
   policies deny access. An empty role list permits presence and Logi assignment
   without sharing role IDs. Existing keys are never enabled automatically.
3. Store that key only in the website backend. Logi retains the Discord bot token
   and internal Convex secret. The guild comes from the key, never a request field.

Policy management uses the existing signed-in administrator context with a fresh
session check and same-origin POST. It deliberately has no `/api/v1` bearer-key
write equivalent: consumers cannot widen their own membership authority.

## Exact-subject lookup

```http
GET /api/v1/clan/membership-summaries/222222222222222222?game=wardogs&maxAgeMs=60000
Authorization: Bearer <restricted server-side key>
```

Use one 17–20 digit Discord ID and exactly one explicit permitted game.
`hell_let_loose` maps to website `hell-let-loose` and route `hll`; `wardogs`
maps explicitly. `maxAgeMs` is an integer from 1,000 to 300,000, default 60,000.
Unknown/duplicate parameters, collection reads and `game=all` are rejected.
Every response is `Cache-Control: no-store`.

Success is `{ data: MembershipObservation }`:

| Field                                | Meaning                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `guildId`, `discordUserId`, `gameId` | Exact source subject; retain your configured `sourceInstanceId` separately                                                                              |
| `state`                              | `present`, `left` or `unknown`                                                                                                                          |
| `roleIds`                            | Unique sorted intersection with the key's per-game allowlist, only when presence is fresh                                                               |
| `assignment`                         | Nullable Logi `{ type, status }`, independent of Discord presence; never website-admin authority                                                        |
| `observedAt`                         | Nullable time of provider evidence; failed refresh does not advance it; it advances without a revision change when state, roles and epoch are unchanged |
| `receivedAt`                         | Nullable Logi ingestion time; does not confer freshness                                                                                                 |
| `epoch`, `revision`                  | Canonical decimal strings, compare as integers, never JavaScript floating-point numbers                                                                 |
| `completeness`                       | `verified_member`, `verified_absent` or `unavailable`                                                                                                   |

Stale, failed or invalidated evidence returns `unknown`, `unavailable` and no
roles. An old assignment may still be returned beside a departure; it must not
grant access. Only a successful exact member read or Discord's `10007 Unknown
Member` supplies new REST evidence. `10004 Unknown Guild`, 403, 429, network
errors and malformed responses are unavailable, not departures. These meanings
follow [Discord's status/error codes](https://docs.discord.com/developers/topics/opcodes-and-status-codes).

The lookup returns 400 for invalid input, 401 for invalid/revoked authentication,
403 for a missing current grant/policy (including revocation during refresh),
429 for the existing API request limit, and 503 for unavailable Logi storage.
Discord unavailability itself is normally an explicit unknown observation (200).
Fail closed for protected website actions in every unavailable/denied case.

## Freshness, ordering and recovery

- Fresh cached evidence is served immediately; stale evidence can trigger a
  fixed-origin Discord GET with a ten-second deadline and 64 KiB streamed limit.
  No redirects, contacts, profile payloads or unconfigured roles are exported.
- REST work is limited by a durable 15-second reservation, 30-second per-subject
  cooldown, 30 refresh starts per guild/minute and shared Discord Retry-After.
  Very strict age requirements can therefore receive unknown while cooling down.
- Completion rechecks current key grants and policy version and compares the
  reserved epoch/revision/fence. A newer departure or role event defeats a slow
  response. Failure preserves old provider time and departure evidence.
- Bot ingress serializes persistence per guild. Add/update/remove events write
  observations; role updates/deletions, startup, unavailable/deleted guilds and
  shard reconnect/disconnect/resume/ready events invalidate the guild epoch.
  Recovered/available guilds request reconciliation. The event surface is
  documented by [Discord.js](https://discord.js.org/docs/packages/discord.js/14.27.0/Client:Class).
- Full reconciliation starts its durable fence **before** fetching. It requires
  a complete available guild response, matching member count, no partial members
  and the bot itself. It commits batches of 100 and sweeps absence in pages of
  100 only after every expected member was recorded. Later observations win.
  A second bounded sweep reconciles pre-upgrade `discordMemberAccess` rows that
  have no observation yet. Absent old rows become departures and lose cached
  dashboard access. Each page rechecks the epoch; newer observations and legacy
  cache writes at/after the snapshot boundary survive. Deletions use a user-ID
  continuation so removing one page cannot skip the next.
  Failure/partial fetch never becomes an empty guild. Runs expire after ten
  minutes; minute maintenance removes expired scratch rows in bounded batches.
- Successful periodic full syncs are throttled to five minutes; invalidation
  removes that throttle. Direct REST freshness is independent of this cadence.

Departed subjects remain durable tombstones. No destructive expiry of member
evidence is introduced in this milestone; operator privacy/retention procedures
still require deployment acceptance. This does not create consent to publish
member identities.

The website should use at most 60-second observations for privileged writes and
at most five minutes for protected reads, recheck age at the decision time, and
apply durable departures immediately. These are **maximum stale windows**, not
instant revocation guarantees during outages or lost events. OAuth proves identity;
the website must separately decide authority from fresh, correctly scoped data.

## Membership and the change feed

```http
GET /api/v1/clan/changes?game=wardogs&resources=membership-summaries&subject=222222222222222222&start=now
GET /api/v1/clan/sync-records/membership-summaries/222222222222222222?game=wardogs
```

Membership feed requests require one `subject`; there is no member enumeration
endpoint. The signed cursor binds key/guild/game/resources/**subject**. An enabled
policy is checked on every page and atomic detail read. Policy-version or guild
epoch changes return `410 reset_required`; bootstrap again and refresh that
subject. Do not reuse a cursor for another user. A membership detail is always
an `upsert` observation (including `left`/`unknown`), not a removal of its identity.
It computes 60-second freshness without a network refresh; use the direct lookup
when fresh provider evidence is needed.

Raw observations and projected assignment changes append transactional records.
The assignment writers are `userAssignments` (including import/reassignment),
`publicApi`, `groups`, `serverSetup`, `migrations` and `players.mergeUsers`; their mutations use the
same integration decorator. Assignment deletion invalidates the membership
projection with `upsert`, so the next record has `assignment: null`. Policy/epoch
changes allocate a global revision and force cursor reset instead of fanout.
The returned revision is the maximum of subject, policy and epoch revisions.

**Identity correction, 2026-09-30:** assignment projections resolve the explicit
`users.discordId` binding and the corresponding stable Logi assignment ID.
Unlinked imported IDs are never substituted for Discord subjects. Profile
creation, relinking, unlinking and deletion invalidate affected old/new subjects,
including existing legacy assignment aliases. Conflicting alias assignments
project `assignment: null` until repaired. The wire DTO is unchanged.

Consumers upgrading from an earlier PR checkpoint must capture a new `start=now`
cursor, refetch each authorized exact-member scope, then drain all pages through
that cursor. Old logs may contain imported IDs that did not reach an exact-subject
subscriber; this producer fix does not rewrite historical logs. Always follow
`hasMore`, including when a filtered page contains no items.

Membership changes are read by polling the feed. The **`membership.changed`**
and `integration.changed` webhooks are no longer emitted (October 2026); a
subscription that lists them is still accepted and receives nothing for them.
Authenticated lookup and cursor polling are authoritative.

## Activation and remaining ownership

Deploy schema/functions, web and the bot from the same reviewed version. New
tables start empty; absence of evidence is unknown. Run normal Convex codegen for
the target deployment; new code uses function references without hand-editing
generated artifacts. The old bot full-sync endpoint retains its legacy cache
behavior for compatibility but does not populate trustworthy observations.
Restart the bot to adopt fenced batches and invalidate pre-restart observations.
Verify `GuildMembers` intent, bot guild access and time synchronization in an
authorized test environment. No new Discord role write is introduced by I1.

The consumer owner implements I2 and W1/W3/W4 in `ValkyriaWDG/www`; no website
files changed here. I3 managed-role reliability, I5 verified Steam linking and
D4 reviewed results remain separate. Optional Logi OIDC remains under separate
private acceptance; this milestone neither replaces Discord OAuth nor activates
an SSO provider.

Evidence: [synthetic wire examples](./fixtures.json), [validation](./validation.md),
[actual component screenshots](./ui-validation.md),
[delivery decisions](./delivery-decisions.md). Reject `differentGuild` when
the configured source is the fixture guild, even if the Discord subject matches.
