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

## Source layout

- `src/index.ts` boots the bot and wires events
- `src/sync.ts` runs the polling loop and guild/event sync
- `src/interactions.ts` handles signup and attendance button actions
- `src/message-builders.ts` builds embeds, buttons, and reminder components
- `src/forum.ts` manages forum channels and posts
- `src/scheduled-events.ts` manages Discord scheduled events
- `src/convex.ts`, `src/environment.ts`, `src/constants.ts`, and `src/types.ts` hold shared setup data
- `src/utils.ts` contains formatting and reusable bot helpers
