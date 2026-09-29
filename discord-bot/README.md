# Discord Bot

This workspace hosts the Discord.js bot for Logi.

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

## Source layout

- `src/index.ts` boots the bot and wires events
- `src/sync.ts` runs the polling loop and guild/event sync
- `src/interactions.ts` handles signup and attendance button actions
- `src/message-builders.ts` builds embeds, buttons, and reminder components
- `src/forum.ts` manages forum channels and posts
- `src/scheduled-events.ts` manages Discord scheduled events
- `src/convex.ts`, `src/environment.ts`, `src/constants.ts`, and `src/types.ts` hold shared setup data
- `src/utils.ts` contains formatting and reusable bot helpers
