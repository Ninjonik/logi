# Game servers and API keys managed by workspaces

- Date: 2026-10-04
- Status: implemented and covered by synthetic tests; **not deployed**. Live
  acceptance with real provider keys (Valkyria) is still to be done by the owner.
- Scope: HLL CRCON and Wardogs Warcon/RCON sources, their provider keys, the
  collectors and live reads that use them. Login/SSO and website permissions are
  unchanged and out of scope.

A workspace administrator connects a game server in **System → Game server
data** with a name, the game, the provider, the HTTPS address, the server ID at
the provider and the real API key. Logi tests the connection, stores the key
encrypted and only then starts collection. No environment variable per team or
server is needed, and no operator involvement after the one-time activation.

## Architecture

```text
browser ── same-origin JSON, ≤ 8 KiB ──▶ Next route (Node)
   │  session, workspace admin, Origin check, strict schema
   │  key validated and tested in memory (collector transport)
   │  AES-256-GCM encryption with the operator keyring
   ▼
Convex mutation  ── re-authorizes the session and admin rights,
   │                checks revision, identity and key ID, stores ciphertext
   ▼
gameDataCredentials (ciphertext, nonce, tag, key ID, version)
   ▼
collector / live-read action ("use node")
   └─ internal query: ciphertext for this run, only while its generation is current
   └─ decrypts just before the provider request, with the same keyring
```

| Layer                                                | Module                                                                                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain rules (modes, AAD, DTO, draft validation)     | `src/domain/game-data/credentials.ts`                                                                                                                |
| AES-256-GCM and keyring                              | `src/infrastructure/game-data/credential-cipher.ts`                                                                                                  |
| Key resolution for a run, no fallback                | `src/infrastructure/game-data/credential-resolver.ts`                                                                                                |
| Read-only connection test                            | `src/infrastructure/game-data/connection-test.ts`                                                                                                    |
| Transport (HTTPS, address checks, allowlist, limits) | `src/infrastructure/game-data/provider-http.ts`                                                                                                      |
| Next gateway and route handler                       | `src/lib/gateways/game-server-credentials.ts`, `src/lib/api/game-data-sources-route.ts`, `src/app/api/servers/[serverId]/game-data-sources/route.ts` |
| Indexed catalogue lookup                             | `convex/gameDataCatalog.ts`                                                                                                                          |
| Source and key commands, list                        | `convex/gameDataSources.ts`                                                                                                                          |
| Ciphertext for a run, failure reports                | `convex/gameDataCredentials.ts`                                                                                                                      |
| Stored-key test, migration, re-encryption actions    | `convex/gameDataCredentialActions.ts`                                                                                                                |
| Migration and re-encryption storage                  | `convex/gameDataCredentialMigration.ts`, `src/application/game-data/migrate-credentials.ts`                                                          |
| UI                                                   | `src/components/app/game-data-sources.tsx`                                                                                                           |

Ordinary Convex queries and mutations never encrypt, decrypt or call a
provider. Encryption happens in the Next server process; decryption only in
Convex Node actions.

## Encryption

- AES-256-GCM, a fresh 96-bit nonce from the system CSPRNG for every
  encryption, a 128-bit tag. Stored as base64url: `nonce`, `ciphertext`, `tag`,
  plus `keyId` and `format: 1`.
- Additional authenticated data binds the ciphertext to its owner and endpoint.
  It is the JSON array
  `["logi.game-data-credential", 1, guildId, sourceRef, provider, canonicalOrigin, providerServerId]`,
  where `canonicalOrigin` is `new URL(origin).origin`. A ciphertext copied to
  another workspace or source, or kept after a host or server ID change, fails
  authentication; the key is never sent anywhere else.
- The plaintext is validated before encryption and after decryption: 8–4096
  visible ASCII characters, so it can never split an HTTP header.

### Keyring

`LOGI_CREDENTIAL_KEYRING` holds the root keys, outside the database:

```json
{ "current": "2026-10", "keys": { "2026-10": "<base64 of 32 random bytes>" } }
```

- Set it **identically** in the Convex deployment environment (decryption) and
  in the Next server environment (encryption). Never in the database, Git, a
  client bundle or a `NEXT_PUBLIC_*` variable.
- Use dedicated random material. Never reuse or derive it from the JWT secret,
  the Discord token or `INTERNAL_AUTH_SECRET`.
- Key IDs are lowercase (`[a-z0-9][a-z0-9_-]{0,31}`), at most 8 keys, each
  exactly 32 bytes, no material under two IDs. An invalid keyring is treated as
  missing: nothing is encrypted or decrypted.
- Unset keyring = encryption not activated. The UI then allows testing a key but
  not saving one. Nothing is ever stored as plaintext.

## Storage and projection

`gameDataCredentials` holds one row per source: `guildId`, `sourceRef`,
`format`, `keyId`, `nonce`, `ciphertext`, `tag`, `version` (bumped by every new
key), `verifiedAt` (the key passed a test), `createdAt`, `updatedAt` (key change
date), `updatedBy`, optional `reencryptedAt`, `failure` and `failureAt`, and the
last test for operator sources. Indexes: `guildId_sourceRef`, `keyId`.

`gameDataSources` gains `displayName`, `credentialMode`, `revision`,
`createdBy` and the last test. New indexes: `guildId_ref`, `credentialMode`
and `secretRef`. `gameDataConnections` gains `guildId_sourceRef`.

The dashboard list (`gameServerSourceSchema`) is an explicit allowlist: name,
game, provider, origin, server ID, managed by, revision, key state, key change
date, verified, a sanitized failure, collection state and last success, and the
last test. It never contains ciphertext, nonce, tag, key ID, variable name or
network exception. There is no reveal or export action. The key is never put in
a URL, `localStorage`, server-rendered props, analytics or logs.

## Credential modes

| Source                                                              | Stored mode           | Effective mode | Collects?                       |
| ------------------------------------------------------------------- | --------------------- | -------------- | ------------------------------- |
| Operator catalog entry (`LOGI_GAME_DATA_SOURCES`) with a stored key | —                     | `encrypted`    | yes                             |
| Operator catalog entry with `secretRef`, no stored key              | —                     | `legacy_env`   | yes, from that variable         |
| Operator catalog entry without `secretRef`                          | —                     | `none`         | only providers that need no key |
| Workspace registration created now                                  | `encrypted` or `none` | same           | needs a key that passed a test  |
| Workspace registration from before this change, `secretRef` set     | absent                | `legacy_env`   | **no**                          |

A pre-existing workspace registration named its variable itself, so it could
have named another workspace's key (and pointed it at its own host). Such rows
never collect again until the operator migrates them after checking or an
administrator enters the key in the UI. Their administrator-chosen network
exceptions are ignored. For an operator entry a stored key always wins and is
never removed back to the variable.

## Commands

`POST /api/servers/{serverId}/game-data-sources`, same-origin only, at most
8 KiB, strict schemas (unknown fields are rejected):

| Action        | Body                                                | Effect                                                                                                                                                                   |
| ------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `test`        | `draft`, `key \| null`                              | Tests an unsaved server; stores nothing.                                                                                                                                 |
| `create`      | `draft`, `key \| null`, `enable`                    | New workspace source with a generated reference (`src-<32 hex>`). Collection starts only when `enable` is set **and** the test passed; otherwise it is a disabled draft. |
| `set_key`     | `ref`, `expectedRevision`, `key`, `allowUnverified` | Tests the new key against the stored identity, then replaces the old key. A failed test stores nothing unless `allowUnverified`, which stops collection.                 |
| `test_stored` | `ref`                                               | Tests the stored key inside Convex (internal path); records the outcome.                                                                                                 |
| `remove_key`  | `ref`, `expectedRevision`                           | Workspace sources only; deletes the key and stops collection, also for a CRCON source that could read keyless (keyless collection needs an explicit start).              |
| `rename`      | `ref`, `expectedRevision`, `displayName`            | Workspace sources only.                                                                                                                                                  |
| `set_enabled` | `ref`, `enabled`                                    | Starts collection only with a usable key that passed a test.                                                                                                             |
| `remove`      | `ref`, `expectedRevision`                           | Workspace sources only; stops collection, deletes the key and the registration, keeps history.                                                                           |

`draft` is `{ displayName, gameId, provider, origin, providerServerId }`. The
identity of a source cannot be edited: changing the host or server ID means a
new source, so an old key is never redirected.

Responses carry only codes: `invalid_source`, `invalid_key`, `duplicate_name`,
`duplicate_identity`, `limit_reached`, `not_found` (404),
`revision_conflict` (409), `operator_managed`, `key_required`,
`key_not_allowed`, `verification_required` (422 with the test outcome),
`encryption_unavailable` (503), `rate_limited` (429 with `retryAfterMs`),
`unavailable` (503). Test outcomes: `ok`, `unauthorized`, `server_mismatch`,
`rate_limited`, `timeout`, `network`, `invalid_response`, `configuration`,
`unsupported`, `key_unavailable`. A provider body or exception text is never
returned.

### What a test proves

| Provider                 | Request                         | Passes when                                       |
| ------------------------ | ------------------------------- | ------------------------------------------------- |
| Warcon                   | `GET /api/servers` with the key | the key's visible servers include the server UUID |
| CRCON with a key         | `GET /api/get_connection_info`  | the reported `server_number` equals the server ID |
| CRCON without a key      | `GET /api/get_public_info`      | the public endpoint answers (reachability only)   |
| Wardogs RCON             | `GET /v1/server-id`             | the reported ID equals the server ID              |
| Wardog Servers directory | the normal public read          | the server is listed                              |

The CRCON check assumes the key's CRCON user may view connection information
(`can_view_connection_info`); this is documented in the UI and is part of the
pending live acceptance.

## Collection, rotation and removal

- Every lookup is by workspace **and** reference through indexes
  (`resolveSource`, `connectionSource`); the global `take(200)` scan is gone,
  so the 201st and later sources work. A reference of another workspace
  resolves nothing.
- A claim carries the connection generation. The action loads the ciphertext
  through `gameDataCredentials:envelope`, which answers only while that
  generation is current, and decrypts just before the request.
- Every key write (set, remove, migration) bumps the generation, resets leases
  and keeps history progress. A worker that started before can neither load the
  new key nor write its result (generation and fence checks); live-read caches
  keyed by generation stop matching.
- Removing a source or key stops collection, deletes the ciphertext and keeps
  collected history.
- The connection fingerprint stays the provider identity (reference, workspace,
  game, provider, server ID, origin, operator variable name and network
  exception), never key content; existing connections keep matching.
- A missing keyring, an unknown key ID or a failed decryption makes the run fail
  with the existing sanitized category `configuration` (the public health
  contract is unchanged). The dashboard shows the specific reason
  (`key_unavailable` or `decrypt_failed`). There is never a fallback to another
  key, a variable or an unauthenticated request.

## Network policy and quotas

Unchanged and shared by tests and collection: HTTPS only, DNS resolved once
and pinned, every resolved address must be public (loopback, private,
link-local, metadata, CGNAT and documentation ranges are refused), redirects
are refused, only the provider's allowlisted read paths, a 10 s timeout and a
2 MiB response limit. Workspaces cannot set network exceptions. An operator
catalog exception applies only inside Convex (collection and **Test saved
key**), never to a test run from the web server, whose network differs: for such
a source, save a new key as unverified and then verify it with **Test saved
key**. Logi is not a general HTTP or RCON proxy: a test returns a category only.
Any HTTPS port is accepted, as for collection.

Connection tests are limited to 30 per workspace, 6 per source and 30 per
administrator across workspaces in 10 minutes; a refused test spends none of
them. A workspace has at most 20 registrations. Collectors keep honouring
provider `Retry-After` (capped at 24 h); a test only reports it to the
administrator.

## Operator runbook

Run these only against the intended deployment. A local Convex must be separate
from production; never test-write into production.

### 1. Activate encryption (once)

1. Generate a key without echoing it into shared logs, for example
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
   and build `{"current":"<id>","keys":{"<id>":"<value>"}}`.
2. Store the keyring in your secret manager, **separately** from database
   backups.
3. Set it in Convex (`npx convex env set LOGI_CREDENTIAL_KEYRING` with the value
   from a file or prompt, not in shell history) and in the Next server
   environment. Both must be identical.
4. Deploy Convex (`bunx convex deploy`) and then Next **immediately**: the
   previous Next build calls functions this release removes or changes. The
   schema change only adds optional fields, tables and indexes, so existing data
   stays valid.

What stops at deploy, by design:

- **Workspace registrations that named a variable** (created through the
  previous dashboard form) stop collecting, and their live reads return
  nothing, until they are migrated (step 2) or their administrator enters the
  key. Run the workspace dry run (it reads no values) right after deploying and
  migrate the confirmed ones straight away, so the gap stays short.
- **Keyless workspace registrations with an administrator-chosen network
  exception** (for example a keyless CRCON source) pause with a configuration
  error, because the exception is no longer honoured. They do not appear in the
  migration report; their administrator restarts collection with **Start
  collecting**, which binds the source without the exception.

### 2. Migrate existing variables

Dry run first; the report contains workspace, reference, provider, host,
variable **name** and status, never a value:

```bash
npx convex run gameDataCredentialActions:migrateLegacy '{"dryRun":true,"phase":"operator"}'
npx convex run gameDataCredentialActions:migrateLegacy '{"dryRun":true,"phase":"workspace"}'
```

Statuses: `would_migrate`, `migrated`, `already_encrypted`, `stale`,
`missing_variable`, `invalid_variable`, `conflict` (another workspace names the
same variable; never migrated), `needs_confirmation`, `encryption_unavailable`.
The workspace phase pages with `"cursor"` from `nextCursor`.

Apply operator entries in bulk, then each workspace registration only after you
checked that its variable really belongs to that workspace:

```bash
npx convex run gameDataCredentialActions:migrateLegacy '{"dryRun":false,"phase":"operator"}'
npx convex run gameDataCredentialActions:migrateLegacy '{"dryRun":false,"phase":"workspace","guildId":"<guild>","ref":"<ref>","confirmWorkspaceBinding":true}'
```

Each adoption re-checks the variable name and revision in one transaction and
is idempotent; rerunning after a partial failure continues where it stopped.
Only the variables named by the selected sources are read. After the
administrators have tested the migrated keys, delete the old
`LOGI_GAME_DATA_*_TOKEN` variables. The `secretRef` left in an operator catalog
entry is ignored once a key is stored.

### 3. Rotate the keyring

1. Add a new key ID, set it as `current`, keep the old one, and update both
   runtimes.
2. Re-encrypt in bounded, resumable pages until `nextCursor` is `null`, with a
   dry run first:
   `npx convex run gameDataCredentialActions:reencrypt '{"dryRun":false,"limit":50,"cursor":null}'`.
   Each replacement is a compare-and-swap; a key changed meanwhile is reported
   as `stale` and picked up by the next pass.
3. Retire the old key only after a complete pass reports nothing pending and
   no failures (`orphaned` rows belong to removed sources and can be ignored).

### Undo a workspace key on an operator source

A workspace may replace the key of an operator catalog entry but cannot remove
it, because removal would silently return the source to its variable. The
operator can: `npx convex run gameDataCredentialMigration:removeOperatorSourceKey '{"guildId":"<guild>","ref":"<ref>"}'`
deletes the stored key and stops collection; restart it deliberately with
`gameData:configure`.

A migration `conflict` caused by a registration from before this change that
names the operator's variable is resolved by removing or re-keying that
registration first.

### Recovery and rollback

- A database backup is restorable only together with a keyring that contains
  every key ID used in that backup. Losing the keyring makes stored keys
  unrecoverable: administrators must enter them again.
- Once any key has been stored, roll forward only. Do not deploy a version that
  cannot read `gameDataCredentials` or the new fields.
- Hosting or SSO outages are not addressed by this change.

## Isolation and API parity

All lookups, tests, mutations and decryption check both the workspace and the
stable reference. Display names are unique per workspace only; two workspaces
may connect the same server.

Credential management is deliberately **not** part of `/api/v1`: sending provider
keys to websites or bots is exactly what this design forbids. The existing
read-only snapshot and health resources are unchanged and never contain keys,
ciphertext or addresses.

## Security review

| Threat                                              | Mitigation                                                                                                                                                       | Residual risk                                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| A workspace borrows another workspace's key         | No variable names from workspaces; legacy rows disabled; AAD binds workspace and source; workspace + reference checked on every path                             | none known                                                                                |
| Key redirected to another host after an edit        | Identity is immutable; AAD includes canonical origin and server ID                                                                                               | none known                                                                                |
| SSRF through the test                               | Collector transport: HTTPS, pinned DNS, public addresses only, no redirects, path allowlist, size and time limits, quotas; category-only answers                 | An administrator can probe allowlisted paths on public HTTPS hosts within the quota       |
| Plaintext in Convex args, logs, errors or responses | Only ciphertext crosses into Convex; exceptions are mapped to codes; sentinel tests scan database rows, list results, reports, recorded calls and console output | The key is in Next and action memory during a request                                     |
| Stale worker after rotation or removal              | Generation checks in the envelope query and every write                                                                                                          | none known                                                                                |
| Database or backup leak                             | Ciphertext useless without the keyring, which is stored elsewhere                                                                                                | Whoever holds both runtimes' environment can decrypt                                      |
| Keyring missing or wrong                            | Fail closed with a sanitized category; no plaintext writes when inactive                                                                                         | Collection stops until fixed                                                              |
| Tampered ciphertext                                 | GCM authentication                                                                                                                                               | none known                                                                                |
| Gateway attests "verified"                          | The gateway holds the internal secret and tests in the same request; Convex re-checks the session, admin rights, revision and identity                           | A compromised Next server could store an untested key for a workspace it already controls |
| Late test result verifies a replaced key            | A stored-key test records only if the key row, version and nonce are unchanged                                                                                   | none known                                                                                |
| Removing an optional key silently goes keyless      | Removing a key always stops collection                                                                                                                           | none known                                                                                |
| Probing through many workspaces                     | Quotas per workspace, per source and per administrator, all-or-nothing                                                                                           | Bounded probing of public HTTPS hosts on any port                                         |
| Rollback to an older ciphertext                     | Requires database write access                                                                                                                                   | Someone with database write access could restore an older key of the same source          |
| Browser password managers                           | Masked key fields opt out of autofill and password-manager capture                                                                                               | A browser may still offer to save the value                                               |
| Keyring in default-runtime mutations                | Mutations read only the key IDs to refuse undecryptable ciphertext; they never decode keys                                                                       | The keyring value is present in the Convex environment, as it must be for the actions     |

## Evidence

Synthetic tests (no real keys, hosts or workspaces):

- `src/infrastructure/game-data/credential-cipher.test.ts`: round trip, nonce
  uniqueness, tampering, wrong key and AAD, unknown key ID, missing keyring,
  rotation, keyring validation without echo.
- `src/domain/game-data/credentials.test.ts`: draft canonicalisation, AAD
  format, key format, mode table including legacy rows, fingerprint
  compatibility.
- `src/infrastructure/game-data/credential-resolver.test.ts`,
  `connection-test.test.ts`, `provider-http.test.ts`: one decryption per run,
  no fallback, operator-named variable only, what each test proves, 401/403/429/5xx,
  timeout, oversize, redirect, private and rebinding DNS answers, header
  injection.
- `src/infrastructure/convex/game-data-credentials.test.ts`: full flow,
  workspace A/B isolation, 250 sources across 25 workspaces, rotation fencing,
  delete during collection, legacy rows, migration (dry run, conflict,
  confirmation, stale revision, idempotence), resumable compare-and-swap
  re-encryption, stored-key test quota, leak sentinels.
- `src/lib/api/game-data-sources-route.test.ts`: Origin, size limit, enable
  only after a pass, disabled draft, no storage without encryption, key
  validation without echo, test against the stored identity including operator
  exceptions, typed failures.

Secret-free screenshots of the component, rendered in isolation with synthetic
data and the application's styles, are in
[evidence/2026-10-04-game-server-credentials](./evidence/2026-10-04-game-server-credentials/).

### Pending live acceptance (owner)

With the keyring activated in a non-production deployment first, then in
production. The identifiers below are for acceptance only; the keys are not in
this repository and must not be added to it or to screenshots.

|           | Value                                                                            |
| --------- | -------------------------------------------------------------------------------- |
| Workspace | `q57371ac8n5xzw0vref2hj2q018c4ft0`, guild `963323629242826762`                   |
| Warcon    | `https://wardogs.valkyriahll.app`, server `b866b9c9-591f-4edb-97ee-d2595751f74c` |
| HLL CRCON | `https://admin1.valkyriahll.app`, server number `1`                              |

1. As a Valkyria administrator, connect both servers with their keys, run
   **Test connection** and save with collection enabled.
2. Confirm the list shows the key as stored and verified, collection runs and
   live reads work.
3. Change a key to a wrong value without `allowUnverified` and confirm nothing
   changes; then remove and re-add a key.
4. If the servers were operator catalog entries, run the migration dry run and
   apply it, then delete the old variables.
