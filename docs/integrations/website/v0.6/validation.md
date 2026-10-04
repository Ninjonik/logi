# Offline validation

The exact final tested revision is pinned in PR #158. No live Convex, Discord,
HLL, WDG or website calls were made. Convex tests use simulated transactional
storage; network responses are fixtures.

Focused command: `node --import tsx --test src/domain/integrations/*.test.ts src/infrastructure/convex/integration-*.test.ts src/infrastructure/webhooks/*.test.ts src/lib/api/integration-route.test.ts src/app/api/v1/openapi.json/route.test.ts`.

Coverage includes lossless revisions, actual writers, scope removals, atomic
detail, grants, expiration, signed HTTP cursors, a 100-delivery burst, tenant
rotation, expired leases, attempt ceilings and Retry-After.

Full tests use synthetic `NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:32199`,
`INTERNAL_AUTH_SECRET=dev-internal-auth-secret`, `DISCORD_BOT_TOKEN` and
`JWT_SECRET`. W2 run: **409 tests, 408 pass, one pre-existing failure** in
`discord-bot/src/message-builders.test.ts:434` (embed-column name ordering),
identical to 0.5. Typecheck passed before the final documentation changes;
final validation is recorded with the complete milestone.

Backend/documentation changes introduce no visual interface or Discord layout;
screenshots are not applicable. Existing collector screenshots remain in 0.5.
