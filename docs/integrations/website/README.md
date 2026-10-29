# Website integration reference

Logi owns operational community records. Connected websites use scoped HTTP contracts and keep their own presentation, CMS, consent, and sessions. Integration keys stay on the consumer backend.

## Access, identity, and operations

- [Scoped keys and ownership](v0.3/README.md)
- [Event and match summaries](v0.4/README.md)
- [Synchronization and webhooks](v0.6/README.md)
- [Discord membership reads](v0.7/README.md)
- [Managed membership roles](v0.8/README.md)
- [Verified Steam identity](v0.9/README.md)
- [Reviewed results](v0.10/README.md)
- [SSO provider](sso-provider-contract.md) and [website event operations](v0.13/README.md)
- [Actor-backed event commands](event-commands.md)
- [People, published rosters, and player facts](v0.14/README.md)
- [Global teams and match snapshots](v0.15/README.md)
- [Competition enrollment](competition-enrollment.md)
- [Clan metadata](clan-meta.md)
- [Settings and API coverage](configuration-coverage.md)

## Game data and Discord

- [Collection and snapshots](v0.5/README.md)
- [Game-server credentials](game-server-credentials.md)
- [Warcon gameplay reads](v0.11/README.md)
- [Retained Warcon history](warcon-history.md)
- [Retained HLL history](hll-retained-history.md)
- [HLL live data and private player reports](hll-live-and-player-reports.md)
- [Public League match reader](v0.12/README.md)
- [League discovery and shared fixtures](league-discovery.md)
- [Discord public panels](discord-public-panels.md)
- [Discord player statistics](discord-player-stats.md)

The API's exact paths, parameters, schemas, and errors are served at `/api/v1/docs` and `/api/v1/openapi.json`. Numbered directories also hold JSON examples consumed by repository tests; their names do not indicate deployment status.
