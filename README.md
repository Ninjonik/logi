# Logi

Logi is an open-source operations platform for **Hell Let Loose communities**. It brings the public community site, manager dashboard, event planning, rosters, and Discord coordination into one place.

Our goal is to make running a community less manual: give players a clear place to find events and information, while giving organisers reliable tools for planning, communication, and membership operations. Contributions are very welcome—whether you improve the product, documentation, tests, accessibility, or deployment experience.

## What Logi can do

- Manage one or more Discord-community workspaces, with role-aware dashboard access.
- Plan events, matches, and trainings with schedules, registration windows, game-specific configuration, sign-ups, attendance, and conclusion workflows.
- Build, publish, and maintain event rosters with squads, player slots, reserves, and attendance status.
- Coordinate events in Discord through announcements, interactive sign-up buttons, forum posts, scheduled events, calendar panels, reminders, and temporary event roles.
- Organise members with groups, membership assignments, Discord role integrations, tickets, and membership-application workflows.
- Publish community, clan, player, match, and competition information for visitors.
- Support Hell Let Loose, Hell Let Loose: Vietnam, and Wardogs in a shared community workspace.
- Provide an authenticated `/api/v1` integration surface, OpenAPI documentation, API keys, idempotent writes, and webhooks.
- Collect configured HLL CRCON and Wardogs server data for scoped website reads; see the [collector handoff](./docs/integrations/website/v0.5/README.md) for setup and verification limits.
- Read Warcon live scoreboards, analytics, player statistics, kills, catalogs and completed matches; see [Warcon handoff 0.11](./docs/integrations/website/v0.11/README.md) for all fifteen views and the explicit website grant.
- Preview public Wardogs League match links in System / Imports and through the scoped website API; see [League handoff 0.12](./docs/integrations/website/v0.12/README.md) for parsing, freshness and verification limits.
- Synchronize scoped changes and observe Discord membership with per-key role policies; see [handoff 0.7](./docs/integrations/website/v0.7/README.md) for freshness, revocation and offline evidence.
- Queue, verify and audit managed membership roles with current actor and hierarchy checks; see [handoff 0.8](./docs/integrations/website/v0.8/README.md) for ownership, retries and activation limits.

The [wiki](./content/index.mdx) has practical guides for players, managers, events, rosters, settings, and [Discord bot setup](./content/discord-bot-setup.mdx).

The cumulative website/Discord integration has a [delivery handbook](./docs/integrations/website/v0.10/pr-handbook.md) with the complete web/API and Discord command catalogs, stored verification output, captioned screenshots, review, activation requirements and remaining owner tasks.

## Architecture

Logi consists of three cooperating runtimes:

- a Next.js dashboard and public site;
- [Convex](https://www.convex.dev/) functions and persistence; and
- a Discord.js bot.

Business logic is progressively being moved into framework-independent domain rules and application use-cases so the dashboard, Convex functions, and bot can share behavior safely. Read [ARCHITECTURE.md](./ARCHITECTURE.md) for the current layering and migration direction.

```text
src/
  app/               Next.js App Router pages and API route adapters
  components/        React UI
  domain/            Shared business rules and pure policies
  application/       Use-cases and ports
  infrastructure/    Adapters and test doubles
  lib/               Focused web gateways, read models, and helpers

convex/              Convex functions, schema, and persistence wiring
discord-bot/         Discord.js runtime and handlers
content/             Public product wiki
```

## Run locally

### Prerequisites

- Node.js and npm
- A [Convex](https://www.convex.dev/) deployment, or a self-hosted Convex instance
- A Discord application when working on sign-in or the bot

Install dependencies:

```bash
npm install
```

Create a private `.env.local` file at the repository root. Do not commit it. The exact variables depend on the parts of Logi you run:

| Variable                                     | Used for                                                        |
| -------------------------------------------- | --------------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`                     | Convex endpoint used by the dashboard and optionally the bot    |
| `CONVEX_SELF_HOSTED_URL`                     | Alternative endpoint for a self-hosted Convex backend           |
| `CONVEX_SELF_HOSTED_ADMIN_KEY`               | Private Convex CLI administration key for a self-hosted backend |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Discord OAuth sign-in                                           |
| `DISCORD_REDIRECT_URI` or `SITE_URL`         | OAuth callback and public site URLs                             |
| `JWT_SECRET`                                 | Dashboard session signing                                       |
| `SITE_URL`                                   | Fixed dashboard/OIDC issuer origin, without a trailing slash    |
| `LOGI_SSO_ENABLED`                           | Explicit opt-in for the optional SSO provider in Next.js and Convex; disabled unless `true` |
| `LOGI_SSO_PRIVATE_JWK`                       | Operator-managed private RSA JWK with a `kid`, only in Next.js; its public counterpart is exposed at `/api/sso/jwks` |
| `LOGI_SSO_ALLOW_LOOPBACK_HTTP`               | Development-only opt-in for explicit localhost/127.0.0.1/IPv6 loopback issuer and callbacks; ordinary HTTP remains rejected |
| `INTERNAL_AUTH_SECRET`                       | Shared secret for trusted dashboard/bot-to-Convex operations    |
| `DISCORD_BOT_TOKEN`                          | Required when running the Discord bot                           |
| `DISCORD_SUPPORT_URL`                         | Public Discord support-server invite shown in Logi navigation   |
| `LOGI_GAME_DATA_SOURCES`                      | Optional operator-owned provider catalog in Convex; defaults to no sources |
| `LOGI_GAME_DATA_<NAME>_TOKEN`                 | Provider token in Convex, referenced by catalog name only |

Start the dashboard:

```bash
npm run dev
```

Dashboard sign-in now creates a durable session in Convex. `SITE_URL`, `JWT_SECRET`
and matching `INTERNAL_AUTH_SECRET` must be configured before sign-in. A coordinated
upgrade requires one re-login for existing dashboard users. The optional SSO
provider remains disabled until separately configured and qualified; see the
[provider contract and rollout](./docs/integrations/website/sso-provider-contract.md).

Start the dashboard and bot together:

```bash
npm run dev:all
```

The bot’s configuration and operational responsibilities are documented in [discord-bot/README.md](./discord-bot/README.md). For a full Discord installation checklist, see the [bot setup guide](./content/discord-bot-setup.mdx).

## Self-host Convex

Logi can use Convex Cloud or a self-hosted Convex backend. This repository includes a Docker Compose configuration at [docker/convex/docker-compose.yml](./docker/convex/docker-compose.yml) for running the Convex backend and dashboard locally or as the starting point for your own deployment.

For a local instance:

```bash
cd docker/convex
docker compose up -d
docker compose exec backend ./generate_admin_key.sh
```

By default, the backend is available at `http://127.0.0.1:3210` and the Convex dashboard at `http://127.0.0.1:6791`. Configure the Logi dashboard with a reachable backend URL, for example:

```bash
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210
CONVEX_SELF_HOSTED_ADMIN_KEY=your-generated-admin-key
```

With those private values configured, use `npx convex dev` to push Convex functions to a development instance; use the deployment process appropriate to your environment for production. Keep the Docker data volume persistent in production, configure public origins and TLS for your host, and set the same `INTERNAL_AUTH_SECRET` for Logi’s runtime and Convex functions. Never commit keys or secrets.

For current production guidance, storage options, upgrades, and limitations, follow Convex’s official [self-hosting guide](https://docs.convex.dev/self-hosting) and [self-hosted backend instructions](https://github.com/get-convex/convex-backend/tree/main/self-hosted).

## Contribute

We welcome contributions of all sizes. Before opening a change:

1. Read [CONTRIBUTING.md](./CONTRIBUTING.md) and [ARCHITECTURE.md](./ARCHITECTURE.md).
2. Search for existing behavior and nearby tests before adding a new pattern.
3. Keep shared rules in `src/domain` or `src/application`; keep Next.js, Convex, and Discord entrypoints focused on integration.
4. Add or update tests when behavior changes, including invalid and edge cases where relevant.
5. Update the matching page under `content/` when a user-visible feature, permission, workflow, or screen changes.

A typical contribution workflow is:

```bash
git checkout -b your-descriptive-branch
npm run test
npm run typecheck
npm run format:check
```

Then open a pull request describing the user impact, implementation, validation performed, and any follow-up work. Please keep changes focused and avoid unrelated refactors. You can use [GitHub Issues](https://github.com/Ninjonik/logi/issues) to report bugs or discuss an idea before investing in a larger change.

## Commands

```bash
npm run dev             # Next.js dashboard
npm run dev:all         # dashboard and Discord bot
npm run bot:dev         # Discord bot only
npm run test            # dashboard and bot tests
npm run test:domain     # domain tests only
npm run bot:test        # bot tests only
npm run test:coverage   # all tests with coverage
npm run typecheck       # TypeScript without emitting files
npm run format          # format the repository
npm run format:check    # verify formatting
npm run build           # production build
```

Run the narrowest relevant test while iterating, then run the checks appropriate for the scope of your change. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full expectations.

## License

Logi is licensed under the [MIT License](./LICENSE.MD).
