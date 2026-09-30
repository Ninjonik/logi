# Local runtime and test Discord acceptance — 2026-09-30

The unchanged runtime at **`b5b452ce40ffda609b0c06e3114a35dbd0498ab1`** now
passes a full production build against a real, separate local Convex database.
The Next production server, Convex functions, collectors and Discord bot were
run together. This extends the earlier synthetic proof; it does not qualify
production deployment, live game providers or real OAuth sign-in.

**Release blocker found during the extended run:** the bot exited after about
8 hours 57 minutes with an unhandled WebSocket `ECONNRESET`. A matching failure
in the installed Discord SDK was reproduced on loopback. It is not fixed or
qualified by this evidence package; see the diagnostic below.

Functional-check logs start on September 29 UTC; the extended run and cleanup
end on September 30 UTC. The local execution date was September 30 in
Europe/Prague. Node was **24.21.0** on Windows.

## Environment and boundaries

- The user identified the supplied Convex deployment as production. Its
  credentials were never loaded by the test processes, and it was not deployed
  to, seeded, or queried for acceptance.
- A native official Convex backend ran on loopback with a separate SQLite
  database and new local secrets. The backend release and verified download
  digest are in the [manifest](evidence/2026-09-30/manifest.json).
- The user supplied a separate test bot and approved one guild, a dedicated
  test channel and five new roles with no permissions. All bot event messages
  were directed to that channel. Existing member roles and their ordering were
  not changed.
- HLL CRCON and Wardogs RCON responses came from a local HTTPS fixture server.
  The unmodified production transports performed actual HTTPS requests. Normal
  certificate verification remained enabled, with an extra CA scoped to the
  local backend process and an explicit operator loopback address allowlist.
- Browser and HTTP administration used an explicitly synthetic local session.
  The supplied OAuth client belongs to a different application from the test
  bot; no production OAuth secret was reused for it.
- Original environments, tokens, local service keys, sessions, database files,
  Discord records and screenshots remain in a private directory outside Git.
  The files linked below contain sanitized proof only. Guild/member identifiers
  and raw bot logs are excluded from the public package.

## Executed checks

| Check | Observed result | Evidence |
| --- | --- | --- |
| Unit and adapter suite | **551 passed**, 0 failed, 0 skipped | [Named output](evidence/2026-09-30/tests.txt) |
| Root TypeScript check, including `convex/` | Exit 0 | [Output](evidence/2026-09-30/typecheck.txt) |
| Schema and function push to the separate local backend | Exit 0 | [Output](evidence/2026-09-30/convex-push.txt) |
| Full Next production build | **Exit 0**, including prerendering | [Full output](evidence/2026-09-30/build.txt) |
| Actual local HTTP and persistent database acceptance | 32 cases passed after correcting three harness contract assumptions | [Initial attempt and corrected readback](evidence/2026-09-30/acceptance.json) |
| HTTPS collector, history and collected-result acceptance | 13 cases passed | [Collector cases](evidence/2026-09-30/acceptance.json) |
| Actual Discord membership reads | 3 cases passed | [Membership cases](evidence/2026-09-30/acceptance.json) |
| Actual Discord managed-role guard | Ineligible target denied and audited; no test role applied | [Discord cases](evidence/2026-09-30/acceptance.json) |
| User-invoked `/server-status game:wardogs`, before configuring fixtures | User confirmed a private “source not configured” response | [Manual evidence, explicitly labelled](evidence/2026-09-30/acceptance.json) |
| Browser checks | 5 observations, including persisted source disable/resume and result history | [Browser cases](evidence/2026-09-30/acceptance.json) |
| Extended bot runtime | **Exit 1** after 32,219,827 ms; unhandled WebSocket `ECONNRESET` | [Failure and isolated diagnostic](evidence/2026-09-30/websocket-reproduction.json) |
| ESLint on the same cumulative changed-file list as the earlier proof | **3 errors, 17 warnings**, exit 1 | [Diagnostics](evidence/2026-09-30/eslint-changed.txt), [file list](evidence/2026-09-29/eslint-files.txt) |
| ESLint over the entire repository | **143 errors, 142 warnings**, exit 1; wider scope than the preceding row | [Summary and full-log digest](evidence/2026-09-30/eslint-repository-summary.txt) |
| Existing lint script (`next lint`) | Exit 1; unsupported command is interpreted as a project directory | [Output](evidence/2026-09-30/lint-script.txt) |

The earlier build failure against an unserved synthetic database is historical.
This run resolves that local build prerequisite. **Lint remains non-green.** The
unchanged changed-file errors are at `convex/competitions.ts:52,54,58`; the wider
repository lint result is not an attribution of all findings to this PR.

## What actually crossed a runtime boundary

**Web API and persistence.** Real HTTP requests exercised missing, invalid and
revoked bearer keys, resource/game/guild isolation, write denial, change-feed
watermarks and cursor binding, scoped record refetch, and administrative session
and origin checks. Result staging and confirmation wrote actual immutable
revisions. Two simultaneous corrections with the same expected revision produced
one HTTP 200 and one HTTP 409; the earlier zero and unknown scores remained in
history. This is a small concurrency test, not a load test.

**Collectors.** The HLL snapshot reached the API with 0 players and scores 0/5.
History discovery fetched a single completed fixture session and stored one
session record. WDG preserved 0/98 players and all three scores, 0/12/7, and
reported unavailable history as null. The fixture request log contained only the
six allowed GET paths; the advertised RCON ban route was never called. WDG
authorization was checked by the local HTTPS server. Provider credentials,
addresses and HLL private response fields were absent from consumer settings
and snapshot projections.

**Collected results.** Imported history did not automatically become an event
result. Explicit staging produced a provisional revision with its source digest
and two distinct platform IDs. Identical nicknames did not link either player to
a Logi account. Explicit reviewer confirmation appended revision 2, preserved
the provisional revision and became readable through the restricted result API.

**Discord.** The actual bot connected, registered all six PR slash commands and
published the initial two event messages using Discord Components V2. REST
readback verified their guild scope, permissions and message structure. An
exact-member refresh returned `present`/`verified_member` and only allowlisted
role IDs. The role worker checked fresh Discord state and denied the approved
target because its highest role was above the bot. The queue and audit recorded
`target_not_eligible`; this proves the guard, not successful role assignment.

**Browser.** The real production dashboard, settings and system page rendered
local data. The game-data panel showed HLL history and WDG faction scores.
Disabling and resuming WDG through the browser was confirmed by database
readback. A synthetic event was concluded through the UI; its result dialog
displayed provisional, confirmed and corrected versions with the original zero
and unknown values retained.

## Harness corrections and limits

The initial HTTP harness wrongly expected a top-level result `status`, a
`dm_permission` field in guild command readback, and legacy embeds. The actual
contracts use `resultState`/`result.status`, `guild_id`, and Components V2. The
three initial failures are retained beside their corrected successful readback;
no application code was changed to satisfy them.

Other setup attempts were corrected locally: the unit-test environment initially
used a random secret where the existing fixtures require a fixed synthetic
secret; explicit Convex typecheck mode expected a separate `convex/tsconfig.json`
which this repository does not have; the role harness initially treated
`pending` as terminal; updating an existing local environment required the CLI's
overwrite flag. Root TypeScript passed independently. Docker startup was
unavailable, so the native backend was used without resetting Docker data.

The initial browser URL used `127.0.0.1` while the configured site origin was
`localhost`. Writes were denied as a foreign origin. Using the configured
`localhost` origin made the unchanged UI writes pass; origin protection was not
disabled.

## Acceptance still open

| Remaining check | Why it is not proved here |
| --- | --- |
| Bot resilience during network interruption | Extended runtime exited on an unhandled WebSocket error. The SDK failure is reproduced; a fix/upgrade and a new interrupted-network acceptance run remain required. |
| Positive managed-role add, replacement and removal | The user-approved target is above the bot. Use an approved member below the bot, or have a guild administrator change hierarchy. No bypass was attempted. |
| Configured-source slash response | A second manual invocation was requested after loading fixtures; it has not been confirmed in this evidence snapshot. |
| Live HLL CRCON and the selected Wardogs server | No live source origins/credentials were supplied. HTTPS fixture acceptance does not establish provider version/schema parity. |
| Real Discord OAuth and Steam OpenID | Matching test-app credentials, redirect configuration and interactive account authorization are still needed. Synthetic sessions are not sign-in proof. |
| Website consumer acceptance | Valkyria's own sessions, API adapter, change/webhook inbox, consent and cache behavior were not run in this test. |
| Outbound webhook receiver, recap DM, Discord join/leave lifecycle | Covered by existing tests where documented; no live delivery or lifecycle acceptance was performed here. |
| Hosted deployment, recovery and load | A native Windows local backend does not establish hosted configuration, capacity, rollout or rollback behavior. |
| Lint | Both documented lint scopes and the existing lint script remain non-green. |
| Optional Logi SSO | Remains unqualified and disabled pending the separate private review and acceptance. |

## Extended-run failure and next implementation step

The original bot log recorded Discord gateway DNS failures, followed later by an
uncaught `read ECONNRESET` emitted by `ws`. The installed `@discordjs/ws` 1.2.3
teardown clears `connection.onerror` even when the underlying connection is
still `CONNECTING`. A subsequent handshake failure then has no socket error
listener. Existing `Client`/shard error handlers cannot receive that event.

The [isolated diagnostic](evidence/2026-09-30/reproduce-websocket-reset.mjs) uses
the installed SDK, a loopback HTTP server and no Discord credentials. Its
control closes the handshake while the SDK listener remains attached and exits
0. Destroying the connecting shard first and then closing the same handshake
exits 1 with an unhandled `ECONNRESET`. This confirms the dependency failure
class. The original stack does not itself trace the initiating teardown, so the
precise trigger of the overnight event remains an inference.

```sh
# Expected exit 0: reset handled by the SDK.
node docs/integrations/website/v0.10/evidence/2026-09-30/reproduce-websocket-reset.mjs control
# Expected exit 1 on the captured dependency: reproduces the defect.
node docs/integrations/website/v0.10/evidence/2026-09-30/reproduce-websocket-reset.mjs destroy-connecting
```

The next runtime change must preserve an error listener until the retiring
socket has closed, either through a qualified upstream dependency fix or a
narrow, reviewed adapter. Then both diagnostic modes must survive, connection
recovery must be verified, and the full regression/typecheck/build plus an
interrupted-network bot run must pass. Blanket suppression of uncaught process
exceptions would not demonstrate safe recovery. No runtime workaround or
dependency upgrade is hidden in this documentation commit.

## Cleanup

The bot had already exited with the recorded error when cleanup began. Its
previous **19 command definitions** were restored and compared through Discord
REST readback, including definition-level default permissions. Recreated
command IDs may differ; per-command permission overrides were not captured or
verified. The separate channel and zero-permission test roles remain for owner
inspection, with no test role assigned to the approved member.

The local Next server, fixture provider, native backend and temporary session
bootstrap were stopped. The local database and private evidence are preserved.
See [Discord cleanup](evidence/2026-09-30/discord-cleanup.json) and
[local runtime cleanup](evidence/2026-09-30/runtime-cleanup.json). Continuing
interactive tests requires restarting the isolated runtime; the bot is not
being left connected in the background.

## Reproduction and integrity

The [manifest](evidence/2026-09-30/manifest.json) records actual commands, exit
codes, durations, runtime source, boundaries and SHA-256 hashes. Verify the public
package from the repository root:

```sh
node docs/integrations/website/v0.10/evidence/2026-09-30/verify-proof.mjs
```

This checks artifact integrity and unchanged runtime source. It does **not**
rerun acceptance or contact Discord. Rerunning the runtime checks requires a
fresh isolated backend, fresh local keys/session, operator fixture catalog and
explicitly approved test guild; never load the production environment as a
shortcut. The private one-off harness and original logs are retained locally for
the owner. The earlier [credential-free reproduction commands](verification-evidence.md#reproduce)
remain available for the regression suite and offline checks.
