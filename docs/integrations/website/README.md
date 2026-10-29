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

## Personal league teams and fixture hosting

`GET /api/v1/public/leagues` lists published competition documents, including
`registrationMode` (`closed`, `approval`, `automatic`) and
`minimumLinkedPlayers` (number or null). The existing public competition detail
endpoint exposes the same fields. Fixtures may include `hosting: { kind:
"linked" | "external", label: string }`. This projection intentionally excludes
provider addresses, connection references, credentials, invitations and pending
score reports. Three-team `participantTeamIds` and `participantScores` retain
their explicit order; standings count all participants after a complete result.

`GET /api/v1/me/leagues?competitionId=<id>` and `POST /api/v1/me/leagues` are
personal dashboard-session endpoints, documented in OpenAPI under **League
account**. They require a current first-party `token` session cookie; writes
require the configured site Origin. Bearer service keys and clan-scoped SSO
actor tokens do **not** grant personal global-team ownership, so no such
credential is accepted for these account operations. This deliberate exclusion
avoids expanding existing clan grants to unrelated global teams. Existing
clan enrollment and workspace-mode endpoints remain unchanged.

Commands create a basic team, join through an owner-shared invitation, enroll or
withdraw, select fixture hosting, report an external score, or approve a score
as an organiser. A creation UUID is scoped to the authenticated account; retries
with the same body replay the original team. Other commands are naturally
idempotent. Account reads are private and `no-store`; owner invitation tokens
must not be published or cached. Basic profiles require no bot or Discord guild.

A linked host must belong to a workspace the caller currently administers and
pass the online/history/error/freshness checks at selection. External hosting
rejects event links and imported score propagation. Manual score commands include the explicit ordered `participantTeamIds`;
reports retain that order and cannot be reused after the pairing changes.
Manual scores remain pending until all fixture participants agree or a Logi organiser approves them. Hosting
locks after event links, score reports or final results. Standalone basic-team
creation never claims an existing catalogue name or grants administration of an
existing clan. Catalogue merges of account-owned profiles are deliberately
blocked until an explicit ownership-transfer lifecycle is available.
