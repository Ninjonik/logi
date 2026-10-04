# Configuration coverage in PR #158

Source audit: `20b52805b190e0152c6a91911eee88c014d6fc07`, 2026-10-04.
This is a settings inventory, not a claim that every feature is activated in
production or has been exercised through the browser in this acceptance run.

## Available in Logi UI

| Feature                                                   | Location and controls                                                                                                                                                                    | Qualification                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HLL / Wardogs public server, scoreboard and result panels | Discord settings → Public panels: feature, source, channel, enabled, refresh 30/60/300 seconds, public leaders, private player details, map/banner                                       | Channel picker groups categories, supports search and pasted IDs. Publication status and owned-message link are shown. Results require reviewed results; they are not live scores.                                                                                                                               |
| Report Player                                             | Public panel → ticket category, or Disabled; Tickets → parent room and support roles                                                                                                     | The chosen category supplies the private destination. Available for CRCON/Warcon server/scoreboard panels, not result announcements.                                                                                                                                                                             |
| Wardogs League discovery and cards                        | Wardogs → System → Imports → League tracking: enabled, watched team codes, human-link room, output room, manual URL preview/addition and per-match management                            | Empty output collects without publishing. Scan cadence (10/15/30/60 minutes) and detail refresh (5/10/15/30 minutes) are chosen per workspace; the shared index scan follows the fastest enabled workspace.                                                                                                      |
| Provider source registration and credential rotation      | System → Game server data → Provider sources: reference, provider, provider server ID, HTTPS origin, token variable name, optional network allowlist; update reference/allowlist; remove | Registrations merge with the operator catalog (`LOGI_GAME_DATA_SOURCES`), which keeps precedence per reference. Token values stay in Convex environment variables and are never entered or displayed. Rotation refreshes the connection fingerprint; removal disables the connection and keeps retained history. |
| Existing CRCON / Warcon connections                       | System → Game server data: enable, disable, refresh view, health, source snapshot and history state                                                                                      | Only operator-preconfigured sources are available. Refresh reloads the dashboard state; it is not a general forced provider refresh.                                                                                                                                                                             |
| Retained Wardogs game history                             | System → Game server data: filters, minimum observed player minutes, rankings, faction totals and game details                                                                           | Collection follows the enabled source. **History retention** keeps games indefinitely by default or for 90/180/365/730 days; expired games are deleted nightly and the history revision advances. There is no separate history-only switch or per-game deletion UI.                                              |
| Website read access                                       | System → Website API: create/revoke restricted keys, select resources and games                                                                                                          | Includes explicit HLL live, Warcon, retained history, League, member, roster and statistics grants. Secret keys belong in the website backend.                                                                                                                                                                   |
| Membership/role observations for the website              | System → membership integrations: enable policy per eligible key and enter allowed Discord role IDs per game                                                                             | IDs are entered as text; this is not a visual role picker. Read permission does not itself grant website administration.                                                                                                                                                                                         |
| Managed Discord membership roles                          | Membership settings: categories, recruitment/final/support roles and game-specific settings; operation status/audit                                                                      | Existing assignment/application workflows drive the queue. Audit refresh is manual; no permission-bypassing force/retry control exists.                                                                                                                                                                          |
| SSO application registration                              | System → SSO: application name, website URL, callback URI, create/remove client                                                                                                          | Server-wide provider activation, signing keys and issuer remain deployment configuration.                                                                                                                                                                                                                        |
| `/stats` command controls                                 | Clan settings → Discord → Player statistics command: command on/off, Hell Let Loose and Wardogs switches, default sharing channel                                                        | A switched-off command or game answers privately that statistics are unavailable. The default channel is used when the command has no channel option; Share still checks the member's and bot's permissions there. Discord's own command permissions remain separate.                                            |
| Website event-write policy                                | System → Website event commands: registered SSO application, live restricted command key, enabled flag, allowed Discord role IDs per supported game                                      | Saving an enabled policy grants event-command write access for games with roles; disabling removes it. Bearer keys cannot configure policies. Role IDs are entered as text.                                                                                                                                      |
| Account links                                             | Account settings / existing platform management; verified Steam flow, with late self-declared lookup offered by `/stats`                                                                 | A self-declared statistics lookup is not proof of Steam ownership or role authority.                                                                                                                                                                                                                             |
| Rosters, attendance and reviewed results                  | Existing event/roster/result screens manage authoritative records                                                                                                                        | Website read exposure is controlled through API grants; web writes for rosters/attendance remain outside the agreed scope.                                                                                                                                                                                       |

Restart reconciliation and duplicate prevention are automatic behavior of managed
panels; they do not need an administrator toggle. On-demand `/stats` sharing is a
separate snapshot with an explicit Discord channel selection.

## Settings gaps and deployment prerequisites

- **Provider tokens:** sources can now be registered and their credential reference
  rotated in Logi, but the token values themselves still live in Convex environment
  variables (`LOGI_GAME_DATA_<NAME>_TOKEN`) that the operator sets. Logi never
  stores, displays or validates a token value.
- **Per-command controls:** `/stats` has an on/off switch, per-game switches and a
  default sharing room in Clan settings → Discord. There is still no
  command-specific role policy editor; Discord's own command access controls
  remain the place for role restrictions.
- **SSO runtime setup:** the provider opt-in, issuer, signing key and matching
  website deployment configuration cannot be completed solely in Logi UI.
- **Reading human Discord links:** the input room is selectable in Logi, but the
  operator must enable `LOGI_LEAGUE_MESSAGE_CONTENT` and Discord Message Content
  Intent, then restart the bot. Scanning and manual registration work separately.
- **Team catalogue with names/logos:** the workspace/game-specific design is
  approved, but the catalogue database/editor and searchable match team picker
  are not implemented. Watched League team codes are not that catalogue.
- **Visual customization:** packaged map artwork can be toggled; there is no
  general embed layout, arbitrary banner-upload or faction-emoji editor.

These gaps are recorded for the next implementation decision; they are not
silently counted as completed settings. Operational credentials/intents still
require administrator setup even if future forms make onboarding easier.

## Source and runtime evidence

Primary UI sources are `src/components/app/discord-public-panels-form.tsx`,
`discord-channel-select.tsx`, `league-tracking-form.tsx`,
`game-data-connections.tsx`, `game-history-panel.tsx`, `api-key-manager.tsx`,
`membership-integration-settings.tsx`, `membership-settings-form.tsx` and
`sso-applications.tsx`. The System page wires the relevant integration sections;
Discord settings wires the public panels form. `/stats` is registered in
`discord-bot/src/interactions.ts`.

The [latest local acceptance](evidence/2026-10-04-discord-workflows/README.md)
includes an actual dashboard save of the HLL public panel and its report-category
selection. That browser proof does not certify every other form in this inventory.
