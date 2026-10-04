# Incremental security review and repair

The completed Codex Security scan reviewed immutable range
`0eec5d4b6dce1daf2f5f9aea3026136308b49196` →
`20b52805b190e0152c6a91911eee88c014d6fc07`. This is the latest HLL live,
private-report and legacy-command increment, **not a fresh audit of all PR #158**.
The repair is commit `ba7af186f98e569a16a68a6a3455afc99c31d22e`.

- [Generated security report](security/report.md)
- [Sealed manifest](security/scan-manifest.json), [findings](security/findings.json)
  and [coverage](security/coverage.json)
- [Architecture threat model](security/artifacts/01_context/threat_model.md)
- [Follow-up verification and artifact digests](security-validation.json)

These scan files are unmodified copies of the completed scan. They describe the
pre-repair revision; they are not rewritten to label the old revision as fixed.
Scan ID: `0b7fbe18-c2f1-4d13-bac9-06ee2cdb05db`.

## Confirmed finding and fix

**Low — Former administrators can close reports while guild permissions remain
cached** (`csf_c46979d15b6f0f4167ba0a88`, CWE-863).

`/close_ticket` refreshed the member but evaluated Discord.js administrator
permissions using potentially stale role definitions or guild ownership. A
formerly privileged user who still had access to the thread could close it if
those caches had not incorporated a revocation. This is conditional on stale
Discord data, not an unauthenticated or cross-workspace bypass. The legacy closing
path predates this increment; new player reports also use it.

The fix refreshes the guild, its role definitions and then the member before
evaluating authority. Failed refreshes leave the ticket open. Existing support
roles and dashboard-admin policy still apply; the fix does not broaden access.

The regression calls the actual interaction handler and the installed
`GuildMember.permissions` getter with synthetic guild/member data. Before the fix,
four cases incorrectly reached the closing mutation: revoked administrator role,
former owner, unavailable roles and unavailable guild. After the fix all four are
denied, while a current administrator can still close. The focused suite passes
9/9 and the full suite passes **936/936**, with zero failures or skips.

- [Before-fix output](security/artifacts/02_discovery/validation_artifacts/candidate-98b35b7ecc0c8507/before.log)
- [Original reproducer](security/artifacts/02_discovery/validation_artifacts/candidate-98b35b7ecc0c8507/regression.test.ts.txt)
- [After-fix focused output](security-regression-after.txt)
- [After-fix full suite](security-full-suite.txt)
- [Maintained regression](../../../../../discord-bot/src/interactions/workflow-commands.test.ts)

The original reproducer is copied as `regression.test.ts.txt` with unchanged
contents to keep evidence outside the application compiler/test globs; the sealed
manifest still names its original `.ts` path. The maintained test includes
TypeScript-target-compatible `BigInt(0)` expressions.
The repair has deterministic source/test proof. The preceding real Discord
screenshots were captured at `20b5280`, so they do not prove a live permission
revocation against the repaired handler.

## Coverage qualification

All **49/49** automatic changed-source inventory entries were accounted for,
along with one additional synthetic fixture and 21 documentation/proof paths:
**71 unique changed paths**. Discovery reviewed the HLL provider/API/cache
boundary, report persistence/delivery/privacy, legacy Discord/account commands,
generated bindings and translations. One candidate was validated and reported.

The sealed tool artifact nevertheless records **partial** coverage. It retains
the earlier `Discovery in progress` deferred entry covering 45 paths even though
its final surface rows record those paths as reviewed. It also retains four
duplicate surface rows from the checkpoint (75 rows for 71 paths). We preserve
and disclose that discrepancy; this is not a clean or fully covered scan badge.
The final source dispositions do not establish hosted/runtime acceptance.

Not covered by this incremental scan: older PR changes, production configuration,
live cache-staleness frequency, populated real HLL statistics, or an independent
nonstaff Discord account's privacy/denial checks. See the acceptance README for
the broader runtime limits. No production write or deployment was performed.

## Measured scan usage

The tool reported 13,603,287 total tokens, 13,552,133 input tokens (including
13,042,560 cached input tokens), and 51,154 output tokens across four rollouts.
These are tool-reported cumulative rollout counters, not unique source tokens
or a billing estimate.
