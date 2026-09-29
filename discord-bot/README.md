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
- Send eligible personal match recaps to explicitly linked Discord accounts and
  handle each account's own global recap preference
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

## Source layout

- `src/index.ts` boots the bot and wires events
- `src/sync.ts` runs the polling loop and guild/event sync
- `src/interactions.ts` handles signup and attendance button actions
- `src/message-builders.ts` builds embeds, buttons, and reminder components
- `src/forum.ts` manages forum channels and posts
- `src/scheduled-events.ts` manages Discord scheduled events
- `src/convex.ts`, `src/environment.ts`, `src/constants.ts`, and `src/types.ts` hold shared setup data
- `src/utils.ts` contains formatting and reusable bot helpers
