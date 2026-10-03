# Discord commands and workflows

This is the complete slash-command inventory at the tested PR #158 runtime
revision. English command names are stable; descriptions/options support Czech
and German localization with an English path. Replies follow each workflow's
configured language or the status command's interaction locale. See the
[bot setup wiki](../../../../content/discord-bot-setup.mdx) for installation.

## All six registered slash commands

Square brackets below mean optional input, not literal Discord syntax.

| Command and example | Who / context | Behavior and visibility |
| --- | --- | --- |
| `/server-status game:wardogs` or `game:hell_let_loose` | Invoking guild; current Discord Manage Server / Administrator | **New in this PR.** Ephemeral summary of at most five stored connections, counts, map, observation age, provider/freshness; ten-second backend wait |
| `/close_ticket [reason:Resolved]` | Tracked ticket thread; Administrator, configured dashboard-admin role or category support role | Close ticket, optional reason up to 500 chars; private command acknowledgement plus configured thread/notification side effects |
| `/close_application outcome:member [reason:Accepted]` | Tracked application thread; current Administrator, dashboard-admin role or category support role | Close application and record outcome/assignment; managed-role request uses authenticated recruitment actor and durable queue; private acknowledgement |
| `/notice event:<autocomplete selection>` | Guild; backend-resolved eligible event for the invoking account | Opens that account's notice/reason modal; localized private acknowledgement after submit |
| `/link` | Guild; own Discord account | Ephemeral start/manage UI for legacy claimed platform identifiers; **does not perform verified Steam OpenID ownership proof** |
| `/player player:<autocomplete selection>` | Guild; selected clan player | Public-in-channel player profile/statistics response; autocomplete returns up to five candidates; no manager-only or private-response claim |

`close_application` accepts exactly `denied`, `pending`, `recruit`, `member`, or
`mercenary`. `outcome` is required, `reason` is optional (500 chars). `notice.event`
and `player.player` are required autocomplete strings. `server-status.game` is
required and accepts only the two games shown above. `/link` takes no options.

All six definitions disable DMs. Only `/server-status` declares the Manage Server
default permission in command metadata; the ticket/application commands enforce
their own contextual role checks in handlers. Command visibility alone is not an
authorization guarantee. Application closure fetches the current actor, and I3's
worker rechecks authority/target/policy/hierarchy before role effects.

The complete serialized definitions for `en-US`, `cs`, and `de`, including
descriptions, option bounds, choices and permission defaults, are committed in
[discord-commands.json](evidence/2026-09-29/discord-commands.json). They were captured
by calling the production `registerGuildCommands` with a fake Discord guild. This
proves emitted metadata, not a successful real registration or every command action.

The subsequent [runtime acceptance](runtime-review.md) verifies actual registration
of all six commands in the authorized test guild and a user-confirmed private
`/server-status game:wardogs` response with configured synthetic provider data.
It also verifies fresh Components V2 event delivery and exact-member reads.
The other five slash-command workflows were not each exercised interactively.

## Registration and prerequisites

[`index.ts`](../../../../discord-bot/src/index.ts) registers the commands for each
cached guild at `ClientReady`; the definitions and dispatcher are in
[`interactions.ts`](../../../../discord-bot/src/interactions.ts). This revision has
no separate command-registration call on guild join. After installing the bot in
a new guild, a normal bot restart performs registration. Existing earlier claims
of a ready/join registration path are corrected in this documentation pass.

The bot needs its token, Convex URL and matching internal secret; the dashboard
needs its own Discord OAuth configuration. Enable member intent, required channel
permissions and Manage Roles as appropriate. Place every managed role below the
bot's highest role. Installation, registration, hierarchy and actual message
rendering must be checked for each target guild. The isolated-guild acceptance
above does not qualify deployment elsewhere; positive role grant/revoke remains
blocked by the approved target's position above the test bot.

## Buttons, modals and automatic behavior

For the proposed next public server/score/result panels, see the
[channel, appearance and restart-recovery design](../roadmap/discord-public-panels.md).
Those panels and their new settings are not part of the current command inventory.

These are existing or extended workflows, not additional slash commands:

| Workflow | Entry point / configuration | Behavior and boundary |
| --- | --- | --- |
| Event announcements and signups | Configured event channel, signup buttons/selects | Operational signup windows, group choices, reserves and updates; actual Discord permissions still matter |
| Forums, scheduled events, calendar panels | Workspace Discord settings | Existing event/thread synchronization; no second Valkyria bot is needed |
| Attendance and absence notices | Event attendance buttons and `/notice` modal | Own-account acknowledgements, late/absence reason and relevant event state |
| Signup and attendance reminders | Existing reminder schedules/settings | Uses the currently tested feature-branch behavior; unrelated upstream additions are not claimed as delivered here |
| Recruitment | Application panel/modal, staff application thread, `/close_application` | Existing pending/recruit/member/mercenary workflow now queues managed membership roles with actor/audit |
| Support tickets | Configured categories, panel/modal, `/close_ticket` | Existing tracked ticket threads and contextual support permissions |
| Managed roles | Dashboard assignment/access workflow and recruitment | Fenced durable retry, explicit role ownership, exact Discord target, fresh actor checks and operator-visible outcomes |
| Membership observations | Member add/update/remove, lifecycle invalidation and full reconciliation | Freshness-aware website lookup; unavailable Discord evidence does not become an empty guild |
| Match recaps and notification preference | Personal DM plus Subscribe/Unsubscribe buttons; own-account settings | Exact Discord binding and opt-out recheck; preference is account-global, not per event/game |
| Game-server status | `/server-status` | On-demand read of stored HLL/WDG data; no RCON action, polling trigger or automatic public status panel |
| Logi platform-service status | Superadmin-selected platform status channel | Existing dashboard/Convex/service degradation/recovery reporting; a different feature from game-server status |

Detailed wiki guides cover [events](../../../../content/operations/events.mdx),
[rosters](../../../../content/operations/rosters.mdx),
[members](../../../../content/configuration/members.mdx),
[tickets](../../../../content/configuration/tickets.mdx) and
[settings](../../../../content/configuration/settings.mdx).

## Role and recap operating rules

Only configured owned roles are touched. Per-game category roles cannot silently
take ownership of another game's roles, group roles or the administrator role.
Unrelated roles are preserved. An imported/numeric player ID is not a Discord
target. A saved assignment is not proof that Discord applied it: staff inspect
`pending`, `running`, `retry_scheduled`, `applied`, `denied`, `superseded` or `failed`
in the dashboard audit. Correct the cause and save a new authorized request when
terminal; there is no bypass/force-grant command. See [0.8](../v0.8/README.md).

Recap protocol 2 requires a compatible backend and bot. Older clients and unbound
legacy rows are withheld. Before sending, the bot rechecks the intended account,
explicit Discord link and opt-out after its user lookup. This cannot cancel a DM
already in flight, and delivery is not exactly once. No automatic historical
resend, identity repair or consent backfill runs. See
[recap compatibility and proof](recap-delivery-follow-up.md).

There is no slash command for arbitrary role grant, kick/ban, Wardogs moderation,
map rotation, game-server restart, reviewed-result confirmation or verified Steam
login. Result review and Steam proof are authenticated dashboard workflows.

## Reproduce and review the proof

```powershell
# Uses synthetic configuration and a fake registration sink; sends nothing.
node --import tsx docs/integrations/website/v0.10/evidence/2026-09-29/capture-commands.mjs

# Use the synthetic variables from the verification page for the tests below.
node --import tsx --test discord-bot/src/interactions/server-status.test.ts
npm run bot:test
```

The full fresh suite includes 15 status-command cases, recipient/consent
regressions and managed-role tests. See [stored test proof](verification-evidence.md).
The standalone `bot:test` command above is a reproduction option, not an additional
fresh run claimed by this documentation pass.

- [Status command CS/EN/DE](server-status-command.md#reproduce-the-visual-proof):
  actual builder/policy output in a static simulated Discord layout.
- [Signup ordering and role recovery](reliability-follow-up.md): actual component
  and simulated Discord output with explicit fixture boundaries.
- [Recap preference buttons](recap-delivery-follow-up.md): actual production
  preference builder and handler tests; no delivered private message.

These captures demonstrate UI output. They do not establish provider freshness,
Discord installation, real guild permissions, live role changes or delivery.
