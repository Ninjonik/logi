# Wardogs League implementation and review · October 2, 2026

The reader is implemented in PR #158 with a pure parser, guarded HTTPS fetch,
shared Convex cache, administrator preview and matching website API. See the
[consumer handoff](README.md) and [evidence package](evidence/2026-10-02-league/README.md).

## Verification

| Check | Result |
| --- | --- |
| Anonymous real reference HTML | HTTP 200 text/html; parsed without login, cookies, Team API or executed JavaScript |
| Actual implemented HTTPS adapter | Scheduled fixture #38; three correct team/faction mappings; match and vote-closing timestamps independently parsed |
| Built Next → isolated native Convex → actual League | 16 checks passed: live read, canonical shared cache, input guards, legacy/resource/game/auth denial, revocation, internal-secret and independent Convex scope checks, admin-session parity and OpenAPI |
| Stale runtime and cooldown | After the real five-minute TTL, a synthetic rate-limit result was injected through the local internal finish mutation. HTTP 200 retained the original live snapshot with stale=true; a different ID returned 429 and the same cooldown. This was **not a real provider 429**. |
| Recovery | After cooldown elapsed, the built runtime fetched the real page again, cleared the error/stale flag and advanced fetchedAt. Served OpenAPI version 1.8.0 and its explicit League grant were checked. |
| Browser | EN and CS preview render actual data; 10 October 20:30 Prague is distinct from voting close on 3 October 12:19. Correct teams/factions, map, counts, rules and progress; age advances and stale data remains visible with an explicit warning. |
| Automated tests | **619 passed, 0 failed, 0 skipped**; 27 additional tests cover this increment |
| TypeScript / production build | Both passed using only loopback Convex configuration |
| Changed TS/TSX lint | Zero errors; one pre-existing OpenAPI unused-variable warning |
| Convex codegen | Official local `convex dev --once --typecheck try --codegen enable` passed; generated declarations were not edited manually |
| Dependency lock | Cheerio pinned to 1.2.0; Bun 1.3.9 frozen lockfile check passed. Existing Discord Undici 6 remains nested under Discord consumers. |

The tests include URL/redirect rejection, response byte and time limits,
Retry-After seconds and HTTP dates, HTML missing/reordered sections, duplicate
teams, private-field exclusion, member counts, separate timestamps, lease
coalescing/fencing, key revalidation, rate budget, cache eviction/pruning and
last-valid retention. Database unit tests use a fake transaction adapter; live
HTTP acceptance separately exercises the real isolated Convex runtime.

## Review corrections

- Impossible dates such as 30 February initially normalized to March through
  JavaScript Date. A regression reproduced this; ISO calendar validation now
  returns null instead of inventing a date.
- Losing fields inside an existing map or team card initially escaped the
  section-level drift check. A regression reproduced the overwrite; nested
  field loss now retains the last valid snapshot. Unknown fields are never
  promoted into the public contract.
- Dashboard freshness recalculates every 30 seconds, so an open view does not
  keep displaying a fixed age or remain fresh indefinitely.
- OpenAPI's generic scope annotation loop initially replaced the explicit League
  grant descriptor. The regression now verifies the served document preserves it.

## Evidence limits

Only **Scheduled** has real provider acceptance. A synthetic Completed label
tests the unsupported-state warning and null results; it does not establish
completed-match parsing. No live/no-show/canceled/disputed/placement/result
semantics are claimed. Server passwords and join IDs are excluded.

The browser used a synthetic local session and a fresh database, with no real
Discord operations or production Convex writes. The bot-missing banner in the
screenshots is expected: this preview does not need a Discord bot connection.
This is not hosted OAuth, production deployment, or integration into the separate
Valkyria website. Those adoption/activation steps remain outstanding.

Repository-wide lint was not rerun because existing unrelated errors are already
recorded in earlier checkpoints. The dependency audit still reports the existing
`@xmldom/xmldom` / `speech-rule-engine` advisories in the wiki math dependency
chain; neither is introduced by Cheerio. No unrelated dependency upgrade is
included in this feature.
