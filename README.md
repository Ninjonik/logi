# Logi

Logi is an open-source community operations platform with a public site, a manager dashboard, a Convex backend, and a Discord bot. Communities use it to manage events, matches, sign-ups, rosters, attendance, members, and competitions.

## Features

- Discord-backed sign-in and role-aware community workspaces.
- Events, matches, training, recurring schedules, registration, and reminders.
- Squad rosters, reserves, tactical plans, attendance, and reviewed results.
- Membership applications, groups, tickets, and managed Discord roles.
- Discord announcements, forum posts, scheduled events, public panels, and server seeding.
- Game-specific capabilities, including HLL CRCON, Warcon, retained game history, and Wardogs League tracking.
- Global team catalogues, competitions, and public community and player pages.
- Scoped `/api/v1` integrations, OpenAPI documentation, webhooks, and optional SSO.

The [product wiki](content/index.mdx) explains the screens and workflows. The [technical documentation](docs/README.md) covers integrations and operation.

## Project structure

```text
src/
  app/               Next.js App Router pages, layouts, and API routes
  components/        React components and UI primitives
  domain/            Shared business rules, types, and validation
  application/       Use-cases and repository ports
  infrastructure/    Adapters and test doubles
  lib/               Web gateways, read models, and helpers
  i18n/              Locale routing and translations
  hooks/, contexts/  Client state and behavior
convex/              Backend functions, schema, and persistence
discord-bot/         Discord.js runtime
content/             Public product wiki
config/              Checked-in application configuration
scripts/             Maintenance, generation, and verification tools
public/              Static assets and legal content
docker/convex/       Self-hosted Convex Compose configuration
patches/             Dependency patches applied during installation
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for runtime boundaries and [CONTRIBUTING.md](CONTRIBUTING.md) for development conventions.

## Run locally

Install Node.js and npm, and provide a Convex deployment. Discord sign-in requires a Discord application; running the bot also requires its token.

```bash
npm install
```

Create a private `.env.local` at the repository root. Configure the variables for the runtimes you use:

| Variable                                     | Purpose                                                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`                     | Dashboard Convex endpoint                                                                                  |
| `CONVEX_SELF_HOSTED_URL`                     | Self-hosted endpoint; also accepted by the bot                                                             |
| `CONVEX_SELF_HOSTED_ADMIN_KEY`               | Private administration key for self-hosted CLI operations                                                  |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Discord OAuth sign-in                                                                                      |
| `DISCORD_REDIRECT_URI`                       | Discord OAuth callback URL                                                                                 |
| `SITE_URL`                                   | Public dashboard origin and SSO issuer                                                                     |
| `JWT_SECRET`                                 | Dashboard session signing secret                                                                           |
| `INTERNAL_AUTH_SECRET`                       | Matching trusted-runtime secret in the dashboard, bot, and Convex                                          |
| `DISCORD_BOT_TOKEN`                          | Discord bot token                                                                                          |
| `DISCORD_SUPPORT_URL`                        | Support-server link in navigation                                                                          |
| `LOGI_CREDENTIAL_KEYRING`                    | Game-server credential encryption; see [credentials](docs/integrations/website/game-server-credentials.md) |

Dashboard sessions are stored in Convex. Configure `SITE_URL`, `JWT_SECRET`, and matching `INTERNAL_AUTH_SECRET` before signing in. Optional SSO configuration is documented in the [provider contract](docs/integrations/website/sso-provider-contract.md).

```bash
npm run dev       # dashboard at http://localhost:3000
npm run dev:all   # dashboard and Discord bot
```

See [discord-bot/README.md](discord-bot/README.md) for bot configuration and [the installation guide](content/discord-bot-setup.mdx) for Discord permissions and intents. See [self-hosting](docs/self-hosting.md) for the included Convex Docker setup.

## Commands

Run from the repository root:

```bash
npm run dev                    # development dashboard
npm run dev:all                # dashboard and bot
npm run bot:dev                # bot only
npm run test                   # src and bot tests
npm run test:domain            # domain tests
npm run bot:test               # bot tests
npm run test:coverage          # test coverage
npm run typecheck             # TypeScript without emit
npm run check:convex-bundles   # check Convex runtime bundles
npm run lint                  # ESLint
npm run format:check          # verify formatting
npm run build                 # production Next.js build
npm run start                 # serve the production build
npm run generate:openapi       # regenerate OpenAPI schemas
```

## License

[MIT](LICENSE.MD).
