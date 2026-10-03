# Public Wardogs League match previews

The dashboard accepts an anonymous public match URL and the scoped website API
returns the same read model. This does not create an event, assign players,
confirm a result, or use the authenticated League Team API.

## Boundaries

- Domain: canonical URL validation, versioned nullable data contract and cache policy.
- Infrastructure: a pure Cheerio HTML parser and a bounded anonymous HTTPS client.
- Application: refresh through cache and fetch ports, preserving the last valid snapshot.
- Convex: shared public cache keyed by match ID, transactional leases, global request
  budget and Retry-After cooldown. Internal-secret and API-key scope checks run
  before and after network work. No private provider or Discord credentials are used.
- Next.js: an administrator preview in System / Imports and GET
  `/api/v1/clan/league-matches?game=wardogs&url=<encoded-match-url>`.
  API keys require explicit `league-matches` and `wardogs` read grants.

## Fetch and freshness

Accept only HTTPS on `wardogsleague.net`, the exact `/matches/{id}` shape, no
credentials, query, fragment or nonstandard port. Validate every redirect and
retain the original match identity. Pin DNS resolution to public addresses;
use a 15-second overall deadline, three redirects and a 2 MiB HTML limit.
Never evaluate scripts, use cookies or execute a browser.

Cache for five minutes; refresh only when requested. A 25-second fenced lease
coalesces concurrent refreshes. A shared budget allows 20 origin requests per
minute. HTTP 429 blocks all match refreshes until Retry-After (60 seconds when
missing/invalid). Failed refreshes preserve the last valid snapshot, with its
original fetchedAt, explicit stale flag, age and error. Keep at most 500 cached
IDs, evicting inactive entries; prune after 14 days without access.

## Parsing and evidence

Use main/header, named sections, scoped datetime elements, dt/dd and team links.
Detailed lineup cards win over the duplicate compact lineup. Never infer roster
size from displayed team membership. Optional missing sections produce null and
warnings. Reject an unrecognizable page; reject a refresh that loses previously
available essential sections, retaining the last valid snapshot as stale.

Only a real Scheduled fixture is currently verified. Keep results null and warn
on unverified match states; do not infer placements from the progress rail or
interpret scoring rules as actual points awarded. Store only allowlisted public
hosting fields; discard passwords, join IDs, scripts, login dialogs and navigation.

Tests cover the captured semantic HTML, section removal/reordering, team/faction
binding, independent match/vote times, unsafe URLs/redirects, bounded transport,
cache cooldown and failure recovery. Live anonymous fetch and local dashboard/API
proof will be recorded separately from synthetic cases and production acceptance.
