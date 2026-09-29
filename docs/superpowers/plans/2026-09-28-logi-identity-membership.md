# Logi Identity and Discord Membership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Keep sensitive provider review/remediation in authorized private coordination.

**Goal:** Supply fresh, revocable Discord membership to the website, make existing
Logi member-management side effects reliable, and separately qualify optional Logi OIDC.

**Architecture:** Discord proves guild presence and roles; Logi owns game assignments
and configured recruitment-role intent; the website owns session and application
authorization. Membership observations cross a narrow server-to-server boundary.
OAuth identity never replaces a fresh authorization decision.

**Tech Stack:** Existing Logi TypeScript/Convex/Discord.js; website Better Auth,
PostgreSQL/Drizzle, Vitest and Playwright. No replacement bot or auth framework.

**Spec:** [Integration design](../../integrations/website/roadmap/design.md),
[research](../../integrations/website/roadmap/research.md), existing website
[authentication contract](https://github.com/ValkyriaWDG/www/blob/9d4fe3c6781019db9c0614377d1a5d85e7098230/docs/integrations/logi/contract.md).

## Global Constraints

- Logi owns operational events, signups, rosters, results and provider observations.
- The website owns CMS, translations, publication consent, sessions, site grants and derived caches.
- Website writes are out of scope until a per-actor command contract is accepted.
- Never send Logi's global bot token, internal Convex secret or provider credentials to the website/browser.
- Preserve opaque identity `(sourceInstanceId, guildId, gameId, resourceKind, externalId)`; never join people by nickname.
- Map route `hll` to website `hell-let-loose` to Logi `hell_let_loose`; map `wardogs` explicitly. Never use `game=all` for a scoped consumer.
- Unknown data is nullable; timeout is not offline, absence is not zero, and telemetry is not a confirmed result.
- No live credentials, deployment, hosted settings changes or Discord actions are part of offline implementation.
- Preserve existing toolchains and inward domain/application dependencies; update API, wiki and locale parity with each feature.

## Review Focus

1. A full sync completes after a departure/role removal: I1 fences the stale snapshot so it cannot resurrect membership.
2. OAuth succeeds while membership refresh fails: I2 allows identity login but grants no stale private/privileged authority.
3. A role's permissions change without a member-update event: I1 invalidates/reconciles affected authorization observations.
4. A queued role operation runs after the staff actor loses authority: I3 cancels it and audits the denial.
5. Two callbacks redeem one code, or logout occurs during an awaited action: I4/I2 reject replay and recheck durable session authority.

### I1 — Trustworthy member observations and scoped lookup

**Owner/dependencies:** Logi; scoped-key foundation. Connect to W2 invalidation
when available; freshness enforcement cannot depend on webhook delivery speed.

**Files:** Create `src/domain/membership/observation.ts`, `observation.test.ts`,
`src/application/membership/read-membership.ts`, `read-membership.test.ts`,
`src/infrastructure/discord/membership.ts`,
`src/lib/server-member-observations.ts`, `convex/memberObservations.ts`,
`src/infrastructure/convex/member-observations.test.ts`,
`src/components/app/membership-integration-settings.tsx`,
`src/app/api/servers/[serverId]/membership-integrations/route.ts`.
Modify `convex/schema.ts`, `convex/discordSync.ts`,
`discord-bot/src/sync/member-access.ts`, `discord-bot/src/index.ts`,
`src/domain/api/key-access.ts`, `convex/publicApi.ts`, the existing HTTP gateway,
OpenAPI/tests, key manager grant labels and EN/CS/DE dictionaries;
document in `content/configuration/members.mdx` and `settings.mdx`.

**Interfaces:**
`MembershipObservation = { guildId, discordUserId, gameId, state: 'present' | 'left' | 'unknown', roleIds, assignment, observedAt, receivedAt, epoch, revision, completeness }`;
`assignment` is nullable `{ type, status }`, separately sourced from Logi;
`completeness` is `verified_member | verified_absent | unavailable`.
`applyObservation(input, expectedFence, repository): Promise<'applied' | 'superseded'>`;
`readMembership(subject: { guildId, discordUserId, gameId }, maxAgeMs, ports): Promise<MembershipObservation>`.
Persist observations/tombstones and fenced reconciliation runs. Store
`membershipIntegrationPolicies` keyed by API key with guild, role IDs per game,
enabled flag and policy version. Role output requires both stored key grants and
this allowlist; missing/disabled policy denies access. Policy management requires
an administrator session and is deliberately unavailable to bearer keys.

- [x] Write tests `slow snapshot cannot undo departure`, `failed full fetch deletes nobody`, `unknown guild is unavailable not departed`, `fresh write time cannot disguise stale observation`, `role deletion invalidates observation`, `wrong guild/game and revoked key denied`, `missing role policy denies access`, and `privileged lookup refreshes after 60 seconds`. Test policy/key revocation while awaiting Discord and a newer member event during REST fetch. Run new domain/use-case/Convex tests and observe failures.
- [x] Implement serialized per-guild observation ingress, durable epoch/revision and CAS-fenced REST/full-sync commits. Preserve departed subjects as tombstones; never turn missing/partial fetches into a complete empty guild. Use existing add/update/remove handlers and add role-change/reconnect reconciliation. Scope and rate-limit refresh work; unavailable Discord does not advance observation time.
- [x] Add `membership-summaries` as an explicit read grant and exact subject lookup under `/api/v1/clan`, plus session-only policy configuration in System. Return no website-admin flag, user secrets, contact data or unconfigured role IDs. Recheck stored key scope and policy version after awaited refresh. Queries may return unavailable; they cannot create website authority. Document the response/error/freshness contract and keep default summary keys unchanged.
- [x] Run focused tests, full suite, typecheck, HTTP/OpenAPI negative tests and task-file lint/format. Simulate bot Gateway/REST events; no real role calls. Capture policy UI screenshots with synthetic data. Publish synthetic same/different-guild, unknown, departed and stale fixtures, then commit `feat(membership): expose fresh scoped Discord observations`.

### I2 — Website membership through Logi, retaining current Discord OAuth

**Owner/dependencies:** Website team; I1. W3 can deliver invalidations, but direct
freshness checks must work without it. Preserve existing local recovery behavior.

**Files (website):** Create
`apps/web/src/modules/access/membership-provider.ts`,
`apps/web/src/modules/integrations/logi/membership.ts`, `membership.test.ts`.
Modify `apps/web/src/modules/access/config.ts`, `membership.ts`, `server.ts`,
`resolve-actor.ts`, `role-mapping.ts`, `apps/web/src/modules/auth/auth.ts`,
`packages/db/src/schema/access.ts` plus generated migration;
extend `apps/web/tests/integration/auth-membership.test.ts`,
`authority-fences.test.ts`, `auth-http.test.ts` and auth E2E coverage.

**Interfaces:**
`MembershipProvider.lookup(subject, maxAgeMs): Promise<MembershipObservation>`
with the I1 wire schema; adapt it to the existing private `MembershipSnapshot`.
`IdentityAuthorityConfig` explicitly maps community/game to source instance/guild,
membership-key reference and role mapping. Preserve provider epoch/revision
separately from PostgreSQL's ephemeral row-version token.

- [ ] Write `identity login succeeds but unavailable membership denies admin`, `write requires at most 60-second observation`, `private read denies after 5 minutes`, `other-game guild role cannot grant access`, `departure survives delayed response`, `old epoch cannot overwrite new source`, and `local MFA recovery works without Discord`. Assert no Logi global bot token is required by the configured Logi provider. Run the named integration tests and observe failures.
- [ ] Inject the provider port into current login/authorization refresh. Keep Discord `identify` OAuth and database sessions. Add explicit source configuration with no implicit role unions across guilds/games and no automatic switching on failure. Reject issuer/subject/game mismatches and roles outside the agreed allowlist. Source changes require an audited migration and cache invalidation.
- [ ] Preserve current session rereads, mapping version checks and transaction authority fences. Translate Logi unknown/stale responses into deny-and-retry behavior for protected actions, not a refreshed role cache. Apply departure invalidation immediately when durably received and disclose the 60-second/5-minute maximum stale windows when events are unavailable.
- [ ] Run `pnpm --filter @valkyria/web exec vitest run --project integration tests/integration/auth-membership.test.ts tests/integration/authority-fences.test.ts tests/integration/auth-http.test.ts`, unit tests, typecheck/lint and `pnpm --filter @valkyria/web exec playwright test e2e/auth.spec.ts`. Capture changed access/error UI, update `docs/security/auth-rbac.md` and the integration contract, then commit `feat(access): consume scoped Logi membership observations`.

### I3 — Reliable managed Discord roles and member lifecycle

**Owner/dependencies:** Logi; I1. Extend existing recruitment/assignment workflows;
do not make every group-role link or legacy import an automatic role writer.

**Files:** Create `src/domain/membership/managed-roles.ts`, `managed-roles.test.ts`,
`src/application/membership/reconcile-managed-roles.ts`,
`reconcile-managed-roles.test.ts`, `convex/memberRoleOperations.ts`,
`discord-bot/src/sync/managed-member-roles.ts` and its test.
Modify `convex/schema.ts`, `convex/discordMembership.ts`,
`discord-bot/src/sync.ts`, `src/components/app/membership-settings-form.tsx`,
`content/configuration/tickets.mdx`, `members.mdx` and relevant dictionaries.

**Interfaces:**
`planManagedRoleChanges(input: { observedRoleIds, desiredManagedRoleIds, allowedManagedRoleIds }): { add: string[], remove: string[] }`;
`reconcileManagedRoles(operationId, ports): Promise<'applied' | 'retry_scheduled' | 'denied' | 'superseded'>`.
An operation persists actor/provenance, guild/game/target, desired-state version,
allowed role set and attempt/result audit; each retry re-resolves authority.

- [x] Write `unmanaged roles preserved`, `pending/recruit/active/mercenary transitions match current policy`, `two game policies do not remove each other's roles`, `bot hierarchy prevents operation`, `actor revoked before execution denies`, `timeout after Discord success retries idempotently`, and `stale desired version is superseded`. Test departures/rejoins and deleted configured roles. Run new domain/use-case/bot tests and observe failures.
- [x] Reuse existing recruitment outcome rules and generate durable desired/applied operations. Define a single owner for each managed role and reject conflicting configuration. Read authoritative state before retry; use a set difference only within the configured managed set. Reconcile after reconnect; never claim a failed side effect succeeded.
- [x] Add operator-visible pending/failed/applied status and sanitized audit with actor, target, reason and outcome. Authority comes from the authenticated Logi staff workflow; client-posted roles/actor names are not proof. Do not expose new role-grant actions to legacy bearer assignment writes. Document this API exclusion until the later delegated-actor command contract exists.
- [x] Run simulated Discord tests, full suite/typecheck and applicable lint/build checks. Capture actual UI/Discord presentation using simulated data; document bot intent/role prerequisites without requesting production changes. Commit `feat(membership): reconcile and audit managed Discord roles`.

### I4 — Private Logi OIDC acceptance and optional website provider

**Owner/dependencies:** Authorized private Logi provider workstream; website owner
for the consumer. This is not a dependency for W1/D2/D3 or existing Discord login.

**Files to inspect in the private provider workspace:** `convex/sso.ts`,
`src/lib/sso.ts`, `src/lib/sso.test.ts`, `src/lib/sso-server.ts`,
`src/app/api/sso/authorize/route.ts`, `token/route.ts`, `userinfo/route.ts`,
`logout/route.ts`, `content/configuration/single-sign-on.mdx`.
Keep offline issuance/lifecycle/HTTP acceptance tests in the authorized private
workspace until remediation/disclosure is coordinated; do not publish unresolved
failure details in this roadmap or the public feature PR.

**Interfaces:** A versioned acceptance record binds exact provider source/deployed
version to issuer, client auth method, algorithms, callback binding, claims,
lifetimes and revocation behavior. Website consumes it through an optional
`apps/web/src/modules/auth/logi-oidc.ts` adapter, with configuration and callback
allowlisting integrated into existing `auth.ts`/`endpoint-policy.ts` only after
acceptance. No implicit replacement of Discord accounts or sessions.

- [ ] Privately rerun a standards-based matrix against current source, including independent RFC 7636 S256 vectors, verifier bounds, missing/downgrade checks, exact redirect/client/issuer binding, wrong nonce/state, code expiry, concurrent single-use redemption, trusted issuance callers, token substitution, revoked application/user/session and userinfo subject consistency. Test all reachable backend issuance paths, not only the Next.js wrapper. Record exact private commands/revisions and failures.
- [ ] Implement only confirmed provider fixes in the authorized private boundary; rerun the failing tests to green, then the full acceptance matrix. Do not weaken consumer validation to pass. Publish only a coordinated, sanitized acceptance contract once ready. Offline acceptance still does not qualify the hosted provider.
- [ ] The website owner adds the maintained OIDC-client adapter behind a disabled flag, separate environment clients, exact canonical callback and verified immutable account linking. Add tests for identity collision, missing claim, callback replay, disabled provider, logout/revocation and cross-game access denial. A valid login does not mint an administrator grant. Keep independent MFA recovery.
- [ ] Require separately authorized hosted/test-client acceptance before activating the flag. Keep each implementation PR focused/private where needed, with exact tested revision and coordinated disclosure. No public issue, provider registration, merge or deployment follows automatically from this planning task.

### I5 — Proof-backed Steam linking for player attribution

**Owner/dependencies:** Logi; existing authenticated Logi account, independent of
I4. D2/D3 may collect unresolved player IDs before this is available.

**Files:** Create `src/domain/identity/platform-link.ts`, `platform-link.test.ts`,
`src/application/identity/verify-platform-link.ts`, `verify-platform-link.test.ts`,
`src/infrastructure/steam/openid-verifier.ts`, its tests,
`convex/platformIdentityLinks.ts`,
`src/app/api/platform-links/steam/start/route.ts`,
`src/app/api/platform-links/steam/callback/route.ts`,
`src/components/app/verified-platform-links.tsx`.
Modify `convex/schema.ts`, `convex/players.ts`, the existing account/platform-link
presentation, localization and `content/configuration/members.mdx`.

**Interfaces:**
`beginSteamLink(actorSession, returnOrigin, ports): Promise<{ redirectUrl }>`;
`verifySteamLink(callbackParameters, actorSession, ports): Promise<VerifiedPlatformLink>`;
`VerifiedPlatformLink = { platform: 'steam', platformId, logiUserId, method: 'steam_openid', verifiedAt, revokedAt }`.
Store pending challenges for ten minutes, bind them to the initiating session
and consume atomically. Active verified `(platform, platformId)` is unique.

- [x] Write tests `manually entered ID remains claimed`, `claimed ID is not proof`, `wrong Steam provider/return URL rejected`, `expired or reused challenge rejected`, `other session cannot complete link`, `concurrent links of same SteamID conflict`, and `unlink invalidates future attribution`. Use signed/invalid synthetic assertion fixtures and an isolated verification transport; no real Steam login.
- [x] Implement a fixed-provider OpenID 2.0 relying-party adapter with server-side assertion verification, replay checks and exact session/return binding. Use a reviewed OpenID 2.0 library, not an OIDC-only client or custom signature implementation; pin its version/license and Node compatibility in the task's evidence before adding the dependency. No dynamic untrusted provider discovery or arbitrary callback URL.
- [x] Keep claimed legacy IDs distinct and preserve existing recruitment behavior; do not bulk verify or merge accounts. Add opt-in link/unlink UI and audit; unresolved attribution stays unresolved on a provider error. Do not claim HLL/WDG license ownership from identity proof. Link management requires the account session and is not available through a clan service key.
- [x] Run domain/use-case/HTTP/unique-constraint tests, typecheck/lint and simulated browser callback/link/unlink verification; capture changed UI. Update data/projection fixtures and consumer notes, then commit `feat(identity): add proof-backed Steam account links`.

## Deferred actor-authorized website commands

Joining events, editing rosters, promoting members and server moderation from the
website form a later command design. Bind the authenticated human and source
session to audience, guild/game, allowed action/target, nonce, short expiry and
idempotency key; Logi verifies and rechecks authority before execution, including
queued work. A service key alone cannot claim an arbitrary actor. Start by linking
to existing Logi workflows; do not enable writes merely to make a button work.

## Evidence and execution boundary

Checked I1/I3 steps have local implementation evidence; unchecked steps describe future work. No live membership, role mutation or OAuth
flow was exercised to create this plan. Read-only research is documented separately.
Website edits belong to its owner; provider-specific security work stays private.
