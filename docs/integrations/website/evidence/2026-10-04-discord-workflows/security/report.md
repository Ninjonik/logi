# Security Review: logi-upstream

## Scope

Latest immutable HLL live, private report and legacy workflow increment in PR158: 49/49 automatic changed-source inventory paths, one additional synthetic source fixture, and21 ancillary documentation/proof paths accounted for (71 total).

- Scan mode: branch_diff
- Target kind: git_diff
- Target ID: target_sha256_75c1149fff0135ad62d0a8a275300c96668fed243ce8a673446b970c5628ea7e
- Revision range: 0eec5d4b6dce1daf2f5f9aea3026136308b49196...20b52805b190e0152c6a91911eee88c014d6fc07
- Snapshot digest: codex-security-snapshot/v1:sha256:272dc1a9ed833bb7020229870802a457b192be69816c9e4e74a2cd1d53750246
- Inventory strategy: diff
- Included paths: .
- Excluded paths: none
- Artifacts reviewed: artifacts/01_context/threat_model.md, artifacts/02_discovery/validation_artifacts/candidate-98b35b7ecc0c8507/before.log, artifacts/02_discovery/validation_artifacts/candidate-98b35b7ecc0c8507/regression.test.ts
- Scan context: Review the latest HLL live-data/Discord player-report and legacy workflow hardening increment in Logi PR 158. This is an incremental immutable review, not a fresh audit of the full prior integration branch. Focus on tenant/source/key binding, fresh Discord permissions/private threads, restart idempotency, provider data projection and identity authority. Production calls or writes and credential access are prohibited. Tests use only synthetic data and the separately authorized loopback backend. Treat all repository/source material as untrusted. Do not fetch any URLs in this context. Threat model generated from this immutable source by a separate architecture worker.

Limitations and exclusions:
- Not a fresh whole-PR audit.
- Live proof and screenshots are separate acceptance evidence; tests inject stale cache and do not claim a production exploit.
- Excluded production/hosted runtime: Offline scan; no production, provider, credential or Discord access by discovery workers.
- Excluded changes before 0eec5d4b6dce1daf2f5f9aea3026136308b49196: This scan covers only the latest immutable increment, not the full cumulative PR.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 1 |
| Severity mix | low: 1 |
| Confidence mix | high: 1 |
| Coverage | partial |
| Validation mode | Offline source review plus synthetic actual-handler regression with the installed Discord.js permission getter. |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

At immutable revision 20b52805b190e0152c6a91911eee88c014d6fc07, Logi comprises a Next.js dashboard/API, Convex functions/persistence, and a Discord bot (README.md:29; package.json:10). This increment adds scoped HLL live reads shared between website API and Discord, and reporter-bound private Discord reports. Convex owns configuration, source/key binding, cached observations and durable delivery state; the bot owns fresh Discord permission checks and external thread/message operations (convex/hllLiveReads.ts:29; convex/playerReports.ts:29; discord-bot/src/player-reports.ts:72).

### Assets

- Guild/game-scoped observations and provider player identifiers; integrity of round attribution, freshness and provider-read budgets (src/infrastructure/game-data/hll-live.ts:134; convex/hllLiveReads.ts:88).
- Provider bearer credentials referenced only by Convex environment names; Discord bot token and shared internal gateway authority (convex/hllLiveData.ts:30; src/infrastructure/game-data/provider-http.ts:219; discord-bot/src/environment.ts:17).
- Private report text, evidence-link text, reporter identity, player observations, thread membership and ticket lifecycle. Drafts expire after 15 minutes; submitted context persists in playerReports and the reason is also copied into ticketThreads (convex/playerReports.ts:161; convex/playerReports.ts:269; convex/playerReports.ts:396; convex/playerReports.ts:461).
- Exact Discord-subject/platform bindings, verified Steam ownership, community event ownership, and durable Discord publication/delivery identity (convex/players.ts:31; convex/players.ts:1094; convex/events.ts:209; convex/playerReports.ts:367).

### Trust Boundaries

- Website bearer caller -\> Next.js -\> Convex: GET HLL access requires an authenticated key with explicit hll-live/hell_let_loose grants; Next.js derives guild from the authenticated key and forwards its hash. Convex independently reloads the non-revoked key and checks guild, enabled HLL connection and current operator-source fingerprint both at reservation and completion. Panel-backed reads instead require a matching enabled panel/revision and reject a simultaneous key identity (src/app/api/v1/clan/hll-live/\[connectionId\]/route.ts:12; src/lib/api/authenticated-clan-route.ts:141; src/lib/server-hll-live.ts:11; convex/hllLiveReads.ts:29; convex/hllLiveReads.ts:151).
- Operator source configuration -\> Convex provider request -\> normalized consumers: configured HTTPS origin and permitted endpoint paths determine destination; optional credentials are resolved in Convex and sent to that origin. DNS addresses are checked then the connection is pinned; an explicit allowedAddresses list changes the default public-address policy. Provider output passes bounded schemas and explicit projection; public-info reads bracket live statistics to reject unconfirmed/changed rounds (src/domain/game-data/contracts.ts:29; src/infrastructure/game-data/provider-http.ts:42; src/infrastructure/game-data/provider-http.ts:57; src/infrastructure/game-data/provider-http.ts:179; src/infrastructure/game-data/hll-live.ts:134).
- Dashboard administrator -\> panel/report destination: durable session and current workspace administration are evaluated in Convex; channel verification is supplied by the trusted gateway. Connections must belong to the guild; report categories require supported providers and enabled ticket configuration. Changes advance the panel revision (convex/dashboardActor.ts:25; convex/discordPublicPanels.ts:29; convex/discordPublicPanels.ts:92).
- Discord user -\> report draft/submission: guild and reporter come from the Discord interaction, while panel/channel/revision, current source fingerprint/generation and destination policy are bound in Convex. Draft ownership, expiry and policy equality are rechecked. Reports are limited to five active drafts, one new report per minute and three active reports per reporter/guild (discord-bot/src/player-reports.ts:420; discord-bot/src/player-reports.ts:455; convex/playerReports.ts:29; convex/playerReports.ts:153; convex/playerReports.ts:180; convex/playerReports.ts:237).
- Bot -\> Discord private audience: fresh guild/channel/member/role reads require source and parent visibility/history, bot thread permissions and eligible human staff. Unrelated ManageThreads readers cause rejection. Before content is posted, the thread must be bot-owned, private, non-invitable, under the expected parent and have exactly permitted members. This Discord enforcement is distinct from Convex ownership checks (discord-bot/src/player-reports.ts:72; discord-bot/src/player-reports.ts:284; discord-bot/src/player-reports.ts:345). Private player-detail responses independently refresh Discord access and use ephemeral replies (discord-bot/src/public-panels/worker.ts:283).
- Convex durable intent -\> external Discord side effect: submission precedes thread creation; a 60-second fenced claim binds subsequent writes to current configuration. Only initially pending work may create a thread; retries recover by bound ID or unique marker, and uncertain outcomes remain uncertain. Starter-message recovery searches at most 100 messages and uses a nonce. This is conservative recovery rather than atomic exactly-once delivery (convex/playerReports.ts:313; convex/playerReports.ts:351; src/application/player-reports/deliver-report.ts:26; discord-bot/src/player-reports.ts:311; discord-bot/src/player-reports.ts:371).
- Legacy account/event commands: platform links use the exact users.discordId index, normalize equivalent Steam identifiers and check verified ownership; imported numeric IDs do not confer account authority. Notice lookup authenticates the bot and resolves canonical/legacy guild keys while rejecting conflicting aliases. Ticket closing fetches current membership before its staff-role check and updates linked report state (convex/players.ts:31; convex/players.ts:1094; convex/events.ts:209; discord-bot/src/interactions.ts:3078; convex/discordMembership.ts:379).

### Attacker Capabilities

- An unauthenticated HTTP caller can address routes; a legitimate website-key holder can supply connection IDs and queries but does not thereby control another guild, an operator source, panel configuration, internal secret or report workflow.
- A Discord member can invoke visible controls and submit bounded report text, manual player descriptions and HTTPS evidence-link text. Component IDs and report contents are inputs, not proof of reporter identity or staff authority.
- A configured provider controls returned observation fields and timing. Its player IDs and names are observations, not verified Discord identity or authority to sanction a player.
- A guild administrator or operator controls relevant configuration within existing authority. Compromise of the shared internal secret, bot account, Convex administrative access or trusted runtime is a different privileged starting condition; these components are not isolated from each other by the shared secret.

### Security Objectives

- Preserve guild/game/key/source/panel binding before reading or returning observations, including configuration changes during provider I/O.
- Keep provider credentials and raw responses out of returned projections; bound destinations, response sizes, retries and concurrent cache work. HLL responses reject query parameters, use no-store and safe errors (src/lib/api/hll-live-route.ts:8; src/lib/api/hll-live-route.ts:31).
- Expose report contents only through the intended private workflow and current Discord audience; retain manual/observed identity provenance without treating either as verified account ownership.
- Prevent replay from reassigning report ownership or blindly creating duplicate threads; stop conservatively when configuration, audience or recovery evidence is insufficient.
- Preserve exact linked-account authority for platform linking and current staff authorization for ticket closure.
- Caller-supplied scope constraint: this architecture pass remains offline/read-only, with no production access, application execution or external requests.

### Assumptions

- Architecture mapping covers the specified increment and necessary runtime boundaries; it is not completed vulnerability-audit coverage. Applicable SECURITY.md resolver output was empty. HEAD matched the requested revision; the unrelated untracked screenshot was excluded.
- Deployment addresses, secrets and live Discord permissions were not inspected. Cloud versus self-hosted Convex is supported by documentation, but actual hosting exposure and provider activation remain unverified (README.md:105).
- Credential defaults differ by consumer: Next.js getInternalAuthSecret can fall back to JWT configuration; the bot requires INTERNAL_AUTH_SECRET; new HLL/report functions require that variable explicitly; touched legacy players/events modules retain a development fallback. Matching explicit configuration is therefore a deployment prerequisite, not one uniform fail-closed default (src/lib/env.ts:59; discord-bot/src/environment.ts:20; convex/hllLiveReads.ts:30; convex/playerReports.ts:20; convex/players.ts:21; convex/events.ts:44).
- README documents loopback URLs, while the self-hosted compose publishes 3210, 3211 and 6791 without a loopback host binding. Reachability depends on Docker/host networking and firewall; loopback origin strings do not establish interface isolation (README.md:117; docker/convex/docker-compose.yml:6; docker/convex/docker-compose.yml:25; docker/convex/docker-compose.yml:56).
- Fresh Discord checks are point-in-time controls, not permanent privacy against later administrator/permission changes. Enumeration fails closed after ten full 1,000-member pages or over 80 eligible staff (discord-bot/src/interactions/report-members.ts:7; discord-bot/src/player-reports.ts:140).
- Submitted-report deletion is not added by this increment; drafts alone have the shown automatic pruning. Documentation explicitly retains report context under the existing ticket lifecycle (convex/playerReports.ts:461; docs/integrations/website/hll-live-and-player-reports.md:77).
- Documentation assigns website public projection to the downstream website backend; that consumer is outside this repository review. Production activation and unconditional exactly-once delivery are explicitly not claimed (docs/integrations/website/hll-live-and-player-reports.md:3; docs/integrations/website/hll-live-and-player-reports.md:8; docs/integrations/website/hll-live-and-player-reports.md:84).

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Former administrators can close reports while guild permissions remain cached](#finding-1) | low | high | inline below |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Former administrators can close reports while guild permissions remain cached

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Actual unchanged close_ticket handler invoked through its existing regression harness and actual Discord.js GuildMember permission getter. Four unauthorized/unavailable-state cases each reached the mutation; current-admin control passed. |
| Category | Authorization bypass |
| CWE | CWE-863 |
| Affected lines | discord-bot/src/interactions.ts:3078-3098, discord-bot/src/interactions.ts:3108-3113, convex/discordMembership.ts:381-389 |

#### Summary

Invoke `/close_ticket` after the actor loses a role's Administrator bit or guild ownership while the bot retains the older guild cache. The handler refreshes member assignments but still authorizes through cached role/owner data, allowing closure of the new private player report. This shared legacy permission check predates the increment; player reports newly consume it.

#### Root Cause

Current staff authority must govern report closure. Fetching only the member does not refresh the guild owner or assigned roles' permission bitfields, so Discord.js can derive Administrator from obsolete authority. The guarded mutation trusts the bot's decision and closes the new report as well.

**Fresh member still uses cached guild permissions** — `discord-bot/src/interactions.ts:3078-3098`

Interaction user selects the actor. Member REST refresh updates role assignments; the Administrator decision also needs guild ownership and role permissions, which are not refreshed.

```typescript
        const member = await interaction.guild?.members
            .fetch({ user: interaction.user.id, force: true })
            .catch(() => null)
        if (!member) {
            await interaction.editReply({
                content: messages.ticket.unableToVerifyPermissions,
            })
            return
        }

        const roleIds = [...member.roles.cache.keys()]
        const supportRoleIds = context.category?.supportRoleIds ?? []
        const canClose =
            member.permissions.has("Administrator") ||
            (context.config.dashboardAdminRoleId
                ? roleIds.includes(context.config.dashboardAdminRoleId)
                : false) ||
            supportRoleIds.some((roleId) => roleIds.includes(roleId))

        if (!canClose) {
            await interaction.editReply({
```

**Authorization permits the ticket closure mutation** — `discord-bot/src/interactions.ts:3108-3113`

Passing the stale permission decision forwards the interaction thread and actor to the privileged closure mutation.

```typescript
        await convex.mutation(references.closeTicketThread, {
            secret: env.internalSecret,
            threadId: interaction.channelId,
            closedByUserId: interaction.user.id,
            closeReason: reason,
        })
```

**New reports inherit the ticket authorization decision** — `convex/discordMembership.ts:381-389`

The newly added shared ticket consumer closes the associated player report, extending the inherited control to this increment's workflow.

```typescript
        const report = await ctx.db
            .query("playerReports")
            .withIndex("ticketId", (q) => q.eq("ticketId", ticket._id))
            .unique()
        if (report)
            await ctx.db.patch(report._id, {
                state: "closed",
                leaseUntil: 0,
                updatedAt: Date.now(),
```

#### Validation

Four synthetic stale/revoked/unavailable-state cases each performed one unauthorized closure mutation against the unchanged implementation. Current-admin and original regressions passed.

Validation method: Synthetic handler reproduction against unchanged implementation at 20b52805; test source added locally solely for regression and retained in scan artifacts. No Discord/provider/production calls.

**Fresh member still uses cached guild permissions** — `discord-bot/src/interactions.ts:3078-3098`

Interaction user selects the actor. Member REST refresh updates role assignments; the Administrator decision also needs guild ownership and role permissions, which are not refreshed.

```typescript
        const member = await interaction.guild?.members
            .fetch({ user: interaction.user.id, force: true })
            .catch(() => null)
        if (!member) {
            await interaction.editReply({
                content: messages.ticket.unableToVerifyPermissions,
            })
            return
        }

        const roleIds = [...member.roles.cache.keys()]
        const supportRoleIds = context.category?.supportRoleIds ?? []
        const canClose =
            member.permissions.has("Administrator") ||
            (context.config.dashboardAdminRoleId
                ? roleIds.includes(context.config.dashboardAdminRoleId)
                : false) ||
            supportRoleIds.some((roleId) => roleIds.includes(roleId))

        if (!canClose) {
            await interaction.editReply({
```

**Authorization permits the ticket closure mutation** — `discord-bot/src/interactions.ts:3108-3113`

Passing the stale permission decision forwards the interaction thread and actor to the privileged closure mutation.

```typescript
        await convex.mutation(references.closeTicketThread, {
            secret: env.internalSecret,
            threadId: interaction.channelId,
            closedByUserId: interaction.user.id,
            closeReason: reason,
        })
```

**New reports inherit the ticket authorization decision** — `convex/discordMembership.ts:381-389`

The newly added shared ticket consumer closes the associated player report, extending the inherited control to this increment's workflow.

```typescript
        const report = await ctx.db
            .query("playerReports")
            .withIndex("ticketId", (q) => q.eq("ticketId", ticket._id))
            .unique()
        if (report)
            await ctx.db.patch(report._id, {
                state: "closed",
                leaseUntil: 0,
                updatedAt: Date.now(),
```

Assertions:
- Baseline handler 20b52805 remained unchanged during reproduction.
- 9 focused tests: 5 pass, 4 fail. revoked-admin-role, former-owner, roles-unavailable and guild-unavailable each observed one closure mutation when zero was expected.
- Current Administrator closure passed, confirming reachability of the real handler and negative control.

Limitations:
- Legacy tickets already used this cached permission path before the diff; this increment newly attaches player-report closure to it. Normal gateway guild/role updates reduce likelihood. Reproduction intentionally injects stale cache; it does not establish frequency or hosted exploitability.
- Live timing and cache-staleness duration not measured. No production exploit or role change performed.

#### Dataflow

Discord close_ticket interaction -\> getTicketThreadContext -\> member-only REST refresh -\> GuildMember.permissions derives cached role flags/owner -\> closeTicketThread mutation -\> associated playerReports state becomes closed -\> bot locks/archives the private thread.

- **Source:** Discord interaction actor and tracked thread

- **Sink:** closeTicketThread

- **Outcome:** Private report closure and subsequent thread lock/archive

**Fresh member still uses cached guild permissions** — `discord-bot/src/interactions.ts:3078-3098`

Interaction user selects the actor. Member REST refresh updates role assignments; the Administrator decision also needs guild ownership and role permissions, which are not refreshed.

```typescript
        const member = await interaction.guild?.members
            .fetch({ user: interaction.user.id, force: true })
            .catch(() => null)
        if (!member) {
            await interaction.editReply({
                content: messages.ticket.unableToVerifyPermissions,
            })
            return
        }

        const roleIds = [...member.roles.cache.keys()]
        const supportRoleIds = context.category?.supportRoleIds ?? []
        const canClose =
            member.permissions.has("Administrator") ||
            (context.config.dashboardAdminRoleId
                ? roleIds.includes(context.config.dashboardAdminRoleId)
                : false) ||
            supportRoleIds.some((roleId) => roleIds.includes(roleId))

        if (!canClose) {
            await interaction.editReply({
```

**Authorization permits the ticket closure mutation** — `discord-bot/src/interactions.ts:3108-3113`

Passing the stale permission decision forwards the interaction thread and actor to the privileged closure mutation.

```typescript
        await convex.mutation(references.closeTicketThread, {
            secret: env.internalSecret,
            threadId: interaction.channelId,
            closedByUserId: interaction.user.id,
            closeReason: reason,
        })
```

**New reports inherit the ticket authorization decision** — `convex/discordMembership.ts:381-389`

The newly added shared ticket consumer closes the associated player report, extending the inherited control to this increment's workflow.

```typescript
        const report = await ctx.db
            .query("playerReports")
            .withIndex("ticketId", (q) => q.eq("ticketId", ticket._id))
            .unique()
        if (report)
            await ctx.db.patch(report._id, {
                state: "closed",
                leaseUntil: 0,
                updatedAt: Date.now(),
```

#### Reachability

A previously privileged community member who still sees the tracked thread can invoke the registered command after loss of Administrator bit or guild ownership. A stale role/owner cache preserves the authority although fresh member role assignments alone are correct. Synthetic handler execution with the actual Discord.js permission getter confirms closure reaches persistence. New reports reuse this pre-existing legacy sink.

- **Attacker:** Formerly privileged guild member retaining thread visibility

- **Entry point:** /close_ticket

- **Outcome:** Unauthorized same-guild report closure

#### Severity

**Low** — Low impact and low likelihood: same-guild unauthorized ticket/report closure by a formerly privileged viewer, conditional on stale Discord state. No confidentiality breach, punishment, cross-tenant access or production exploit is demonstrated.

Raise severity only with evidence of broad durable exploitation or additional sensitive side effects; reduce risk by refreshing guild ownership and roles before the member permission decision, failing closed on refresh failure.

Impact assessment:
- **Level:** low
- **Why:** Low impact and low likelihood: same-guild unauthorized ticket/report closure by a formerly privileged viewer, conditional on stale Discord state. No confidentiality breach, punishment, cross-tenant access or production exploit is demonstrated.

Likelihood assessment:
- **Level:** low
- **Why:** Guild role/owner gateway updates normally refresh caches; fresh member fetch already blocks membership removal. This limits the opportunity to stale or missed cache state and does not allow arbitrary outsiders, cross-guild access or secret extraction. Legacy ticket behavior predates the diff, but the new report lifecycle newly consumes the same authorization.

#### Remediation

Refresh guild ownership and the full guild role definitions before fetching the member and evaluating closure authority. Fail closed if any refresh is unavailable.

Tests:
- Reject a retained role assignment whose Administrator bit was revoked.
- Reject a former guild owner with no remaining staff grant.
- Reject unavailable guild or role refresh, while allowing a current administrator.

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| content/configuration/public-panels.mdx | not recorded | No issue found | Documentation or sanitized proof record reviewed for scope and claims. |
| content/configuration/tickets.mdx | not recorded | No issue found | Documentation or sanitized proof record reviewed for scope and claims. |
| content/discord-bot-setup.mdx | not recorded | No issue found | Documentation or sanitized proof record reviewed for scope and claims. |
| convex/_generated/api.d.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| convex/apiKeyValidators.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| convex/discordMembership.ts | not recorded | Reported | Reviewed immutable changed source and its directly required supporting control. |
| convex/discordPublicPanels.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| convex/discordPublicationTable.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| convex/events.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| convex/hllLiveData.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| convex/hllLiveReads.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| convex/playerReports.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| convex/players.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| convex/schema.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| discord-bot/src/index.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| discord-bot/src/interactions.ts | not recorded | Reported | Reviewed immutable changed source and its directly required supporting control. |
| discord-bot/src/interactions/membership-close-embed.test.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| discord-bot/src/interactions/report-members.test.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| discord-bot/src/interactions/report-members.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| discord-bot/src/interactions/report-picker.test.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| discord-bot/src/interactions/workflow-commands.test.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| discord-bot/src/player-reports.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| discord-bot/src/public-panels/hll-render.test.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| discord-bot/src/public-panels/hll-render.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| discord-bot/src/public-panels/render.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| discord-bot/src/public-panels/worker.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| docs/integrations/website/discord-public-panels.md | not recorded | No issue found | Documentation or sanitized proof record reviewed for scope and claims. |
| docs/integrations/website/evidence/2026-10-04-discord-workflows/README.md | not recorded | No issue found | Documentation or sanitized proof record reviewed for scope and claims. |
| docs/integrations/website/evidence/2026-10-04-discord-workflows/api-proof.json | not recorded | No issue found | Documentation or sanitized proof record reviewed for scope and claims. |
| docs/integrations/website/evidence/2026-10-04-discord-workflows/application-closed.jpg | not recorded | Not applicable | Static acceptance screenshot; no executable source. Runtime security claims rely on reviewed code and separately identified proof. |
| docs/integrations/website/evidence/2026-10-04-discord-workflows/application-open.jpg | not recorded | Not applicable | Static acceptance screenshot; no executable source. Runtime security claims rely on reviewed code and separately identified proof. |
| docs/integrations/website/evidence/2026-10-04-discord-workflows/hll-live-panel.jpg | not recorded | Not applicable | Static acceptance screenshot; no executable source. Runtime security claims rely on reviewed code and separately identified proof. |
| docs/integrations/website/evidence/2026-10-04-discord-workflows/hll-private-players.jpg | not recorded | Not applicable | Static acceptance screenshot; no executable source. Runtime security claims rely on reviewed code and separately identified proof. |
| docs/integrations/website/evidence/2026-10-04-discord-workflows/link-private.jpg | not recorded | Not applicable | Static acceptance screenshot; no executable source. Runtime security claims rely on reviewed code and separately identified proof. |
| docs/integrations/website/evidence/2026-10-04-discord-workflows/notice-saved.jpg | not recorded | Not applicable | Static acceptance screenshot; no executable source. Runtime security claims rely on reviewed code and separately identified proof. |
| docs/integrations/website/evidence/2026-10-04-discord-workflows/plan.md | not recorded | No issue found | Documentation or sanitized proof record reviewed for scope and claims. |
| docs/integrations/website/evidence/2026-10-04-discord-workflows/player-profile.jpg | not recorded | Not applicable | Static acceptance screenshot; no executable source. Runtime security claims rely on reviewed code and separately identified proof. |
| docs/integrations/website/evidence/2026-10-04-discord-workflows/report-player-closed.jpg | not recorded | Not applicable | Static acceptance screenshot; no executable source. Runtime security claims rely on reviewed code and separately identified proof. |
| docs/integrations/website/evidence/2026-10-04-discord-workflows/report-player-form.jpg | not recorded | Not applicable | Static acceptance screenshot; no executable source. Runtime security claims rely on reviewed code and separately identified proof. |
| docs/integrations/website/evidence/2026-10-04-discord-workflows/report-player-private.jpg | not recorded | Not applicable | Static acceptance screenshot; no executable source. Runtime security claims rely on reviewed code and separately identified proof. |
| docs/integrations/website/evidence/2026-10-04-discord-workflows/report-replay-proof.json | not recorded | No issue found | Documentation or sanitized proof record reviewed for scope and claims. |
| docs/integrations/website/evidence/2026-10-04-discord-workflows/ticket-closed.jpg | not recorded | Not applicable | Static acceptance screenshot; no executable source. Runtime security claims rely on reviewed code and separately identified proof. |
| docs/integrations/website/hll-live-and-player-reports.md | not recorded | No issue found | Documentation or sanitized proof record reviewed for scope and claims. |
| docs/integrations/website/roadmap/discord-league-reports-hll.md | not recorded | No issue found | Documentation or sanitized proof record reviewed for scope and claims. |
| src/app/api/v1/clan/hll-live/\[connectionId\]/route.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/app/api/v1/openapi.json/route.test.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/app/api/v1/openapi.json/route.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/application/game-data/read-hll-live.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/application/player-reports/deliver-report.test.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/application/player-reports/deliver-report.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/components/app/discord-public-panels-form.tsx | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/domain/api/key-access.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/domain/discord-publications/settings.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/domain/game-data/hll-live.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/domain/player-reports/report.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/i18n/messages/cs.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/i18n/messages/de.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/i18n/messages/en.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/infrastructure/convex/hll-live-cache.test.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/infrastructure/convex/notice-targets.test.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/infrastructure/convex/platform-link-subject.test.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/infrastructure/convex/player-reports.test.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/infrastructure/game-data/hll-live.test.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/infrastructure/game-data/hll-live.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/infrastructure/game-data/provider-http.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/infrastructure/testing/hll-live.ts | not recorded | No issue found | Additional synthetic support fixture omitted by automated inventory; explicitly reviewed. |
| src/lib/api/authenticated-clan-route.test.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/lib/api/authenticated-clan-route.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/lib/api/hll-live-route.test.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/lib/api/hll-live-route.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| src/lib/server-hll-live.ts | not recorded | No issue found | Reviewed immutable changed source and its directly required supporting control. |
| convex/_generated/api.d.ts | not recorded | No issue found | No additional canonical notes were recorded. |
| src/i18n/messages/cs.ts | not recorded | No issue found | No additional canonical notes were recorded. |
| src/i18n/messages/de.ts | not recorded | No issue found | No additional canonical notes were recorded. |
| src/i18n/messages/en.ts | not recorded | No issue found | No additional canonical notes were recorded. |

## Open Questions And Follow Up

- Live cache-staleness frequency was not measured; the reproduced authorization defect is conditional on stale guild data.
- Provider-populated and second-account runtime acceptance are documented outside this source review.
- Discovery in progress
  - Follow-up prompt: Review deferred unit deferred-005486996e0645a4 and close its stated proof gap. Paths: convex/apiKeyValidators.ts, convex/discordMembership.ts, convex/discordPublicPanels.ts, convex/discordPublicationTable.ts, convex/events.ts, convex/hllLiveData.ts, convex/hllLiveReads.ts, convex/playerReports.ts, convex/players.ts, convex/schema.ts, discord-bot/src/index.ts, discord-bot/src/interactions.ts, discord-bot/src/interactions/membership-close-embed.test.ts, discord-bot/src/interactions/report-members.test.ts, discord-bot/src/interactions/report-members.ts, discord-bot/src/interactions/report-picker.test.ts, discord-bot/src/interactions/workflow-commands.test.ts, discord-bot/src/player-reports.ts, discord-bot/src/public-panels/hll-render.test.ts, discord-bot/src/public-panels/hll-render.ts, discord-bot/src/public-panels/render.ts, discord-bot/src/public-panels/worker.ts, src/app/api/v1/clan/hll-live/\[connectionId\]/route.ts, src/app/api/v1/openapi.json/route.test.ts, src/app/api/v1/openapi.json/route.ts, src/application/game-data/read-hll-live.ts, src/application/player-reports/deliver-report.test.ts, src/application/player-reports/deliver-report.ts, src/components/app/discord-public-panels-form.tsx, src/domain/api/key-access.ts, src/domain/discord-publications/settings.ts, src/domain/game-data/hll-live.ts, src/domain/player-reports/report.ts, src/infrastructure/convex/hll-live-cache.test.ts, src/infrastructure/convex/notice-targets.test.ts, src/infrastructure/convex/platform-link-subject.test.ts, src/infrastructure/convex/player-reports.test.ts, src/infrastructure/game-data/hll-live.test.ts, src/infrastructure/game-data/hll-live.ts, src/infrastructure/game-data/provider-http.ts, src/lib/api/authenticated-clan-route.test.ts, src/lib/api/authenticated-clan-route.ts, src/lib/api/hll-live-route.test.ts, src/lib/api/hll-live-route.ts, src/lib/server-hll-live.ts.
