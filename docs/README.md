# Technical documentation

Logi's documentation is organized by audience and runtime:

| Reference                                                              | Contents                                                               |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [Project README](../README.md)                                         | Features, source layout, local setup, and commands                     |
| [Architecture](../ARCHITECTURE.md)                                     | Runtime boundaries, layers, authentication, persistence, and hot paths |
| [Contributing](../CONTRIBUTING.md)                                     | Code placement, tests, formatting, and documentation conventions       |
| [Discord bot](../discord-bot/README.md)                                | Runtime configuration, workers, commands, and delivery behavior        |
| [Self-hosted Convex](self-hosting.md)                                  | Compose setup, storage, networking, retention, and memory settings     |
| [Website integrations](integrations/website/README.md)                 | Scoped API, identity, events, membership, teams, and game data         |
| [Discord message kit](superpowers/specs/discord-redesign/KIT.md)       | Shared message model, rendering, previews, and interaction routing     |
| [Discord panels API](superpowers/specs/discord-redesign/PANELS-API.md) | Panel model, dashboard routes, bot protocol, and public join pages     |
| [Dashboard tours](onboarding.md) | Tour selection, example isolation, accessibility and progress |
| [Product wiki](../content/index.mdx)                                   | User and administrator workflows                                       |
| [Dependency patches](../patches/README.md)                             | Discord gateway patch and its regression checks                        |

The API serves its interactive reference at `/api/v1/docs` and OpenAPI schema at `/api/v1/openapi.json`. JSON examples and provider captures retained beside integration references support contract and parser tests.
