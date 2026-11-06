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
signup eligibility/groups/caps, reminder choices, discussions and temporary
Discord resources are local. Host-controlled match fields are rejected.

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
statistics instead of importing another copy. Each clan retains its own
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
