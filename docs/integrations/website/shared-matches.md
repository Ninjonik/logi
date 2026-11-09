# Shared matches

A host-owned match can invite other registered Logi clans playing the same game.
Acceptance creates a local external event in the invited clan. Its native event
and minimized event/match summaries expose `hostEventId` and `hostClanName`.
The host owns the schedule, match details, lifecycle, official result and shared
roster structure. Local records are transactional projections, not independent
copies that consumers should edit to change the match.

## Roster writes

Use the existing `PATCH /api/v1/clan/rosters/{id}` with the local roster ID and
local event ID. Each player slot optionally contains `allocatedGuildId` and
`locked`. The host may change either field; an invited clan may fill or clear
only its own unlocked slots, using eligible players from its own clan. The
server checks every changed slot, including draft slots, and rejects changes to
other slots, layout, metadata, allocation, locks or publication. A player cannot
occupy multiple places in the shared match.

For shared rosters, include `expectedUpdatedAt` from the latest roster read.
An outdated revision is rejected; refresh the board before retrying. API writes
retain the existing idempotency contract and validation error envelope.

The host publishes once and every participating clan's roster becomes published
in the same transaction. Discord delivery is independent for each clan and uses
its own configuration. A missing channel or Discord failure does not roll back
publication in Logi or delivery in other clans. Correct the local configuration
and the existing worker retries. Draft rosters remain unavailable to ordinary
members and minimized website roster-summary grants.

## Local settings

`PATCH /api/v1/clan/events/{eventId}/local-settings` accepts an unrestricted clan
key, an `Idempotency-Key`, and the complete local-settings object documented in
OpenAPI. It uses the same command as the dashboard. Channels, local role IDs,
registration opening time (`registrationStart`, before the host deadline),
signup eligibility/groups/caps, reminder choices, discussions and temporary
Discord resources are local. Host-controlled match fields are rejected.

Acceptance opens the five-step event setup before creating the local event.
Match facts and host times are prefilled and read-only. The invited manager
configures local registration opening, eligibility, group selection, reminders,
channels, pings, discussions and Discord resources, then reviews and accepts.
Acceptance saves that configuration and the local event in one transaction.
Leaving setup does not accept the invitation or publish anything. Scheduled
signup/roster publication waits until the local opening time.

Hosts select actual event signup groups for each invitation and may set a
per-group upper bound. An omitted bound means unlimited. Guests select from those
host group IDs; local membership groups and roles are not imported or rewritten.
Native event API reads include `sharedGroups` (the sanitized host catalogue) and
`sharedSignupGroups` (offered group IDs with optional host ceilings). These are
read-only projections; the clan groups API continues to serve local groups.
Local caps may be lower but cannot exceed invitation ceilings; omitting a local
cap inherits its invitation ceiling. These checks also apply to the existing
local-settings API and signup writes. Full groups use the existing reserve-place
behavior. Custom host Discord emoji and role references are stripped in foreign
clans, leaving Unicode emoji or the group's color. Rosters use the full host group
catalogue, including its hierarchy. Legacy invitations inherit the host's offered
groups. Accepted invitations must be revoked before their group offer changes.

Invitation creation, acceptance and revocation intentionally require a live
dashboard manager. They grant or remove cross-workspace access; a bearer service
key cannot make that decision for a manager. This does not change the key's
existing roster or signup capabilities after acceptance.

## Signups, identity and statistics

Signup writes still target the clan's local event. Discord signup displays show
that clan only; the host dashboard's managers can see all participating clans.
Invited clans see the full squad roster and only their own reserve/declined
lists. Main-clan membership takes priority when that clan participates. Otherwise
eligible mercenaries remain selectable by their clans, with one representation
and one slot per person in the shared match.

Only the host can import or confirm results. Linked matches read the host's
statistics instead of importing another copy. HLL and Wardogs imports and corrections schedule performance-history refreshes
for the host and every currently accepted clan. Each clan's charts include only
its own members' statistics, resolve the host's canonical match ID, and link to
its local event. A shared match contributes once per clan/player history; its
statistics are not copied into another match record. Manual performance refresh
uses the same mapping. Dashboard chart reads use the materialized histories
directly so background updates appear on the next page load. Pending and revoked invitations do not receive updates.
These rules also apply to results written through the existing API; no new API
operation is required. Each clan retains its own
attendance scoring and delivery settings. Reminders, participant roles, voice
attendance and debrief membership use the local player audience, preventing
cross-clan duplicate delivery.

Foreign roster identities contain display information, not other clans' private
member notes, platform IDs or account preferences. Dashboard initial data and
live reads retain the host password only for host administrators or eligible
local players on the published roster.

Revocation disables further guest writes and removes its live Discord resources;
its existing local match and roster remain as history. Deleting the host match
uses the existing deletion lifecycle to clean up linked records and Discord
resources in all participating clans.

Generated match images, including the existing v1 image endpoint, keep the local
clan as the main identity. Other accepted clans appear as small partner-logo
badges beside it, with initials for missing logos and an overflow count for
large groups. They do not become additional match opponents.

The dashboard roster creator and editor share the same clan/player projection.
Their picker shows accepted clans under **Allocate to clan**, with small clan
logos on player identities. This is presentation metadata; v1 allocation still
uses the existing `allocatedGuildId` and `locked` fields without a contract change.
