# Configuration coverage in PR #158

Source audit: `20b52805b190e0152c6a91911eee88c014d6fc07`, 2026-10-04.
This is a settings inventory, not a claim that every feature is activated in
production or has been exercised through the browser in this acceptance run.

## Available in Logi UI

| Feature | Location and controls | Qualification |
| --- | --- | --- |
| HLL / Wardogs public server, scoreboard and result panels | Discord settings → Public panels: feature, source, channel, enabled, refresh 30/60/300 seconds, public leaders, private player details, map/banner | Channel picker groups categories, supports search and pasted IDs. Publication status and owned-message link are shown. Results require reviewed results; they are not live scores. |
| Report Player | Public panel → ticket category, or Disabled; Tickets → parent room and support roles | The chosen category supplies the private destination. Available for CRCON/Warcon server/scoreboard panels, not result announcements. |
| Wardogs League discovery and cards | Wardogs → System → Imports → League tracking: enabled, watched team codes, human-link room, output room, manual URL preview/addition and per-match management | Empty output collects without publishing. Scan cadence is fixed at 10 minutes and detail refresh at 5 minutes; there is no cadence editor. |
| Existing CRCON / Warcon connections | System → Game server data: enable, disable, refresh view, health, source snapshot and history state | Only operator-preconfigured sources are available. Refresh reloads the dashboard state; it is not a general forced provider refresh. |
| Retained Wardogs game history | System → Game server data: filters, minimum observed player minutes, rankings, faction totals and game details | Collection follows the enabled source. No separate history-only switch, retention editor or archive-deletion UI. |
| Website read access | System → Website API: create/revoke restricted keys, select resources and games | Includes explicit HLL live, Warcon, retained history, League, member, roster and statistics grants. Secret keys belong in the website backend. |
| Membership/role observations for the website | System → membership integrations: enable policy per eligible key and enter allowed Discord role IDs per game | IDs are entered as text; this is not a visual role picker. Read permission does not itself grant website administration. |
| Managed Discord membership roles | Membership settings: categories, recruitment/final/support roles and game-specific settings; operation status/audit | Existing assignment/application workflows drive the queue. Audit refresh is manual; no permission-bypassing force/retry control exists. |
| SSO application registration | System → SSO: application name, website URL, callback URI, create/remove client | Server-wide provider activation, signing keys and issuer remain deployment configuration. |
| Account links | Account settings / existing platform management; verified Steam flow, with late self-declared lookup offered by `/stats` | A self-declared statistics lookup is not proof of Steam ownership or role authority. |
| Rosters, attendance and reviewed results | Existing event/roster/result screens manage authoritative records | Website read exposure is controlled through API grants; web writes for rosters/attendance remain outside the agreed scope. |

Restart reconciliation and duplicate prevention are automatic behavior of managed
panels; they do not need an administrator toggle. On-demand `/stats` sharing is a
separate snapshot with an explicit Discord channel selection.

## Settings gaps and deployment prerequisites

- **New provider source / credential onboarding:** origin, provider server ID,
  credential reference and optional network allowlist currently come from
  `LOGI_GAME_DATA_SOURCES` plus secret environment variables. Logi has no form to
  add a new source or rotate a provider key. Secrets are not displayed by the
  connection view.
- **Per-command controls:** `/stats` and the command registration do not have a
  dedicated Logi UI on/off switch, per-game command switch, default sharing room
  or command-specific role/channel policy editor. Discord's own command access
  controls are separate. The present command defaults to a private response and
  requires explicit sharing.
- **Website event-write policy:** the authenticated dashboard-session policy API
  exists, but there is no settings form binding the SSO application, command key,
  per-game allowed roles and enabled state. See [event commands](event-commands.md).
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
