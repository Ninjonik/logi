# Workspace team directory for HLL and Wardogs

- Date: 2026-10-03
- Status: implemented on `feat/valkyria-integration`; the per-workspace
  ownership model is superseded by the
  [global teams and competitions design](2026-10-04-global-teams-and-competitions-design.md)
  (one global catalogue per game, see the
  [global team catalogue handoff](../../integrations/website/v0.15/README.md));
  the snapshot, logo, website and Discord rules below still apply unless that
  design changes them. Synthetic tests and static checks pass; the runtime
  acceptance under [Verification](#verification-and-delivery-acceptance) is
  pending
- Source baseline: `09567516c919f46e8aa668fda953af5924efcb68`
- Delivery: existing Logi PR #158

Related contracts: [native website event commands](../../integrations/website/event-commands.md),
[League discovery](../../integrations/website/league-discovery.md), and
[current match workflow](../../../content/operations/matches.mdx).

## Outcome and approved scope

An administrator adds an opponent once, with its name, short code and logo,
then selects that team when preparing another match. The directory belongs to
one Logi community workspace and separates Hell Let Loose from Wardogs. An
opponent does not need a Logi account or a registered Discord community.

The user approved this scope:

- Manage a workspace-owned directory through Logi, separated by game.
- Select directory teams in a match and assign match-specific sides/factions.
- Archive teams while preserving historical matches.
- Supply the same team identities and match presentation to the connected web
  application and Discord.
- Prepare stable identities for later Wardogs League and HLL league linking;
  never infer identity from a similar name or short code.

This document specified the behavior that is now implemented. Runtime
acceptance on the isolated Convex instance, in a browser and in the Discord
test channel, and production activation, are not yet claimed.

## Existing behavior and chosen approach

`competitionTeams` currently links a competition to a `guilds` record, and
`competitionFixtures.teamAId/teamBId` are guild IDs. The ECL seed can create
placeholder guilds. That is a competition-registration model, not a reusable
opponent directory.

Native events currently have no structured team identity. Their `participants`
field describes players, so the new field must have a different name. The
Wardogs League reader stores external team names, codes and profile URLs;
those observations are not authoritative local team registrations.

| Approach | Consequence | Decision |
| --- | --- | --- |
| Workspace-owned directory | Admins can add opponents immediately; each workspace controls its data. | Selected by the user. |
| Shared global directory | Requires shared ownership, moderation and cross-community conflict handling. | Outside this scope. |
| Reuse `guilds` for every opponent | Creates fake communities and conflates Discord access with sporting identity. | Rejected. |

Keep existing competitions and guild IDs intact. Add a dedicated directory and
additive native-event references rather than automatically migrating legacy
names or competition records.

## Directory records and lifecycle

Add a `teamDirectory` table with the following logical fields:

| Field | Rule |
| --- | --- |
| `id` | Stable Convex record ID; never a Discord guild ID. |
| `guildId` | Owning workspace's Discord guild ID, resolved and checked on the server. |
| `gameId` | Required: `hell_let_loose` or `wardogs`; immutable after creation. |
| `name` | Trimmed display name, 1–120 characters. |
| `shortCode` | Optional trimmed label, 1–16 characters when supplied. |
| `logoAssetId` | Optional reference to a validated, workspace-owned logo asset. |
| `normalizedName` | NFKC normalization, trimmed/collapsed whitespace and Unicode lowercase; accents remain significant. |
| `archivedAt` | Null for active records; UTC timestamp for archived records. |
| `revision` | Monotonic revision used to reject stale updates. |
| `createdAt`, `updatedAt` | Server-generated UTC timestamps. |
| `createdBy`, `updatedBy` | Server-derived actor identifiers; excluded from website DTOs. |

Reject control characters in labels. Render names as text and escape Discord
formatting/mentions; labels must never become message recipients.

An exact normalized name is unique within `(guildId, gameId)`, including archived
records. A duplicate create returns the existing-record conflict so an admin
can select or restore it. Short codes need not be unique. Similar names are
not merged. HLL and Wardogs may each contain a team called Valkyria with
different logos and IDs.

Commands are create, update, archive and restore. Updates/archive/restore require
the expected revision. Retried create requests reuse an idempotency key and
return the original result; reusing it with a different payload conflicts.
Preserve a bounded audit record of the actor, operation, team ID and revision
without storing image bytes or secrets in the audit payload.

Archive removes a team from new-match selection and the active website
directory. It does not delete records or rewrite existing matches. Restore
returns the same ID. Hard deletion and automatic merging are not provided.

Require that the selected game is enabled in the owning workspace. Index by
workspace, game and archive state for bounded listings, and by
workspace/game/normalized name for transactional duplicate checks. Lists use
cursor pagination (default 50, maximum 100). Use a scoped search index for name
and short-code search; it must not scan all communities. Existing records are not
mass-imported or populated with guessed opponents.

## Logo storage

The admin can upload PNG, JPEG or WebP, with a two-MiB input limit and at most
4096 by 4096 decoded pixels. The server verifies the bytes and dimensions,
rejects unsupported/animated content, and creates a static logo no larger than
512 by 512. SVG and remote-URL ingestion are excluded from this first version.
The normalized image is the only published output; discard source metadata.

Use a team-specific upload flow with current workspace-admin authorization,
bounded request streaming and a limit of ten upload attempts per ten minutes
per actor/workspace. Apply the existing authenticated-route limiter to directory
reads/writes as well. Do not reuse the existing generic
upload URL route as proof of asset ownership or admin access. Recheck access
when an asset is attached to a team. An arbitrary storage ID from another
workspace or an unverified upload must not be attachable.

Store asset ownership and validation state alongside the Convex storage ID.
The asset gets an immutable public image URL suitable for Discord and the
website, with the correct image content type and `nosniff`. Logos are public
presentation assets; uploading one does not grant access to any other data.
Replacing a logo must retain any old asset referenced by a match snapshot.
Maintain indexed asset references for directory records and event snapshots
in the same transactions that change those records. Clean up failed/unattached
uploads after 24 hours, using bounded batches and a transactional ownership/
reference check. Claim an unreferenced asset for deletion before deleting its
blob; an asset claimed for deletion cannot be attached. Never delete referenced
assets.

Without a logo, render short-code/name initials in Logi and the website, and a
plain text team label in Discord. No custom Discord emoji upload is required.

## Team selection in native matches

Add optional `matchTeams` to native event persistence, domain types, validation,
commands and projections. Do not reuse player `participants`, signup groups,
rosters, guild IDs or the legacy two-side result object.

Each assignment has:

- `teamId`: directory record ID.
- `slot`: stable display position, `a`, `b` or `c`.
- `side`: nullable match-specific side/faction.
- `snapshot`: server-produced name, short code, immutable logo asset reference
  and source team revision, captured when the assignment is first saved.

HLL supports slots `a` and `b`, with `Allies`/`Axis` as optional sides. Wardogs
supports slots `a`, `b`, `c`, with `Valkyra`/`Manticore`/`Lonestar` as optional
factions. A match may be saved with zero or incomplete assignments so an
unknown opponent does not prevent preparation. Duplicate slots, duplicate team
IDs, duplicated non-null sides, cross-game teams and cross-workspace teams are
rejected. This version supports one directory team per slot; coalition rosters
are a separate extension.

All lookups and checks happen at the authoritative write boundary. Clients send
team IDs, slot and side only; they cannot supply trusted snapshots. Creation or
replacement requires active directory entries. Editing unrelated match fields
preserves an existing assignment even if that team has since been archived.

Directory renames, logo changes and archive operations never rewrite saved
match snapshots. An explicit replacement of a selected team captures the new
team's presentation. Preserve the snapshot when only its side/slot changes.
An authorized event editor may explicitly refresh a snapshot from an active
directory entry before a match concludes; this action is visible in the match
editor and audit. Concluded
match team assignments/snapshots are immutable in this feature; result
correction continues through the existing reviewed-result workflow.

Omitting `matchTeams` from an update preserves its current value; an explicit
empty array clears it while the event is editable. Existing records without
this field retain existing behavior. Changing an event's game must reject
incompatible team assignments rather than silently relabel them. Trainings
continue to use their existing participant/roster model and cannot accept new
match-team assignments.

Retain the existing event-level `side` meaning. Do not derive or overwrite it
from directory membership, the team name or the order of selected teams.
Team selection does not auto-confirm results, link Steam identities or assign
players to a roster.

## Logi interface

Add **Teams / Týmy** to the workspace navigation, using the existing game
selector. Creation and match selection require one explicit supported game;
an all-games directory view groups the two supported games and does not mix
their pickers. Hell Let Loose: Vietnam is not added to this feature. Provide
an active list with logo, name and short code, search,
pagination and an archived filter. Admin actions are Add, Edit, Archive and
Restore. The create/edit form has name, short code and logo upload/preview.
Labels, validation messages and empty/error states support Czech and English.

Place a **Teams** section in the existing match form. Each slot uses a
keyboard-accessible search picker showing logo, name and code, followed by
its optional side/faction selector. **Add team** opens the same creation form
and selects the created record without losing the unsaved match fields.
Archive badges identify preserved historical selections.

Directory editing requires the current workspace-admin policy. The website's
event editor can read active teams with the new explicit `teams` grant and
choose them under its existing event-write actor policy; that permission does
not confer directory administration.

## Website and Discord integration

Add the explicitly granted `teams` read resource. Provide authenticated
`GET /api/v1/clan/teams?game=...&cursor=...&limit=...` and
`GET /api/v1/clan/teams/{id}?game=...`. The key supplies the workspace boundary;
the caller cannot choose another workspace. Require one supported game and
validate pagination. Legacy broad keys do not automatically acquire this new
resource. Recheck key revocation, workspace and game grants inside Convex.

Return minimized team DTOs: ID, game, name, short code, public logo URL,
revision and updated time. Absent optional values are null. Active directory
lists/detail reads exclude archived entries; native-match snapshots continue
to supply the historical labels and logos.

Existing match/event readers may receive the snapshots of teams selected for
that match. This does not grant access to the full directory or its audit.

Add `teams` to the existing snapshot/reconciliation and integration change-feed
contracts. Create/update/restore emits an upsert; archive emits a remove.
Both collection and delta reads enforce the same grants. Directory changes
do not emit invented match changes. Existing event changes carry updated
`matchTeams` in the native event/match summaries. Publish matching OpenAPI
definitions and consumer fixtures in the same implementation.

Extend existing actor-backed website event commands to accept team IDs, slots,
sides and the explicit pre-conclusion snapshot-refresh action. Preserve current
SSO actor checks, per-game event-write policy, expected event revision and
idempotency semantics. An API key alone is not a writing actor. A consumer that
omits the new fields must not erase saved assignments.

Catalogue CRUD and logo upload remain session-bound administrator operations
in Logi. A bearer-only `/api/v1` catalogue-write/upload API is deliberately
excluded: the approved website scope is read-only for catalogue management,
and existing event-write policy does not authorize directory administration.
Document this safety/lifecycle exception to API parity in the handoff and wiki.

Existing native-match Discord announcements render the stored team labels and
side/faction assignments, preserving their current configured room and durable
message identity. Include team logos in the native match information cards
(at most two for HLL or three for Wardogs), within Discord embed limits. Keep
sign-up components and existing map/banner information intact. Legacy events
without assignments keep the current layout. No new publishing channel or
standalone background publisher is introduced.

The connected website consumes these contracts; this Logi change does not
claim that the separate www repository has deployed its new directory picker
or rendering. Include a concrete consumer handoff for that follow-up.

## Future league linking

The stable directory ID is the local identity anchor. A later league adapter
will map `(workspace, game, provider, providerTeamId)` to that ID, with an
explicit admin decision and validated canonical profile URL. The same local
team can have identities in more than one league/season; a season is not a
new local team identity.

Do not automatically convert current Wardogs League codes/profile labels into
directory teams. Existing League cards and watched-team filters continue to
work independently. Likewise, do not change ECL's existing guild-based schema
or add an unverified HLL league scraper in this delivery. Stable IDs and
separate ownership make those later mappings possible without changing native
match team identity. Actual external linking/import UI is deferred until the
relevant provider contract is selected and verified.

## Architecture, errors and compatibility

- Pure models, normalization, lifecycle and assignment policies belong in
  `src/domain/teams` and the existing event domain.
- Use-cases coordinate directory writes, snapshot resolution and asset
  ownership through ports under `src/application`.
- Convex owns transactions, actor revalidation, indexes, idempotency and
  scoped persistence; HTTP/UI/Discord remain thin adapters.
- Reuse current dashboard sessions/current-admin checks, API key scoping,
  event commands and durable Discord synchronization.
- Fail closed on expired/revoked sessions or grants. Cross-workspace detail
  references return a generic not-found/forbidden result without labels.
- Distinguish invalid input, not found, duplicate name, revision conflict,
  unavailable storage and upload limits. Retain form input on failures.
- Keep schema additions optional on existing events; regenerate Convex
  bindings with tooling. Do not infer missing legacy team assignments.

## Verification and delivery acceptance

Use the authorized isolated local Convex database and Dorfmada test channel.
Production Convex must not be used for fixtures, deployments or test writes.

| Area | Required evidence |
| --- | --- |
| Directory rules | Normalization, same-name retry/concurrency, game/workspace isolation, archive/restore and revision conflict tests. |
| Authorization | Real Convex-handler tests for expired/revoked actor, removed admin access, foreign asset/team IDs and revoked/missing API grants. |
| Assets | Oversized/invalid/unsupported images, MIME mismatch, image-dimension bounds, tenant ownership and preservation of referenced historical logos. |
| Matches | HLL two-slot and WDG three-slot saves, incomplete selection, side/faction checks, no duplicate IDs, old clients preserving assignments, archive/history behavior and concluded-match restrictions. |
| Web contracts | Collection/detail/change-feed parity, pagination, active/archive transitions, OpenAPI schemas and actor-backed event writes with team IDs. |
| Browser | Create/edit/upload/search, add inline without losing the match, save/reopen HLL and WDG fixtures, archived selection and Czech/English rendering. |
| Discord | Actual test-channel native-match cards, preserved interaction components and stable message IDs after edits/restart. |

Run focused tests during implementation, then the complete test suite,
typecheck, relevant formatting, generated-contract checks and production build.
Deploy the final backend revision only to the authorized local instance for
runtime verification. Record exact revisions, screenshots and tested versus
unrun behavior; the prior League test count is not proof for this new feature.

Update the public wiki, API documentation and PR #158 with a visible comment.
Perform the requested final code/security review before claiming the feature
complete. Do not claim hosted SSO, www deployment, production Discord rollout,
external league linking or production activation from local/synthetic proof.
