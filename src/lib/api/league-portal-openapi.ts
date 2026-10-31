import { leagueCommandSchema } from "@/domain/leagues/portal"
import { z } from "zod"
const errors = {
    "400": { description: "Invalid command or query." },
    "401": {
        description:
            "A current personal Logi session is required. Clan API keys do not grant account access.",
    },
    "403": {
        description: "Cross-origin write or missing team/organiser authority.",
    },
    "409": {
        description:
            "Closed registration, insufficient signed-in members, duplicate team, stale/unavailable host, locked fixture, or team/workspace already linked.",
    },
    "503": {
        description:
            "Service unavailable; retry with the same creation idempotency key.",
    },
}
export const leaguePortalPaths = {
    "/me/leagues": {
        get: {
            summary: "Read personal league teams and fixture management",
            tags: ["League account"],
            security: [{ dashboardSession: [] }],
            description:
                "Personal account-session API. The competitionId query optionally includes fixtures for that published competition, restricted to the viewer's teams or a Logi organiser. Invitations and score reports are private and must never be cached or rendered publicly. Clan/service bearer keys and clan SSO tokens cannot grant standalone team ownership.",
            parameters: [
                {
                    name: "competitionId",
                    in: "query",
                    schema: { type: "string", maxLength: 64 },
                },
            ],
            responses: {
                "200": {
                    description:
                        "Private teams, membership counts, registrations, permitted healthy server connections, eligible workspaces (guildId, workspaceId, name, occupied teamId), and fixtures. Teams include accountOwner, linkedGuildId, description, logoAssetId, logoUrl and revision. Registrations include competitionName, competitionSlug and season for published competitions (null for unpublished competitions), so one team's entries in multiple competitions can be listed. Invite tokens are returned only to the team owner.",
                },
                ...errors,
            },
        },
        post: {
            summary:
                "Create, edit or connect a team, enroll, select hosting, or report a score",
            tags: ["League account"],
            security: [{ dashboardSession: [] }],
            description:
                "Requires the current first-party dashboard session and same-origin CSRF validation. All team/fixture authority is rechecked in Convex. New teams need no Discord guild or bot. linkTeam (teamId, guildId) connects an account-owned team to a workspace the same account currently administers. Both authorities are rechecked in the transaction. Each Discord server can link to only one team across games; another link cannot replace it, and an already linked team cannot be moved through this command. Repeating the same link is idempotent. Linking preserves team identity, registrations, fixtures, invitation tokens and memberships. Signed-in clan members and invited players count once each after linking. createAndEnroll accepts competitionId and profile fields without a gameId: the published competition determines the game and registration is attempted immediately. Closed or hidden competitions cannot create teams through this command. An unmet player minimum returns a saved team plus registrationError, without creating a registration. A team may enroll in multiple competitions of the same game; withdrawal only affects the selected competition. createTeam can include guildId to create and connect a team in an administered, unoccupied workspace. updateTeam requires teamId, expectedRevision and the editable profile fields name, shortCode, description and logoAssetId. Account owners and current linked-clan administrators can edit without a bot or organiser review; ordinary players cannot. Names remain unique within each game and avatars are limited to assets uploaded for that team. Game, ownership and clan links cannot be changed through profile editing. Existing match snapshots stay historical. A creation UUID is namespaced to the current account and preserves retries. League members join explicitly through an owner-shared invitation; membership grants no management rights. Registration obeys the published league policy and distinct signed-in member minimum. Host selection locks after event links, score reports, or results. Linked hosts must be online with match-history support and a successful observation within 15 minutes, and belong to a clan the caller administers. External hosts never import statistics. Score reports include the ordered participantTeamIds; stale forms and reports are rejected after a pairing/order change. Manual results enter standings only after matching reports by every participating team or organiser approval. No clan/service-key equivalent is provided: existing service grants cannot safely confer personal global-team ownership.",
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: z.toJSONSchema(leagueCommandSchema, {
                            io: "input",
                            unrepresentable: "any",
                        }),
                    },
                },
            },
            responses: {
                "200": {
                    description:
                        "Command accepted; creation may return teamId and league writes may return slug. createAndEnroll creates the team and attempts registration; registrationError explicitly describes an unmet requirement while the saved team remains available for invitations and a later enrollment. Team edits include competitionSlugs and optional guildId for cache invalidation.",
                },
                ...errors,
            },
        },
    },
    "/me/leagues/teams/{teamId}/logo": {
        post: {
            summary: "Upload a team avatar without a clan workspace or bot",
            tags: ["League account"],
            security: [{ dashboardSession: [] }],
            description:
                "Requires a live personal session and same-origin request. Team ownership or linked-clan administrator access is rechecked before upload and again when recording the stored image. Raw PNG, JPEG or WebP up to 2 MiB; animated or oversized images are rejected and accepted images are normalized to at most 512 by 512. Ten attempts per account and team per ten minutes. Returns an asset DTO; pass its id as logoAssetId in updateTeam to apply it. Assets belong to this team and cannot be attached to another team. Unattached uploads are cleaned up automatically. This personal operation has no clan service-key equivalent.",
            parameters: [
                {
                    name: "teamId",
                    in: "path",
                    required: true,
                    schema: { type: "string", maxLength: 64 },
                },
            ],
            requestBody: {
                required: true,
                content: {
                    "image/png": {
                        schema: { type: "string", format: "binary" },
                    },
                    "image/jpeg": {
                        schema: { type: "string", format: "binary" },
                    },
                    "image/webp": {
                        schema: { type: "string", format: "binary" },
                    },
                },
            },
            responses: {
                "200": {
                    description:
                        "Normalized image asset with id and public url. Save the team profile to attach it.",
                },
                "400": { description: "Invalid or unsupported image." },
                "403": {
                    description:
                        "Cross-origin request or missing current team authority.",
                },
                "413": { description: "Image exceeds 2 MiB." },
                "429": {
                    description:
                        "Upload rate limit; Retry-After gives the retry delay.",
                },
                "503": { description: "Image service unavailable." },
            },
        },
    },
    "/public/leagues": {
        get: {
            summary: "List all published Logi leagues",
            tags: ["Public API — no key required"],
            security: [],
            description:
                "Published league seasons, games, public registration policy and minimum player count, divisions, teams, fixtures and scores. Optional fixture hosting contains only kind and label; server addresses, credentials, invitations and provisional score reports are excluded.",
            responses: {
                "200": {
                    description:
                        "A data array of public competition documents, matching GET /public/competitions/{slug}.",
                },
                "429": { description: "Public rate limit exceeded." },
                "503": { description: "League catalogue unavailable." },
            },
        },
    },
}
