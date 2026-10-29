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
            "Closed registration, insufficient signed-in members, duplicate team, stale/unavailable host, or locked fixture.",
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
                        "Private teams, membership counts, registrations, permitted healthy server connections, and fixtures. Invite tokens are returned only to the team owner.",
                },
                ...errors,
            },
        },
        post: {
            summary:
                "Create a basic team, enroll, select hosting, or report a score",
            tags: ["League account"],
            security: [{ dashboardSession: [] }],
            description:
                "Requires the current first-party dashboard session and same-origin CSRF validation. All team/fixture authority is rechecked in Convex. New teams need no Discord guild or bot. A creation UUID is namespaced to the current account and preserves retries. League members join explicitly through an owner-shared invitation; membership grants no management rights. Registration obeys the published league policy and distinct signed-in member minimum. Host selection locks after event links, score reports, or results. Linked hosts must be online with match-history support and a successful observation within 15 minutes, and belong to a clan the caller administers. External hosts never import statistics. Score reports include the ordered participantTeamIds; stale forms and reports are rejected after a pairing/order change. Manual results enter standings only after matching reports by every participating team or organiser approval. No clan/service-key equivalent is provided: existing service grants cannot safely confer personal global-team ownership.",
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
                        "Command accepted; creation may return teamId and league writes may return slug.",
                },
                ...errors,
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
