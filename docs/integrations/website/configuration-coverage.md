# Configuration coverage in PR #158

Source audit: `20b52805b190e0152c6a91911eee88c014d6fc07`, 2026-10-04.
This is a settings inventory, not a claim that every feature is activated in
production or has been exercised through the browser in this acceptance run.
The team catalogue, team request and competition rows follow the
[global teams and competitions design](../../superpowers/specs/2026-10-04-global-teams-and-competitions-design.md).

## Available in Logi UI

| Feature                                                   | Location and controls                                                                                                                                                                                                                              | Qualification                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HLL / Wardogs public server, scoreboard and result panels | Discord settings → Public panels: feature, source, channel, enabled, refresh 30/60/300s, public leaders, private player details, map artwork, Appearance (layout, accent, banner, emoji)                                                           | Channel picker groups categories, supports search and pasted IDs. Publication status and owned-message link are shown. Results require reviewed results; they are not live scores. Appearance is per panel; panels never given one keep their look. Banners must be this workspace's uploads.                                                                                                    |
| Report Player                                             | Public panel → ticket category, or Disabled; Tickets → parent room and support roles                                                                                                                                                               | The chosen category supplies the private destination. Available for CRCON/Warcon server/scoreboard panels, not result announcements.                                                                                                                                                                                                                                                             |
| Wardogs League discovery and cards                        | Settings → Wardogs League: enabled, watched team codes, human-link room, output room, manual URL preview/addition and per-match management                                                                                                         | Empty output collects without publishing. Scan cadence (10/15/30/60 minutes) and detail refresh (5/10/15/30 minutes) are chosen per workspace; the shared index scan follows the fastest enabled workspace.                                                                                                                                                                                      |
| Game servers and API keys                                 | Settings → Game servers: name, game, provider, HTTPS address, provider server ID, API key; test connection; save (enabled only after a passing test); change, test or remove the key; rename; start/stop collection; remove                        | Keys are tested in the Next server and stored AES-256-GCM encrypted in `gameDataCredentials` with the operator keyring (`LOGI_CREDENTIAL_KEYRING`). They are never shown again and are not available through `/api/v1`. Operator catalog entries (`LOGI_GAME_DATA_SOURCES`) appear alongside; their key can be replaced, not removed. See [game-server credentials](game-server-credentials.md). |
| Existing CRCON / Warcon connections                       | Settings → Game servers: enable, disable, refresh view, health, source snapshot and history state                                                                                                                                                  | Only operator-preconfigured sources are available. Refresh reloads the dashboard state; it is not a general forced provider refresh.                                                                                                                                                                                                                                                             |
| Retained Wardogs game history                             | Settings → Game servers: filters, minimum observed player minutes, rankings, faction totals and game details                                                                                                                                       | Collection follows the enabled source. **History retention** keeps games indefinitely by default or for 90/180/365/730 days; expired games are deleted nightly and the history revision advances. There is no separate history-only switch or per-game deletion UI.                                                                                                                              |
| Website read access                                       | Settings → Clan website and sign-in → API key for the website: create/revoke restricted keys, select resources and games                                                                                                                           | Includes explicit HLL live, Warcon, retained history, League, member, roster and statistics grants. Secret keys belong in the website backend.                                                                                                                                                                                                                                                   |
| Membership/role observations for the website              | Settings → Clan website and sign-in → Find out who is a member: enable policy per eligible key and pick allowed Discord roles per game                                                                                                             | Roles are picked by name; saved roles Discord no longer lists stay visible by ID. Read permission does not itself grant website administration.                                                                                                                                                                                                                                                  |
| Managed Discord membership roles                          | Membership settings: applications and a separate role-sync switch, categories (with "skip waiting" per main-member category), recruitment/final/support roles and game-specific settings; operation status/audit                                   | Existing assignment/application workflows drive the queue. Audit refresh is manual; no permission-bypassing force/retry control exists.                                                                                                                                                                                                                                                          |
| SSO application registration                              | Settings → Clan website and sign-in → Single sign-on applications: application name, website URL, callback URI, create/edit/remove client (editing keeps the client ID and secret; dashboard only, no `/api/v1` operation, like create and remove) | Server-wide provider activation, signing keys and issuer remain deployment configuration.                                                                                                                                                                                                                                                                                                        |
| `/stats` command controls                                 | Clan settings → Discord → Player statistics command: command on/off, Hell Let Loose and Wardogs switches, default sharing channel                                                                                                                  | A switched-off command or game answers privately that statistics are unavailable. The default channel is used when the command has no channel option; Share still checks the member's and bot's permissions there. Discord's own command permissions remain separate.                                                                                                                            |
| Website event-write policy                                | Settings → Clan website and sign-in → Create and edit events: registered SSO application, live restricted command key, enabled flag, allowed Discord roles per supported game                                                                      | Saving an enabled policy grants event-command write access for games with roles; disabling removes it. Bearer keys cannot configure policies. Roles are picked by name.                                                                                                                                                                                                                          |
| Global team catalogue                                     | Superadmin → Team catalogue: per-game list, search, archived filter, add/edit (name, short code, logo, description, up to 3 links, linked workspace), archive/restore, merge                                                                       | Global administrators only; HLL and Wardogs. Names are unique per game, archived included. Writes are revision-checked and audited. Merge archives the duplicate and moves its competition entries, fixtures and pending requests; match snapshots stay. Logos are platform-owned.                                                                                                               |
| Team requests moderation                                  | Superadmin → Team requests: one queue across workspaces; approve (proposed fields editable), merge a new-team request into an existing team, reject with a reason                                                                                  | Global administrators only. Each decision queues one Discord DM to the requester in the workspace language, retried with backoff; closed DMs are marked failed without blocking. No `/api/v1` operation (internal moderation, API-parity exception).                                                                                                                                             |
| Workspace teams, requests and match teams                 | Configuration → Teams: read-only catalogue per game, search, new-team and change requests, own requests (status, cancel); match editor → Teams: catalogue pickers, sides, request                                                                  | Workspace administrators cannot edit catalogue teams. At most 20 pending requests; an approved team becomes selectable. Saved matches keep snapshots until **Refresh snapshot**; concluded matches are read-only. Websites read active teams only with the `teams` grant.                                                                                                                        |
| Competitions management                                   | Superadmin → Competitions: competition (name, slug, season, description, published), divisions, team registration per division, fixtures (phase, schedule, score, status, match link)                                                              | Global administrators; see the [Administrator reference](../../../content/administration.mdx). League + playoff format with ECL cap-score standings. Teams come from the game's global catalogue. Unpublished competitions are hidden from public pages and the API.                                                                                                                             |
| Account links                                             | Account settings / existing platform management; verified Steam flow, with late self-declared lookup offered by `/stats`                                                                                                                           | A self-declared statistics lookup is not proof of Steam ownership or role authority.                                                                                                                                                                                                                                                                                                             |
| Rosters, attendance and reviewed results                  | Existing event/roster/result screens manage authoritative records                                                                                                                                                                                  | Website read exposure is controlled through API grants; web writes for rosters/attendance remain outside the agreed scope.                                                                                                                                                                                                                                                                       |

Restart reconciliation and duplicate prevention are automatic behavior of managed
panels; they do not need an administrator toggle. On-demand `/stats` sharing is a
separate snapshot with an explicit Discord channel selection.

### Image assets

Workspace administrators upload team request logos and panel banners through the
dashboard-session route
`POST /api/servers/{serverId}/image-assets?kind=team-logo|panel-banner`
(same-origin requests with admin access only) and list the workspace's live
assets of one kind with `GET` on the same route. Global administrators upload
catalogue logos into the platform scope through the same pipeline, which
requires a current superadmin session; an approved request's logo moves from the
requesting workspace to the platform without changing its URL. The route accepts
PNG, JPEG and WebP sources up to 2 MiB and 4096×4096 pixels, checks the declared
content type against the magic number and the decoder, rejects animated WebP and
animated PNG (APNG) sources, reports a source over 4096 pixels on either side as
`bad_dimensions` without decoding its pixels, and stores only a normalized copy:
logos fit inside 512×512 and are published as PNG, banners fit inside 1920×1080
and are published as WebP, with EXIF orientation applied and metadata dropped.
Each attempt counts toward a limit of 10 uploads per 10 minutes per actor and
workspace before any body bytes are read; a limited attempt answers `429` with
`Retry-After` and `{ "error": "upload_limited", "retryAfterMs": … }`. Stored
images are served from the immutable public URL
`/api/image-assets/{publicId}.{png|webp}` with the recorded content type,
`X-Content-Type-Options: nosniff`, a one-year immutable cache header and
`Content-Disposition: inline`; the extension must match the recorded type. The
reservation only counts the attempt; it issues no upload URL. The gateway hands
the normalized bytes to one Convex action (`imageAssets:storeNormalized`) that
checks them again (the kind's output format by magic number, at most 2 MiB),
stores them, derives size and SHA-256 from the stored bytes and records the
asset through an internal mutation that re-checks the current workspace (or,
for the platform scope, global) administrator in its own transaction. When recording is rejected or fails (for
example an invalid public URL from a misconfigured `SITE_URL`, or access revoked
since the reservation), the action deletes exactly the file it just stored, so
no stored upload is left without a record. An hourly Convex job removes recorded
uploads that are still not attached to a team, team request, event or panel 24
hours after they were created; each run pages through every expired asset with a
cursor, so referenced logos and banners never block the uploads behind them, and
it stops when the scan is complete. The route backs the workspace **Teams**
request form (request logos) and the panel **Appearance** editor (banners). No
`/api/v1` operation exposes uploads: that is the permanent API-parity exception
recorded in the
[v0.15 handoff](v0.15/README.md#api-parity-exception-catalogue-writes-logo-uploads-and-team-requests)
and in [Discord public panels](discord-public-panels.md#api-and-activation).

## Settings gaps and deployment prerequisites

- **Provider keys:** workspaces enter and rotate their own API keys in Logi. The
  operator must activate encryption once (`LOGI_CREDENTIAL_KEYRING` in Convex and
  the Next server) and migrate existing `LOGI_GAME_DATA_<NAME>_TOKEN` variables;
  see the [game-server credentials runbook](game-server-credentials.md#operator-runbook).
- **Per-command controls:** `/stats` has an on/off switch, per-game switches and a
  default sharing room in Clan settings → Discord. There is still no
  command-specific role policy editor; Discord's own command access controls
  remain the place for role restrictions.
- **SSO runtime setup:** the provider opt-in, issuer, signing key and matching
  website deployment configuration cannot be completed solely in Logi UI.
- **Reading human Discord links:** the input room is selectable in Logi, but the
  operator must enable `LOGI_LEAGUE_MESSAGE_CONTENT` and Discord Message Content
  Intent, then restart the bot. Scanning and manual registration work separately.
- **Team catalogue links:** the global per-game catalogue and the match team
  picker are available (see above), but external League/HLL team identities
  cannot be linked to catalogue teams and a slot holds one team (no
  coalitions). Watched League team codes remain separate from the catalogue.
- **Match templates and preset deletion (API parity):** Settings → Match
  templates stores create-form defaults on the clan (`guilds.matchTemplates`,
  written by `matchTemplates:save`; the older `guilds:saveMatchTemplates` keeps
  its arguments for older dashboards). They only pre-fill the dashboard
  new-match flow; stored events, the bot and `/api/v1` event writes never read
  them, so there is deliberately no `/api/v1` operation for them: API clients
  send every event field explicitly. The creation-only event fields a template
  gives (`signupGroupLimits`, `attendanceReminderHours`,
  `createParticipantRoles`, `squadPresetId`) are returned by `/api/v1` event
  reads but are not accepted by `/api/v1` event writes yet; that needs a new
  idempotent mutation beside `publicApi:mutateClanEvent`, whose arguments must
  not change.
- **Match drafts (deliberate API exclusion):** the new-match flow autosaves
  drafts (`events.isDraft`) through `/api/servers/[serverId]/event-drafts`.
  Drafts are dashboard-only work in progress for clan managers: every `/api/v1`
  read (event lists and documents, event/match/result summaries, match by event,
  meta counts) leaves them out and every `/api/v1` write (event updates,
  sign-ups, stratmap event references) treats them as not found. There is
  deliberately no `/api/v1` draft operation; an API client creates the published
  event directly. Squad and topic presets can now be deleted
  in the dashboard, while `/api/v1/clan/squad-presets/{id}` and
  `/api/v1/clan/topic-presets/{id}` still offer create and update only. A v1
  `DELETE` needs a new idempotent Convex mutation beside
  `publicApi:mutateClanPreset` (whose arguments must not change) and is open
  follow-up work.

These gaps are recorded for the next implementation decision; they are not
silently counted as completed settings. Operational credentials/intents still
require administrator setup even if future forms make onboarding easier.

## Source and runtime evidence

Primary UI sources are `src/components/app/discord-public-panels-form.tsx`,
`discord-channel-select.tsx`, `league-tracking-form.tsx`,
`game-data-connections.tsx`, `game-history-panel.tsx`, `api-key-manager.tsx`,
`membership-integration-settings.tsx`, `membership-settings-form.tsx` and
`sso-applications.tsx`. The clan settings section page
(`settings/[section]/page.tsx`) wires each of them, including the public panels form. `/stats` is registered in
`discord-bot/src/interactions.ts`.

The [latest local acceptance](evidence/2026-10-04-discord-workflows/README.md)
includes an actual dashboard save of the HLL public panel and its report-category
selection. That browser proof does not certify every other form in this inventory.
