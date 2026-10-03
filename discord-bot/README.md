# Discord Bot

This workspace hosts the Discord.js bot for Logi.

## Wardogs League cards and human links

The League worker publishes the tracked fixtures configured under **Wardogs → System → Imports**. Input and output channels can differ. It reuses durable managed publications, bundled map artwork and application faction emojis. Scheduled discovery/manual pins run independently of gateway message access.

Human-link ingestion additionally needs `LOGI_LEAGUE_MESSAGE_CONTENT=true` and **Message Content Intent** in the Discord Developer Portal, followed by a bot restart. It consumes human messages only; bot and webhook announcements are ignored. Edits/deletions remove that message's reference without removing other tracking reasons. It does not backfill messages missed during a full gateway outage.

See the [operator wiki](../content/configuration/league-tracking.mdx) and [implementation/API contract](../docs/integrations/website/league-discovery.md) for activation, permissions, limits and freshness semantics.

## Run

From the repository root:

```bash
npm run bot:dev
```

Or run the dashboard and bot together:

```bash
npm run dev:all
```

## Required environment variables

- `DISCORD_BOT_TOKEN`
- `NEXT_PUBLIC_CONVEX_URL` or `CONVEX_SELF_HOSTED_URL`
- `INTERNAL_AUTH_SECRET`

## Current responsibilities

- Poll Discord-related Convex config and events
- Keep announcement embeds in sync
- Create one forum post per event
- Handle signup button interactions
- Send eligible personal match recaps to explicitly linked Discord accounts and
  handle each account's own global recap preference
- Handle `/server-status` for Discord server managers, with a private localized
  HLL/WDG summary from stored collector observations
- Refresh configured public server/score panels, optional player leaders and
  private Wardogs player pages; publish reviewed results with durable message
  ownership and restart recovery
- Write sync state back to Convex
- Reconcile actor-backed membership roles through a durable queue, including
  independent recovery after reconnect. `src/sync/managed-member-roles.ts` owns
  polling; shared domain/application modules own policy and reconciliation.

Managed-role activation requires compatible web/Convex/bot versions, GuildMembers
intent and Manage Roles with configured roles below the bot. Do not mix an old
immediate role writer with the new queue. The bot rechecks current actor access,
target eligibility and role hierarchy on retries and only reports applied after
fresh provider evidence. See [handoff 0.8](../docs/integrations/website/v0.8/README.md)
for limits, operator recovery and the session-only audit. No bearer role-grant API.

Recap delivery requires matching Convex/bot versions using internal delivery
protocol 2. Stop the old bot before rollout; legacy unbound queued rows are
withheld, not automatically migrated. The bot rechecks account binding and opt-out
after Discord lookup, before sending. See the [recap delivery follow-up](../docs/integrations/website/v0.10/recap-delivery-follow-up.md)
for compatibility, rollback, tests and the remaining in-flight/duplicate limits.

The [server-status command handoff](../docs/integrations/website/v0.10/server-status-command.md)
records its guild/game scope, ten-second backend wait, five-connection display
limit and simulated proof. It requires the existing game-data backend; command
registration runs at `ClientReady` for cached guilds and performs no game-server poll.
There is no separate join-time command registration in this revision; restart the
bot after installation in a new guild when registration is needed.

The [complete Discord reference](../docs/integrations/website/v0.10/discord-reference.md)
lists all six slash commands, options, permissions, visibility, button/automatic
workflows, rollout limits and reproducible registration payloads. The
[PR handbook](../docs/integrations/website/v0.10/pr-handbook.md) links website
capabilities, review, tests and visual proof.

The [Discord feature gallery](../docs/integrations/website/evidence/2026-10-03-discord-gallery/README.md)
compares 21 actual Discord screenshots of existing and new surfaces, with normal
audiences, synthetic-data boundaries and concrete design gaps. Configure public
panels using the [operator guide](../docs/integrations/website/discord-public-panels.md).

## Source layout

Dependency installation applies the pinned Discord gateway lifecycle fix from
[`patches/`](../patches/README.md). Keep install lifecycle scripts enabled, or run
`npm run postinstall` explicitly before starting the bot. The patch prevents a
pending WebSocket upgrade from losing its error listener during teardown; its
six offline gateway regression tests do not require a Discord token.

The managed-role worker rejects observations older than ten seconds both before
and after backend authorization. Slow authorization therefore schedules a fresh
attempt instead of continuing with stale Discord permissions.

- `src/index.ts` boots the bot and wires events
- `src/sync.ts` runs the polling loop and guild/event sync
- `src/interactions.ts` handles signup and attendance button actions
- `src/message-builders.ts` builds embeds, buttons, and reminder components
- `src/forum.ts` manages forum channels and posts
- `src/scheduled-events.ts` manages Discord scheduled events
- `src/convex.ts`, `src/environment.ts`, `src/constants.ts`, and `src/types.ts` hold shared setup data
- `src/utils.ts` contains formatting and reusable bot helpers
