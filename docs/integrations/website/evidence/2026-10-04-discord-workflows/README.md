# Discord workflow and HLL live acceptance — 2026-10-04

Baseline: `0eec5d4b6dce1daf2f5f9aea3026136308b49196`. This evidence belongs to
the HLL live/private-report increment in PR #158. The final PR comment identifies
the pushed revision and subsequent security-review status.

## Automated checks

- Full suite: **931 passed, 0 failed, 0 skipped**.
- TypeScript: passed after correcting a union type in the new picker test.
- Clean Next.js production webpack build: passed with synthetic credentials.
- Convex generation: normal codegen against the isolated loopback backend;
  no private fixture modules in committed generated bindings.
- Local Convex deployment: passed. No production deployment or production DB writes.
- Regression coverage includes canonical/legacy guild lookup, wrong bot secret,
  Discord-subject collisions, Steam alias/verified-owner conflicts, interaction
  acknowledgement, revoked staff, report policy/source changes, subject isolation,
  cooldown/form/open-report bounds, uncertain delivery/lease recovery, escaped
  embed limits, unique component IDs, HLL round changes, cache aging and key grants.

Reproduce locally using synthetic test environment variables, then
`npm test`, `npm run typecheck`, `npm run build` (webpack was selected for the
Windows proof build). Deployment must target an explicitly isolated database.
See [implementation/contract](../../hll-live-and-player-reports.md).

## Actual Discord acceptance

Authorized test application and Dorfmada test channel only; local Convex stores
all fixture state. Provider reads use the owner's CRCON public endpoints. Every
report/application text in this proof is explicitly synthetic.

| Workflow | Observed result | Evidence |
| --- | --- | --- |
| `/player` | Actual autocomplete and profile message; membership/history are local fixtures | [Profile](player-profile.jpg) |
| `/link` | Private management panel recognizes the existing Steam link | [Link panel](link-private.jpg) |
| `/notice` | Autocomplete resolves canonical workspace event; private modal saves the late notice | [Saved notice](notice-saved.jpg) |
| Support ticket | Button/modal creates private, non-invitable thread; `/close_ticket` closes, locks/archives and DMs | [Closed ticket](ticket-closed.jpg) |
| Membership application | Existing platform link accepted; private thread opens and closes as Member; local assignment and DM verified | [Open](application-open.jpg), [Closed](application-closed.jpg) |
| HLL live panel | Real St. Marie Du Mont Warfare, 0/100 online, Allies/Axis 2:2, packaged map artwork | [HLL panel](hll-live-panel.jpg) |
| HLL player button | Actual ephemeral reply, empty connected-player list, no Steam IDs | [Private details](hll-private-players.jpg) |
| Report Player | Private selection/modal → one tracked private thread → staff/reporter members → `/close_ticket` → archived/locked, stored closed state and DM | [Form](report-player-form.jpg), [Private report](report-player-private.jpg), [Closed](report-player-closed.jpg) |
| Restart/replay | New process republishes HLL into the same message ID; replay of the closed report keeps its thread and message count | [Replay record](report-replay-proof.json) |

Report thread: `1556111041325178962`; HLL panel message:
`1556107250618077194`. The HLL message ID remained unchanged across processes.
The report used a manual synthetic player because the live source had no connected
players. Unit fixtures cover observed-player selection and populated leaders.

The initial application closing screenshot exposed a missing-outcome bug when a
reason was present. The source now includes both outcome and reason, verified by
English/Czech renderer regression tests; that screenshot predates the repair.
The report screenshot likewise predates removal of an unnecessary internal
connection ID from the private card. Do not treat either as final-layout proof.

## Actual website API acceptance

Local Next.js → local Convex → real public CRCON, using short-lived test keys:

| Request | Result |
| --- | --- |
| Missing key | 401 |
| Aggregate-only server-snapshot key | 403 |
| Explicit `hll-live` + HLL grant | 200; typed live envelope; zero connected players |
| Unsupported query parameter | 400 |
| Revoked formerly authorized key | 401 |

Responses observed `Cache-Control: no-store`. Test keys were revoked in cleanup.
No key values, credentials or raw provider responses are included. See
[machine-readable API proof](api-proof.json).

## Scope and remaining acceptance

This is not a claim that every historical Discord command has a new live test.
Event signup/roster/reminder/recap branches and populated `/stats` filters retain
their earlier tests/evidence; they were not all driven again in this increment.
`/link` add/remove was regression-tested without modifying the user's real link.
Actual role grant/revoke remains unproven with this actor's hierarchy. A second
nonstaff account is still needed for an independent Discord privacy/closure-denial
check. Fresh-access denial and policy changes have deterministic regression tests.

HLL populated real player statistics have not been observed on this empty server.
Synthetic populated CRCON fixtures are not provider acceptance. HLL Records
automated profile fetching remains separately blocked by HTTP 403. Production
panel destinations/roles, hosted website integration and production activation
remain unverified. The new report recovery tests cover injected ambiguous creates;
the actual restart proof reuses existing bindings and does not induce transport
loss on Discord.

Security review of this increment is pending at the initial push. Its scope and
result will be appended after review; prior PR security reviews do not certify
these newly added files.
