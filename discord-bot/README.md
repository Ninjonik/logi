# Logi Discord bot

The Discord.js runtime synchronizes Logi workspaces with Discord. Run commands from the repository root:

```bash
npm run bot:dev
npm run dev:all
npm run bot:test
```

## Configuration

`src/environment.ts` loads root `.env.local`, followed by dotenv's default environment file. Required configuration:

- `DISCORD_BOT_TOKEN`
- `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_SELF_HOSTED_URL`, or `CONVEX_URL`
- `INTERNAL_AUTH_SECRET`, matching the Convex backend

`SITE_URL` is the public dashboard origin; `INTERNAL_SITE_URL` optionally supplies a private origin for image rendering. `LOGI_BOT_VERSION` overrides the package version reported by the panel heartbeat. `LOGI_STATUS_API_URL` selects the service-status endpoint. `LOGI_LEAGUE_MESSAGE_CONTENT=true` enables human League-link ingestion and also requires Discord's Message Content Intent.

See [Discord installation](../content/discord-bot-setup.mdx) for application setup, intents, permissions, and workspace installation. Dependency installation applies the [gateway lifecycle patch](../patches/README.md).

## Responsibilities

- Event announcements, forum posts, scheduled events, sign-ups, rosters, attendance, reminders, and reviewed-result cards. Debriefs use a private retained event forum or an invitation-only participant thread in the results text channel. External forum destinations also use private threads because shared forum topics cannot restrict their individual audience. Disposable match forums are deleted only after any enabled external debrief exists.
- Membership applications, private tickets, account linking, and team-request decision DMs.
- Durable public panels, server seeding, League tracking, and player-statistics replies.
- Membership observations and queued role changes with current actor, target, and hierarchy checks.
- Personal recaps with current account binding and opt-out checks.

The registered commands are `/close_application`, `/close_ticket`, `/help`, `/groups`, `/link`, `/notice`, `/player`, `/server-status`, and `/stats`. Names are stable; descriptions and options use the workspace's Discord language. Settings determine configurable command access and reply behavior. Permission is checked when a command is used. `/groups` uses the Membership settings' self-service allowlist and changes only the caller's secondary Logi groups on an existing game membership; it does not grant Discord roles.

## Source layout

| Path (relative to `discord-bot/`)          | Responsibility                                            |
| ------------------------------------------ | --------------------------------------------------------- |
| `src/index.ts`                             | Startup and Discord event wiring                          |
| `src/convex.ts`, `src/environment.ts`      | Backend access and runtime configuration                  |
| `src/sync.ts`, `src/sync/`                 | Guild/event synchronization and managed roles             |
| `src/interactions.ts`, `src/interactions/` | Registry and feature interaction handlers                 |
| `src/commands/`                            | Command definitions, registration, and replies            |
| `src/ui/`                                  | Shared message-model adapter and reply/error handling     |
| `src/public-panels/`                       | Panel workers and publication lifecycle                   |
| `src/seed/`                                | Server seeding and private server controls                |
| `src/league/`                              | League cards, tracking, and rendering                     |
| `src/runtime/`                             | Runtime helpers, language, version, and application emoji |
| `src/forum.ts`, `src/scheduled-events.ts`  | Discord forums and scheduled events                       |
| `src/manual-reminders.ts`                  | Dashboard-requested reminder delivery                     |

Cross-runtime rules and workflows live in `../src/domain` and `../src/application`. Clan-language copy lives in `../src/lib/clan-language`; the bot's League renderer keeps League copy locally. Discord message components and dashboard previews share the [message kit](../docs/superpowers/specs/discord-redesign/KIT.md).

## Delivery and privacy

Workers use durable publication keys, leases, fences, and retry policies. Discord sends can be ambiguous; an uncertain send is reconciled according to the feature's recovery rules. Scheduled reminder reservations prevent replay after interruption, so a partially delivered run can leave some recipients waiting for the next run.

Published roster image downloads retry interrupted connections and temporary HTTP
failures up to three times within a single 45-second deadline, including failures
while reading the response body. Failed downloads never replace Discord media.
Downloads enforce actual streamed byte limits even when Content-Length is
missing or incorrect. Forum attachment downloads share a 45-second deadline per
message and retain the existing individual and total attachment limits.

Cold command configuration reads share one backend request and cannot replace a
newer subscribed configuration. Applicant state is bounded separately from live
application definitions; permission checks at submission remain authoritative.

Public messages do not show server passwords. A player's private assignment response can show the password to eligible published-roster players. Signup discussions and external debriefs require regular text channels and private-thread permissions. Signups are invited and explicit declines are removed, without pruning other thread members. Discord administrators and members with Manage Threads retain access. This is a Discord delivery change; the v1 event configuration contract is unchanged.

Player reports use private threads and current Discord audience checks; bearer integrations cannot export their private contents.

Meeting attendance checks read only the requested roster's assigned and reserve players through Discord's voice-state REST endpoint. Requests expire after 45 seconds; permission/network failures abort rather than confirming an empty result. The bot stores attendance results, without voice presence history or server-wide voice snapshots.

## References

- [Panels](../docs/integrations/website/discord-public-panels.md) and [panel API](../docs/superpowers/specs/discord-redesign/PANELS-API.md)
- [Server seeding](../content/configuration/server-seeding.mdx)
- [League tracking](../docs/integrations/website/league-discovery.md)
- [Player statistics](../docs/integrations/website/discord-player-stats.md)
- [Managed membership roles](../docs/integrations/website/v0.8/README.md)
- [Events and reminders](../content/operations/events.mdx)

## Interaction acknowledgements

The gateway runs every interaction through `interactions/acknowledgement.ts`.
Handlers keep their existing reply/update/defer calls. If none starts within one
second, the shared guard acknowledges first and routes the eventual response to
its intended destination. Component updates still edit their source message;
private replies remain separate from public cards. Explicit early deferrals are
still preferred when a handler knows it will perform slow work.

If preparing a modal exceeds that window, a private **Open form** button opens
the prepared modal with a fresh interaction. It belongs to the original user,
is single-use, and expires after five minutes. Modal submission handlers still
perform their normal authorization and state checks. Slow autocomplete requests
return an empty result instead of attempting an expired response. This changes
Discord delivery only; dashboard and `/api/v1` contracts are unchanged.

The guard cannot recover an interaction already expired before receipt, a stalled
event loop, or a Discord/network outage. Keep handler work bounded: Discord's
acknowledgement extends the response window but does not make it unlimited.

## Sync ownership and diagnostics

A guild sync step that exceeds 20 seconds emits a warning and keeps ownership
until its actual work settles; it does not start conflicting work merely because
the warning deadline elapsed. Temporary lookup failures preserve role, scheduled
event, squad voice and primary forum bindings. Failed role/voice cleanup remains
available for retry. Only explicit Discord unknown-resource errors count as absence.

Changed events share one calendar refresh per clan per sync cycle. Calendar and
full-guild context reads use up to four concurrent requests and do not retain
stale contexts between cycles. Existing participant roles reuse their fetched
objects rather than immediately fetching them again.

System log context is bounded and cycle-safe. Storage failures fall back to
console output with a 30-second write retry interval; log writes cannot fail bot
work. Log administration reads still surface storage errors. This is not an
asynchronous logging queue or a guarantee of crash recovery for Discord sends.

## Shutdown and interrupted request delivery

SIGTERM and SIGINT stop new intake and recurring producers, cancel prepared-form
collectors, and drain startup, gateway, request and worker promises before closing
Discord and Convex. The fallback thread stops cooperatively and does not respawn
during shutdown. A failed drain or a 120-second drain deadline exits unsuccessfully;
it is not reported as clean completion. Configure the process supervisor/container
with at least **130 seconds** of termination grace so it does not kill the process
before this drain window. Do not run overlapping old and new bot processes.

Manual reminder and roster-change requests opt into fenced, resumable claims.
A five-minute lease is renewed every 30 seconds. Delivery plans freeze the initial
audience; resume intersects it with fresh eligibility. Each DM, digest and mention
has a durable started/sent/refused/uncertain receipt. Confirmed sends are skipped,
untouched effects continue, and ambiguous sends are never blindly repeated.
Transient pre-send failures retry with a one-minute backoff (up to five request
attempts); pending retries are polled every 30 seconds as well as watched.

Expired resumable requests return to pending. Outcome totals come from receipts,
including earlier confirmed sends; uncertain outcomes never become confirmed
closed DMs. Legacy interrupted requests without receipts remain failed/uncertain:
the bot cannot safely infer who received their old messages. Older bot versions
cannot claim already-resumable requests, so do not roll back the runtime while
such requests remain pending.

Deploy the updated Convex backend **before** this bot. Added schema fields are
optional and old bots can finish legacy claims during a backend-first rollout;
upgraded bots fail closed against a backend without the new claim contract. Stop
the old bot normally, wait for its exit, then start the replacement. Do not apply
the archived deferred patch as a migration. HTTP/v1 paths, public response shapes
and permission checks are unchanged; this is internal bot delivery behavior.

## Scheduled claim recovery

The fallback worker recovers expired claims every minute, using an expiry index
and one bounded page of obsolete-row cleanup. Upgraded claims use an attempt
version: stale workers cannot complete or release a newer attempt. The admitted
batch is renewed every 30 seconds, including jobs waiting behind a slow job, and
ownership is checked before reconciliation. Legacy bot claims remain compatible.

Scheduled completion now inserts a durable dispatch inbox record in the same
Convex transaction that removes the schedule job. The main process claims it,
renews ownership while queued, runs score/event/reminder work, then acknowledges
it. Failed or interrupted passes remain available for retry; worker messages are
hints rather than the delivery record. The consumer stops taking new claims during
shutdown and drains the current acknowledgment.

Signup and attendance runs use stable per-day/per-offset receipts and original
audience plans. Signup reservation and its dispatch resume marker commit together;
resuming that dispatch does not make a new daily claim. Fresh game, local-player,
response, acknowledgement and absence checks still apply. Confirmed attendance
receipts rebuild missing attendance logs after a crash. Unknown send outcomes are
retained for operator review and are excluded from closed-DM counts.

Receipt retention checks five expired plans per minute and removes at most 100
receipts per plan per pass. Finished scopes become eligible after 30 days; active
or retryable owners are retained. Automatic scopes are retained while their event
is active or recently concluded. These guarantees cover the new runtime's recorded
effects, not pre-upgrade sends or exactly-once delivery during an ambiguous network
failure. Application/ticket transactions and other Discord effect families remain
separate work in the implementation TODO register.
