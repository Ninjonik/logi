# Actor-backed website event commands

The website owns presentation, publication and its local session. Logi owns the
operational event. A website write creates or changes the same native event used
by the Logi dashboard and Discord workflows, then the existing revision feed
invalidates its `event-summaries`, `match-summaries` and `result-summaries` records.
Consumers persist the returned event ID and use the existing cursor/bootstrap
protocol to project changes from any Logi writer. Do not mirror writes back into
a second operational match table.

This contract supports Hell Let Loose and Wardogs. It does not reduce a Wardogs
match to two teams: participant scores remain the independent N-participant
reviewed-result read model. The native event editor currently contains schedule,
name, kind, map, side and descriptive fields; structured three-team fixture
creation and result submission are outside this command contract.

## Enable access explicitly

Every command and editor read requires all of the following:

- An active **restricted** API key for the same Discord guild. Its optional
  `writeAccess` must explicitly grant `event-commands` and the selected game.
- An enabled policy binding that key to the exact registered SSO application,
  with at least one allowed Discord role ID for that game.
- The current opaque SSO access token belonging to that application, its
  central session, exact Discord subject and canonical Discord guild.
- A present member observation from the current guild epoch, observed no more
  than 60 seconds ago, with an allowed role. A later receipt time does not make
  old observations fresh. A disconnected gateway or unavailable observation
  denies access.

Policies are absent/disabled by default. A successful login, global website
administrator, claimed role, legacy unrestricted key, or read-only key does not
substitute for these requirements. Current authorization is rechecked in the
same Convex transaction as the event, revision and receipt, including retries.

A current Logi workspace administrator configures the policy with a same-origin
dashboard-session POST to
`/api/servers/{workspaceRecordId}/website-event-policies`:

```json
{
  "applicationRecordId": "<registered-sso-application-record-id>",
  "apiKeyId": "<restricted-api-key-record-id>",
  "policy": {
    "enabled": true,
    "games": [{ "gameId": "wardogs", "roleIds": ["<discord-role-id>"] }]
  }
}
```

The path is the internal workspace record ID; guild IDs in public event and
identity DTOs remain canonical Discord guild IDs. The final mutation verifies
the application's actual workspace and the current administrator. Enabling
this policy atomically grants the listed nonempty games on that key; disabling
it removes the write grant. Use a dedicated command key. Bearer-key policy
configuration is deliberately unavailable: a service key cannot grant itself
permission. GET on the same path with `?applicationRecordId=...` returns bounded
nonsecret policy metadata to the current workspace administrator. There is no
new dashboard policy form in this slice.

## HTTP contract

The [generated OpenAPI endpoint](/api/v1/openapi.json) includes these operations:

| Request | Purpose |
| --- | --- |
| `POST /api/v1/clan/event-commands?game=wardogs` | Create, update or cancel |
| `GET /api/v1/clan/event-commands/{eventId}?game=wardogs` | Read the bounded editor and current revision |

Use `Authorization: Bearer <command-service-key>` and
`X-Logi-Actor-Token: <current-opaque-SSO-access-token>` from the website backend.
POST also requires an `Idempotency-Key` of 16–128 ASCII letters, digits,
underscores or hyphens. Exactly one game query parameter is required. Additional
query parameters are rejected. JSON bodies are limited to 16 KiB and five
seconds of body read time. HTTP responses are `no-store` and do not echo raw
adapter diagnostics, credentials or private native fields.

Create:

```json
{
  "operation": "create",
  "event": {
    "kind": "match",
    "name": "Wardogs friendly",
    "matchType": "Friendly",
    "map": "Zestafona",
    "registrationEnd": "2030-01-01T17:00:00Z",
    "meetingStart": "2030-01-01T18:00:00Z",
    "gameStart": "2030-01-01T18:30:00Z",
    "gameEnd": "2030-01-01T20:00:00Z"
  }
}
```

The required native kind is `match` or `training`. Optional bounded fields are
`matchType` (80 characters), `description` (2,000), `map` (200), `side` (200) and
`registrationStart` (UTC ISO timestamp). `name` is 1–160 trimmed characters.
Times satisfy `registrationStart <= registrationEnd <= meetingStart <=
gameStart < gameEnd`; meeting start must still be in the future.

Update uses `{operation:"update",eventId,expectedRevision,event}` with the same
complete editable event shape. Cancel uses
`{operation:"cancel",eventId,expectedRevision}`. Read the editor to obtain the
latest revision and native schedule before editing. These commands preserve
native Discord channels, signup settings, private notes/passwords, roles,
recurrence and other non-owned fields on updates. Changing event kind or
editing/cancelling after meeting start is rejected. A prior conclusion is not
reopened.

Cancellation uses a dedicated pre-meeting use case, separate from post-start
conclusion. It retains Logi's existing cancellation representation:
`status: concluded`, attendance scoring skipped, pending schedule jobs removed,
and no invented result. There is no new `cancelled` status. New events have no
automatic clan ping or forum creation; configure the event's Discord settings
in Logi when needed. Live Discord message delivery is not implied by creating
the native event.

POST returns 201 for create (including replay), otherwise 200:

```json
{
  "data": {
    "eventId": "<native-event-id>",
    "guildId": "<discord-guild-id>",
    "gameId": "wardogs",
    "revision": "123",
    "operation": "create",
    "receiptId": "<durable-receipt-id>",
    "replayed": false
  }
}
```

GET returns `eventId`, `guildId`, `gameId`, `revision`, the bounded `event`, and
`canEdit`/`canCancel`. It requires the same current write authorization even
when the event can no longer be edited. All output objects are closed schemas.

## Retries, concurrency and errors

Store the intentional command, its key, actor subject and source configuration
durably before sending. A timeout, malformed success or server failure can have
an **unknown outcome**. Keep the exact command and key; never create a new key
automatically to resolve an uncertain attempt. A retry is authorized as the
same current subject/application. Receipts do not have a time-based expiry and
are scoped to application record, subject, game and key. They include the
original service key ID, source client ID, actor, operation, event ID, canonical
body hash and committed revision for audit. Rotating the service key within
the same explicitly authorized application does not duplicate that command.

Different JSON key order does not change the canonical body hash. Different
semantic content with an existing key returns `idempotency_conflict`. Each
update/cancel compares `expectedRevision` to the current event-summary revision
in the transaction; a concurrent change returns `revision_conflict` without an
overwrite. The event, schedule, change records and receipt commit atomically.

| Status | Error codes / consumer action |
| --- | --- |
| 400 | `invalid_request`; correct the intentional command |
| 401 | `unauthorized`; obtain a current central session/key |
| 403 | `insufficient_scope`, `policy_denied`, `membership_denied`; do not bypass authorization |
| 404 | `not_found`; event absent from this exact guild/game |
| 409 | `revision_conflict`, `idempotency_conflict`, `invalid_state`; require a refreshed deliberate edit |
| 429 | `rate_limited`; respect `Retry-After`, preserve key/body |
| 503 | `membership_stale`, `unavailable`; revalidate, preserving uncertain command identity |

Result confirmation, score corrections, roster edits, Discord role writes,
server controls, publication and destructive event deletion are intentionally
excluded. Their existing dedicated lifecycle remains authoritative.

## Verification and limits

Automated source tests cover domain validation; strict HTTP envelopes and
credential hashing; policy setup/CSRF; final-transaction authorization; 11
revocation scenarios on receipt replay; optimistic concurrency; rollback when
receipt persistence fails; native hidden-field preservation; and cancellation
without scoring. Run:

```shell
node --import tsx --test src/domain/events/website-command.test.ts src/infrastructure/convex/website-event-commands.test.ts src/lib/api/website-event-command-route.test.ts src/app/api/v1/openapi.json/route.test.ts
npm run typecheck
```

On 2026-10-02, a guarded local Next HTTP server and fresh isolated Convex backend
passed 22 runtime checks, including actual local SSO authorization/token
exchange, eight concurrent identical creates producing one event/receipt,
two concurrent updates with one winner/one conflict, replay denial after role,
epoch, central session and service-key changes, cancellation and visibility
through the summary API. The exact tested source hashes and sanitized HTTP
assertions are in the [local acceptance bundle](v0.13/evidence/README.md); source
hashes were stable through the run. Discord observations were synthetic trusted gateway fixtures.
This proves the local HTTP/transaction path, not production deployment, live
Discord role delivery, hosted SSO acceptance or website browser integration.
