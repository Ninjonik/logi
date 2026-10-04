# Configuration coverage in PR #158

Source audit: `20b52805b190e0152c6a91911eee88c014d6fc07`, 2026-10-04.
This is a settings inventory, not a claim that every feature is activated in
production or has been exercised through the browser in this acceptance run.

## Available in Logi UI

| Feature                                                   | Location and controls                                                                                                                                                                    | Qualification                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HLL / Wardogs public server, scoreboard and result panels | Discord settings → Public panels: feature, source, channel, enabled, refresh 30/60/300s, public leaders, private player details, map artwork, Appearance (layout, accent, banner, emoji) | Channel picker groups categories, supports search and pasted IDs. Publication status and owned-message link are shown. Results require reviewed results; they are not live scores. Appearance is per panel; panels never given one keep their look. Banners must be this workspace's uploads.                    |
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
| Workspace team directory and match teams                  | Configuration → Teams: per-game list, search, Show archived, Add/Edit (name, short code, logo upload/remove), Archive/Restore; match editor → Teams: slot pickers, sides, Add team       | HLL and Wardogs only; Add requires the game to be enabled. Names are unique per game, archived teams included. Saved matches keep team snapshots until **Refresh snapshot**; concluded matches are read-only. Websites read active teams only with the `teams` grant; League team linking is not provided.       |
| Account links                                             | Account settings / existing platform management; verified Steam flow, with late self-declared lookup offered by `/stats`                                                                 | A self-declared statistics lookup is not proof of Steam ownership or role authority.                                                                                                                                                                                                                             |
| Rosters, attendance and reviewed results                  | Existing event/roster/result screens manage authoritative records                                                                                                                        | Website read exposure is controlled through API grants; web writes for rosters/attendance remain outside the agreed scope.                                                                                                                                                                                       |

Restart reconciliation and duplicate prevention are automatic behavior of managed
panels; they do not need an administrator toggle. On-demand `/stats` sharing is a
separate snapshot with an explicit Discord channel selection.

### Image assets

Workspace administrators upload team logos and panel banners through the
dashboard-session route `POST /api/servers/{serverId}/image-assets?kind=team-logo|panel-banner`
(same-origin requests with admin access only) and list the workspace's live
assets of one kind with `GET` on the same route. The route accepts PNG, JPEG
and WebP sources up to 2 MiB and 4096×4096 pixels, checks the declared content
type against the magic number and the decoder, rejects animated WebP and
animated PNG (APNG) sources, reports a source over 4096 pixels on either side
as `bad_dimensions` without decoding its pixels, and stores only a normalized
copy: logos fit inside 512×512 and are published as PNG, banners fit inside
1920×1080 and are published as WebP, with EXIF orientation applied and metadata
dropped. Each attempt counts toward a limit of 10 uploads per 10 minutes per
actor and workspace before any body bytes are read; a limited attempt answers
`429` with `Retry-After` and `{ "error": "upload_limited", "retryAfterMs": … }`.
Stored images are served from the immutable public URL
`/api/image-assets/{publicId}.{png|webp}` with the recorded content type,
`X-Content-Type-Options: nosniff`, a one-year immutable cache header and
`Content-Disposition: inline`; the extension must match the recorded type.
The reservation only counts the attempt; it issues no upload URL. The gateway
hands the normalized bytes to one Convex action (`imageAssets:storeNormalized`)
that checks them again (the kind's output format by magic number, at most
2 MiB), stores them, derives size and SHA-256 from the stored bytes and records
the asset through an internal mutation that re-checks the current workspace
administrator in its own transaction. When recording is rejected or fails (for
example an invalid public URL from a misconfigured `SITE_URL`, or access revoked
since the reservation), the action deletes exactly the file it just stored, so
no stored upload is left without a record. An hourly Convex job removes recorded
uploads that are still not attached to a team, event or panel 24 hours after
they were created; each run pages through every expired asset with a cursor, so
referenced logos and banners never block the uploads behind them, and it stops
when the scan is complete. The route backs the **Teams** form (team logos) and
the panel **Appearance** editor (banners). No `/api/v1` operation exposes
uploads: that is the permanent API-parity exception recorded in the
[v0.15 handoff](v0.15/README.md#api-parity-exception-catalogue-writes-and-logo-uploads)
and in [Discord public panels](discord-public-panels.md#api-and-activation).

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
- **Team catalogue links:** the per-game directory and the match team picker
  are available (see above), but external League/HLL team identities cannot be
  linked to directory teams and a slot holds one team (no coalitions). Watched
  League team codes remain separate from the directory.

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
