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
