# Logi

Logi is a Next.js dashboard plus a Discord bot backed by Convex. The repository is being migrated away from framework-coupled business logic toward a layered architecture where domain rules are shared, testable, and reusable across the web app, Convex functions, and the bot.

The current architecture is documented in [ARCHITECTURE.md](./ARCHITECTURE.md). Contribution expectations and workflow are documented in [CONTRIBUTING.md](./CONTRIBUTING.md).

## Commands

```bash
npm run dev
npm run dev:all
npm run bot:dev
npm run test
npm run test:domain
npm run bot:test
npm run typecheck
```

## Current Structure

```text
src/
  app/               Next.js app router pages and API routes
  components/        React UI
  domain/            Shared business rules and pure policies
  application/       Use-cases and ports
  infrastructure/    Adapters and test doubles
  lib/               Existing web-side helpers and gateways

convex/              Convex cloud function entrypoints
discord-bot/         Discord.js runtime and handlers
```

## Refactor Status

The migration is in progress. The first extracted shared modules currently cover:

- event status, normalization, signup, and notice policies
- roster attendance and roster membership sync rules
- assignment validation helpers
- initial application-layer roster sync use-cases

Older framework-specific code still exists and is being migrated incrementally. During the transition:

- new business rules should go into `src/domain`
- orchestration should go into `src/application`
- Convex and Discord handlers should stay thin and delegate inward
