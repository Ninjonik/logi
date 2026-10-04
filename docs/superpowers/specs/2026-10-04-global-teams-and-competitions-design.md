# Global team catalogue, team requests and competitions

- Date: 2026-10-04
- Status: approved by the owner (decisions below); implemented; runtime
  acceptance pending (website contract in the
  [global team catalogue handoff](../../integrations/website/v0.15/README.md))
- Supersedes: the ownership model of
  [the workspace team directory design](2026-10-03-team-directory-design.md).
  Its snapshot, logo, website and Discord rules still apply unless this
  document changes them.

## Owner decisions

The owner asked for team and tournament management to be global, run by Logi's
global administrators (the superadmins configured in `config/superadmins.json`
and attested by the authenticated web gateway). The following were chosen
explicitly:

| Question | Decision |
| --- | --- |
| Per-workspace team directory | Replaced by one global catalogue. Workspaces only select from it and request additions or changes. |
| Competitions | Move from Logi workspaces (`guilds`, including placeholder "ghost" clans) to global teams. Existing ECL data is converted. |
| Competition scope for global admins | Competitions, seasons, divisions, team registration per division, fixtures, results and standings in the existing league + playoff format. No new formats. |
| Team requests | New-team requests and change requests for an existing team. Global admins can edit a request before approving it or merge it into an existing team. The requester is notified by a Discord DM. |

## Global team catalogue

`teamDirectory` becomes the global catalogue. One record is one sporting team
for one game (`hell_let_loose` or `wardogs`); Hell Let Loose: Vietnam stays out
of scope. A team has a name, optional short code, optional logo, an optional
description (at most 500 characters) and up to three https links. Names are
unique per game after the existing normalization. A team may optionally be
linked to one Logi workspace (`linkedGuildId`), which records that the team is
that clan; linking grants no permissions.

Only global administrators create, edit, archive, restore, link and merge
teams. Every write is revision-checked and audited. Merge archives the source
team, records `mergedIntoTeamId`, and moves its competition registrations,
fixtures and pending requests to the target. Saved match snapshots are never
rewritten; a refresh of a merged team follows the merge pointer.

Legacy workspace-owned records keep their old `guildId` only as provenance.
A one-time internal migration turns them into global records and reports name
collisions for an administrator to merge. No workspace keeps a private team list.

## Team requests

A workspace administrator can submit:

- a **new-team request** with game, name, short code, logo, description, links
  and a note; or
- a **change request** for an existing active team with the proposed fields.

A workspace can have at most 20 pending requests. The requester can cancel a
pending request. A request logo is uploaded in the requesting workspace's
scope and stays referenced by the request while it is pending.

Global administrators see one queue. For each request they can:

- **approve**, optionally editing every proposed field first. A new-team
  request creates the team; a change request applies the fields to the target
  team with its current revision. The logo becomes a platform-owned asset.
- **merge** a new-team request into an existing team of the same game.
- **reject** with a reason (required, at most 500 characters).

Every decision queues one Discord DM to the requester in the requesting
workspace's language, stating the team, the outcome and the reason or the
resulting team. Delivery is retried with backoff and marked sent; a requester
whose DMs are closed is recorded as failed without blocking the decision.
Requests are not exposed through `/api/v1`: they are an internal moderation
workflow (recorded as an API-parity exception).

## Competitions

Global administrators manage competitions for HLL or Wardogs:

- create and edit a competition (name, unique slug, season, description,
  published flag). Unpublished competitions are hidden from public pages and the
  public API. Legacy competitions without the flag stay published.
- create, rename, reorder and delete divisions (delete only when empty).
- register global teams of the same game into a division, move them, mark them
  withdrawn or reinstate them, and remove a registration that has no fixtures.
- create, edit and delete fixtures between two registered teams (phase,
  schedule, score, status), and link a fixture to a native Logi match event.

Standings keep the ECL cap-score rules. Competition records reference global
teams (`competitionTeams.teamId`, `competitionFixtures.sideATeamId` and
`sideBTeamId`). The old guild references become optional legacy fields so that
existing documents stay valid. An idempotent internal migration converts them:
each guild in a competition becomes (or matches) a global team of that game,
linked to the guild when it is a real Logi workspace. The ECL seed creates
global teams instead of placeholder clans.

The public competition pages and `GET /api/v1/public/competitions/{slug}` now
return global team IDs with name, short code and logo URL. This changes the IDs
consumers saw before (guild IDs) and is documented as a breaking change.

## Workspaces, matches, website and Discord

- The workspace **Teams** page becomes a read-only catalogue per game with
  search, plus the workspace's requests and their status.
- The match team picker searches the global catalogue. When a team is
  missing, it offers a request instead of inline creation; a requested team can
  be selected once approved.
- Match assignment rules are unchanged except that any active global team of
  the event's game can be selected.
- `GET /api/v1/clan/teams` lists the global catalogue for one game, still behind
  the explicit `teams` grant. Team changes are fanned out to the change feed of
  every workspace that has an active API key with the `teams` grant; new keys
  bootstrap from the collection as before.
- Discord match cards are unchanged. The bot gains request-decision DMs.

## Non-goals

Bracket or group formats, public team pages, team member rosters, external
League identity linking, and automatic selection of a newly approved team in a
pending match.
