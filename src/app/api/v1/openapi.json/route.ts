import {
    integrationChangeSchema,
    syncRecordSchema,
    SYNC_RESOURCES,
} from "@/domain/integrations/change"
import {
    clanEventSummarySchema,
    clanMatchSummarySchema,
} from "@/domain/api/event-summaries"
import {
    serverSnapshotSchema,
    integrationHealthSchema,
} from "@/domain/game-data/contracts"
import {
    peopleReadPaths,
    peopleResponseSchemas,
} from "@/lib/api/people-openapi"
import { membershipObservationSchema } from "@/domain/membership/observation"
import { warconEnvelopeSchema } from "@/domain/game-data/warcon-contracts"
import { clanResultSummarySchema } from "@/domain/api/result-summaries"
import { leagueReadSchema } from "@/domain/wardogs-league/contracts"
import { warconQuerySchema } from "@/domain/game-data/warcon-query"
import { API_KEY_READ_RESOURCES } from "@/domain/api/key-access"
import { NextResponse } from "next/server"
import { z } from "zod"

import {
    websiteEventCommandPaths,
    websiteEventCommandSchemas,
} from "@/lib/api/website-event-command-openapi"
import { generatedOpenApiSchemas } from "@/lib/api/generated-openapi-schemas"

const summaryResponseSchemas = {
    LeagueMatchRead: z.toJSONSchema(leagueReadSchema),
    WarconEnvelope: z.toJSONSchema(warconEnvelopeSchema),
    WarconQuery: z.toJSONSchema(warconQuerySchema),
    MembershipObservation: z.toJSONSchema(membershipObservationSchema),
    IntegrationChange: z.toJSONSchema(integrationChangeSchema),
    IntegrationSyncRecord: z.toJSONSchema(syncRecordSchema),
    ClanServerSnapshotsDocument: z.toJSONSchema(serverSnapshotSchema),
    ClanIntegrationHealthDocument: z.toJSONSchema(integrationHealthSchema),
    ClanEventSummariesDocument: z.toJSONSchema(clanEventSummarySchema),
    ClanMatchSummariesDocument: z.toJSONSchema(clanMatchSummarySchema),
    ClanResultSummariesDocument: z.toJSONSchema(clanResultSummarySchema),
}

const error = {
    type: "object",
    properties: {
        error: {
            type: "object",
            properties: {
                code: { type: "string" },
                message: { type: "string" },
            },
        },
    },
}
const pageParameters = [
    {
        name: "limit",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
    },
    {
        name: "cursor",
        in: "query",
        description:
            "Opaque value returned by the previous page. Reuse it only with the same resource, game scope, and createdAt sort.",
        schema: { type: "string", nullable: true },
    },
    {
        name: "sort",
        in: "query",
        description:
            "Stable creation order used by the opaque cursor. The only supported value is createdAt.",
        schema: { type: "string", enum: ["createdAt"], default: "createdAt" },
    },
]
const gameParameter = {
    name: "game",
    in: "query",
    description:
        "Game scope for game-owned records. Legacy keys may omit it for Hell Let Loose or use game=all. Keys with readAccess require an explicit permitted game or combination and cannot use all. Repeat game (for example game=hell_let_loose&game=wardogs) or use a comma-separated combination.",
    schema: {
        type: "string",
        enum: ["hell_let_loose", "hell_let_loose_vietnam", "wardogs", "all"],
        default: "hell_let_loose",
    },
    style: "form",
    explode: true,
}
const updatedSinceParameter = {
    name: "updatedSince",
    in: "query",
    description:
        "Only records updated at or after this ISO-8601 timestamp, for incremental synchronization.",
    schema: { type: "string", format: "date-time" },
}
const resources = [
    "server-snapshots",
    "integration-health",
    "event-summaries",
    "match-summaries",
    "result-summaries",
    "events",
    "groups",
    "rosters",
    "assignments",
    "calendar-items",
    "stratmaps",
    "topic-presets",
    "squad-presets",
    "matches",
    "articles",
    "users",
]
const resourceTags: Record<string, string> = {
    "server-snapshots": "Clan API — Game data",
    "integration-health": "Clan API — Game data",
    "event-summaries": "Clan API — Events",
    "match-summaries": "Clan API — Matches",
    "result-summaries": "Clan API — Matches",
    events: "Clan API — Events",
    groups: "Clan API — Groups",
    rosters: "Clan API — Rosters",
    assignments: "Clan API — Assignments",
    "calendar-items": "Clan API — Calendar",
    stratmaps: "Clan API — Stratmaps",
    "topic-presets": "Clan API — Topic presets",
    "squad-presets": "Clan API — Squad presets",
    matches: "Clan API — Matches",
    articles: "Clan API — Articles",
    users: "Clan API — Users",
}
const responses = {
    "200": {
        description:
            "Success. List responses use { data, page: { nextCursor, limit } }.",
        headers: {
            "RateLimit-Limit": { schema: { type: "integer", example: 300 } },
            "RateLimit-Remaining": { schema: { type: "integer" } },
            "RateLimit-Reset": {
                description: "Unix timestamp in seconds.",
                schema: { type: "integer" },
            },
        },
    },
    "400": {
        description: "Invalid request",
        content: {
            "application/json": {
                schema: error,
                example: {
                    error: {
                        code: "validation_error",
                        message: "name is required.",
                    },
                },
            },
        },
    },
    "401": {
        description: "Invalid API key",
        content: { "application/json": { schema: error } },
    },
    "403": {
        description:
            "insufficient_scope: the read-only key does not grant this resource, operation or game selection.",
        content: { "application/json": { schema: error } },
    },
    "404": {
        description: "Not found",
        content: { "application/json": { schema: error } },
    },
    "429": {
        description: "Rate limited",
        content: { "application/json": { schema: error } },
    },
}
const { "200": _genericSuccessResponse, ...nonSuccessResponses } = responses
type OpenApiOperation = { responses?: Record<string, unknown> }

function resourceSchemaName(resource: string) {
    return `Clan${resource
        .replace(
            /(^|-)([a-z])/g,
            (_, separator: string, letter: string) =>
                `${separator}${letter.toUpperCase()}`
        )
        .replace(/-/g, "")}Document`
}

function successResponse(resource: string, isList: boolean) {
    const document = {
        $ref: `#/components/schemas/${resourceSchemaName(resource)}`,
    }
    return {
        description: "Success",
        headers: responses["200"].headers,
        content: {
            "application/json": {
                schema: isList
                    ? {
                          type: "object",
                          required: ["data", "page"],
                          properties: {
                              data: { type: "array", items: document },
                              page: {
                                  type: "object",
                                  required: ["nextCursor", "limit"],
                                  properties: {
                                      nextCursor: { type: ["string", "null"] },
                                      limit: { type: "integer" },
                                  },
                              },
                          },
                      }
                    : {
                          type: "object",
                          required: ["data"],
                          properties: { data: document },
                      },
            },
        },
    }
}

function deletedResponse(resource: string) {
    return {
        description: `Deleted ${resource} record`,
        headers: responses["200"].headers,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    required: ["data"],
                    properties: {
                        data: {
                            type: "object",
                            required: ["id", "deleted"],
                            properties: {
                                id: { type: "string" },
                                deleted: { const: true },
                            },
                        },
                    },
                },
            },
        },
    }
}
const paths: Record<string, unknown> = {
    "/public/matches": {
        get: {
            summary: "List public matches",
            tags: ["Public API — no key required"],
            description:
                "Public, rate-limited match feed. No Authorization header is required. Omit game or use game=all for every game; repeat game for a combination.",
            parameters: [
                {
                    ...gameParameter,
                    description:
                        "Optional public game filter. Omit or use game=all for every game; repeat game to select a combination.",
                },
                {
                    name: "cursor",
                    in: "query",
                    schema: { type: "string", nullable: true },
                },
                {
                    name: "limit",
                    in: "query",
                    schema: { type: "integer", minimum: 1, maximum: 100 },
                },
            ],
            responses,
        },
    },
    "/public/matches/{eventId}": {
        get: {
            summary: "Get a public match",
            tags: ["Public API — no key required"],
            description:
                "Public, rate-limited match details. Use collection=playerStats for player statistics.",
            parameters: [
                {
                    name: "eventId",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
            ],
            responses,
        },
    },
    "/public/clans/{clanId}": {
        get: {
            summary: "Get a public clan profile",
            tags: ["Public API — no key required"],
            description:
                "Public, rate-limited clan profile. Use collection=recentMatches for recent matches.",
            parameters: [
                {
                    name: "clanId",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
            ],
            responses,
        },
    },
    "/public/players/{playerId}": {
        get: {
            summary: "Get a public player profile",
            tags: ["Public API — no key required"],
            description:
                "Public, rate-limited player profile. Use collection=clans or collection=recentMatches for related records.",
            parameters: [
                {
                    name: "playerId",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
            ],
            responses,
        },
    },
    "/public/competitions/{slug}": {
        get: {
            summary: "Get a public competition",
            tags: ["Public API — no key required"],
            description:
                "Public, rate-limited competition details. Each competition includes its gameId. Use collection=divisions for divisions.",
            parameters: [
                {
                    name: "slug",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
            ],
            responses,
        },
    },
    "/clan/meta": {
        get: {
            summary:
                "Get authenticated guild identity, enabled games, resource counts, API limits, and server time",
            tags: ["Clan API — Overview"],
            security: [{ clanApiKey: [] }],
            responses,
        },
    },
    "/clan/settings": {
        get: {
            summary:
                "Get authenticated clan and Discord configuration without runtime secrets",
            tags: ["Clan API — Settings"],
            security: [{ clanApiKey: [] }],
            responses,
        },
    },
    "/clan/performance-history": {
        get: {
            summary:
                "Get stored clan performance history (up to ten matches per game)",
            tags: ["Clan API — Matches"],
            security: [{ clanApiKey: [] }],
            parameters: [gameParameter],
            responses,
        },
    },
}
for (const resource of resources) {
    const gameDataDescription = [
        "server-snapshots",
        "integration-health",
    ].includes(resource)
        ? "Stored game-provider observations and sanitized collection health. Requires the matching resource grant and permitted game. No provider calls or controls are performed by these reads. IDs identify Logi connections. Unknown fields are null and zero is preserved. Stale at 180 seconds, unavailable at 900 seconds; errors can make data stale earlier. Freshness can change with time without a new updatedSince record. Live scores and imported sessions are not confirmed results. Source addresses, credentials and player identities are excluded."
        : undefined
    const isGameOwned = [
        "server-snapshots",
        "integration-health",
        "event-summaries",
        "match-summaries",
        "result-summaries",
        "events",
        "groups",
        "rosters",
        "assignments",
        "stratmaps",
        "matches",
    ].includes(resource)
    paths[`/clan/${resource}`] = {
        get: {
            summary: `List clan ${resource}`,
            ...(gameDataDescription
                ? { description: gameDataDescription }
                : {}),
            ...(resource.endsWith("-summaries")
                ? {
                      description:
                          "Allowlisted operational summaries. A separate matching readAccess resource grant is required for restricted keys. Website publication still requires its own approval. Match summaries use event IDs, exclude training events and report imported results as provisional; absent results remain unknown.",
                  }
                : {}),
            ...(resource === "result-summaries"
                ? {
                      description:
                          "Reviewed event-result snapshots with independent result-summaries/game grants. States unknown, provisional, confirmed and corrected. Scores preserve null and zero and support 2-16 factions. Private player/reviewer identities, free-text reasons and source addresses are excluded. Confirmation/correction are account-session-only; bearer writes are unavailable. Publication remains consumer-owned.",
                  }
                : {}),
            tags: [resourceTags[resource]!],
            security: [{ clanApiKey: [] }],
            parameters: [
                ...pageParameters,
                updatedSinceParameter,
                ...(isGameOwned ? [gameParameter] : []),
            ],
            responses,
        },
    }
    const itemPath = [
        "matches",
        "match-summaries",
        "result-summaries",
    ].includes(resource)
        ? `/clan/${resource}/{eventId}`
        : `/clan/${resource}/{id}`
    paths[itemPath] = {
        get: {
            summary: [
                "matches",
                "match-summaries",
                "result-summaries",
            ].includes(resource)
                ? "Get match details for a clan event"
                : `Get a clan ${resource} record`,
            ...(gameDataDescription
                ? { description: gameDataDescription }
                : {}),
            tags: [resourceTags[resource]!],
            security: [{ clanApiKey: [] }],
            parameters: [
                {
                    name: [
                        "matches",
                        "match-summaries",
                        "result-summaries",
                    ].includes(resource)
                        ? "eventId"
                        : "id",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
            ],
            responses,
        },
    }
}

const idempotencyParameter = {
    name: "Idempotency-Key",
    in: "header",
    required: true,
    description:
        "Use one new visible key for each write, for example `event-create-42`. Retrying the identical method, path, and body with that key replays the original status and body for 24 hours. Reusing it with a different request returns `409 idempotency_conflict`; generate a new key for that request.",
    schema: { type: "string", maxLength: 200, example: "event-create-42" },
}
paths["/clan/settings"] = {
    get: (paths["/clan/settings"] as { get: unknown }).get,
    patch: {
        summary: "Patch safe clan and Discord settings",
        tags: ["Clan API — Settings"],
        description:
            "Only supplied fields change. Runtime secrets, player-stat connections, ticket settings, membership settings, and game overrides cannot be set through this endpoint.",
        security: [{ clanApiKey: [] }],
        parameters: [idempotencyParameter],
        responses: {
            ...responses,
            "409": { description: "Idempotency conflict" },
        },
    },
}
paths["/clan/articles"] = {
    get: (paths["/clan/articles"] as { get: unknown }).get,
    post: {
        summary: "Create a clan article",
        tags: ["Clan API — Articles"],
        security: [{ clanApiKey: [] }],
        parameters: [idempotencyParameter],
        responses: {
            ...responses,
            "201": { description: "Created" },
            "409": { description: "Idempotency conflict" },
        },
    },
}
paths["/clan/articles/{id}"] = {
    get: (paths["/clan/articles/{id}"] as { get: unknown }).get,
    patch: {
        summary: "Update a clan article",
        tags: ["Clan API — Articles"],
        security: [{ clanApiKey: [] }],
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
        responses: {
            ...responses,
            "409": { description: "Idempotency conflict" },
        },
    },
    delete: {
        summary: "Delete a clan article",
        tags: ["Clan API — Articles"],
        security: [{ clanApiKey: [] }],
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
        responses: {
            ...responses,
            "409": { description: "Idempotency conflict" },
        },
    },
}

paths["/clan/events/{eventId}/signup"] = {
    post: {
        summary: "Set a clan member's event signup state",
        tags: ["Clan API — Events"],
        description:
            "Uses the same membership and registration rules as the dashboard. A successful change enqueues roster.updated webhooks.",
        security: [{ clanApiKey: [] }],
        parameters: [
            {
                name: "eventId",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        required: ["userId", "group"],
                        properties: {
                            userId: { type: "string" },
                            group: { type: ["string", "null"] },
                        },
                    },
                },
            },
        },
        responses: {
            ...responses,
            "409": { description: "Idempotency conflict" },
        },
    },
}

const eventMutation = {
    tags: ["Clan API — Events"],
    security: [{ clanApiKey: [] }],
    parameters: [idempotencyParameter],
    requestBody: {
        required: true,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    required: [
                        "kind",
                        "name",
                        "registrationEnd",
                        "meetingStart",
                        "pingClan",
                    ],
                    properties: {
                        gameId: gameParameter.schema,
                        kind: { type: "string", enum: ["match", "training"] },
                        name: { type: "string", minLength: 1 },
                        registrationStart: {
                            type: "string",
                            format: "date-time",
                            description:
                                "Optional time to publish Discord registration announcements. Omit for immediate publishing.",
                        },
                        registrationEnd: {
                            type: "string",
                            format: "date-time",
                        },
                        meetingStart: { type: "string", format: "date-time" },
                        gameStart: { type: "string", format: "date-time" },
                        gameEnd: { type: "string", format: "date-time" },
                        pingClan: { type: "boolean" },
                        signupGroupIds: {
                            type: "array",
                            items: { type: "string" },
                        },
                        topicPresetId: { type: "string" },
                        stratmapIds: {
                            type: "array",
                            items: { type: "string" },
                        },
                    },
                },
            },
        },
    },
    responses: {
        ...responses,
        "201": { description: "Created" },
        "409": { description: "Idempotency conflict" },
    },
}
paths["/clan/events"] = {
    get: (paths["/clan/events"] as { get: unknown }).get,
    post: { summary: "Create a clan event", ...eventMutation },
}
paths["/clan/events/{id}"] = {
    get: (paths["/clan/events/{id}"] as { get: unknown }).get,
    patch: { summary: "Update a clan event", ...eventMutation },
}
paths["/clan/events/{eventId}/actions/conclude"] = {
    post: {
        summary: "Conclude a clan event",
        tags: ["Clan API — Events"],
        description:
            "Applies the dashboard-equivalent conclude and roster scoring workflow.",
        security: [{ clanApiKey: [] }],
        parameters: [
            {
                name: "eventId",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
        responses: {
            ...responses,
            "409": { description: "Idempotency conflict" },
        },
    },
}

const groupMutation = {
    tags: ["Clan API — Groups"],
    security: [{ clanApiKey: [] }],
    parameters: [idempotencyParameter],
    requestBody: {
        required: true,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    required: ["name", "color", "order"],
                    properties: {
                        gameId: gameParameter.schema,
                        name: { type: "string" },
                        color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
                        order: { type: "integer" },
                        parentId: { type: "string" },
                        description: { type: "string" },
                        discordRoleId: { type: "string" },
                        discordEmoji: { type: "string" },
                    },
                },
            },
        },
    },
    responses: {
        ...responses,
        "201": { description: "Created" },
        "409": { description: "Idempotency conflict" },
    },
}
paths["/clan/groups"] = {
    get: (paths["/clan/groups"] as { get: unknown }).get,
    post: { summary: "Create a clan group", ...groupMutation },
}
paths["/clan/groups/{id}"] = {
    get: (paths["/clan/groups/{id}"] as { get: unknown }).get,
    patch: {
        summary: "Update a clan group",
        ...groupMutation,
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
    },
    delete: {
        summary: "Delete a clan group and clear its assignment references",
        tags: ["Clan API — Groups"],
        security: [{ clanApiKey: [] }],
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
        responses: {
            ...responses,
            "409": { description: "Idempotency conflict" },
        },
    },
}

const calendarItemMutation = {
    tags: ["Clan API — Calendar"],
    security: [{ clanApiKey: [] }],
    parameters: [idempotencyParameter],
    requestBody: {
        required: true,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    required: ["title", "color", "startAt", "endAt", "allDay"],
                    properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
                        emoji: { type: "string" },
                        label: { type: "string" },
                        startAt: { type: "string", format: "date-time" },
                        endAt: { type: "string", format: "date-time" },
                        allDay: { type: "boolean" },
                        recurrence: {
                            type: "object",
                            properties: {
                                frequency: {
                                    type: "string",
                                    enum: [
                                        "weekly",
                                        "monthly_date",
                                        "monthly_nth_weekday",
                                        "yearly",
                                    ],
                                },
                                interval: { type: "integer", minimum: 1 },
                                until: { type: "string", format: "date-time" },
                            },
                        },
                    },
                },
            },
        },
    },
    responses: {
        ...responses,
        "201": { description: "Created" },
        "409": { description: "Idempotency conflict" },
    },
}
paths["/clan/calendar-items"] = {
    get: (paths["/clan/calendar-items"] as { get: unknown }).get,
    post: { summary: "Create a calendar item", ...calendarItemMutation },
}
paths["/clan/calendar-items/{id}"] = {
    get: (paths["/clan/calendar-items/{id}"] as { get: unknown }).get,
    patch: {
        summary: "Update a calendar item",
        ...calendarItemMutation,
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
    },
    delete: {
        summary: "Delete a calendar item",
        tags: ["Clan API — Calendar"],
        security: [{ clanApiKey: [] }],
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
        responses: {
            ...responses,
            "409": { description: "Idempotency conflict" },
        },
    },
}

const assignmentMutation = {
    tags: ["Clan API — Assignments"],
    security: [{ clanApiKey: [] }],
    parameters: [idempotencyParameter],
    requestBody: {
        required: true,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    required: [
                        "userId",
                        "type",
                        "status",
                        "secondaryGroupIds",
                        "paused",
                    ],
                    properties: {
                        gameId: gameParameter.schema,
                        userId: { type: "string" },
                        type: {
                            type: "string",
                            enum: ["member", "reserve_member", "mercenary"],
                        },
                        status: {
                            type: "string",
                            enum: ["pending", "recruit", "active"],
                        },
                        primaryGroupId: { type: "string" },
                        secondaryGroupIds: {
                            type: "array",
                            items: { type: "string" },
                        },
                        paused: { type: "boolean" },
                        pausedNote: { type: "string" },
                    },
                },
            },
        },
    },
    responses: {
        ...responses,
        "201": { description: "Created" },
        "409": { description: "Idempotency conflict" },
    },
}
paths["/clan/assignments"] = {
    get: (paths["/clan/assignments"] as { get: unknown }).get,
    post: {
        summary:
            "Create a clan assignment and synchronize membership/roster state",
        ...assignmentMutation,
    },
}
paths["/clan/assignments/{id}"] = {
    get: (paths["/clan/assignments/{id}"] as { get: unknown }).get,
    patch: {
        summary:
            "Update a clan assignment without moving it to another user or game",
        ...assignmentMutation,
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
    },
    delete: {
        summary:
            "Delete a clan assignment and synchronize membership/roster state",
        tags: ["Clan API — Assignments"],
        security: [{ clanApiKey: [] }],
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
        responses: {
            ...responses,
            "409": { description: "Idempotency conflict" },
        },
    },
}

const rosterMutation = {
    tags: ["Clan API — Rosters"],
    security: [{ clanApiKey: [] }],
    parameters: [idempotencyParameter],
    requestBody: {
        required: true,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    required: [
                        "eventId",
                        "squads",
                        "reservePlayerIds",
                        "notAttendingPlayerIds",
                        "published",
                    ],
                    properties: {
                        eventId: { type: "string" },
                        squadPresetId: { type: "string" },
                        squads: { type: "array" },
                        reservePlayerIds: {
                            type: "array",
                            items: { type: "string" },
                        },
                        reserveAttendances: { type: "array" },
                        notAttendingPlayerIds: {
                            type: "array",
                            items: { type: "string" },
                        },
                        streamerId: { type: "string" },
                        published: { type: "boolean" },
                    },
                },
            },
        },
    },
    responses: { ...responses, "409": { description: "Idempotency conflict" } },
}
paths["/clan/rosters/{id}"] = {
    get: (paths["/clan/rosters/{id}"] as { get: unknown }).get,
    patch: {
        summary:
            "Update a clan roster using its complete dashboard-equivalent form",
        ...rosterMutation,
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
    },
    delete: {
        summary: "Delete an unpublished clan roster",
        tags: ["Clan API — Rosters"],
        security: [{ clanApiKey: [] }],
        parameters: [
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            idempotencyParameter,
        ],
        responses: {
            ...responses,
            "409": { description: "Idempotency conflict" },
        },
    },
}

const presetMutation = {
    security: [{ clanApiKey: [] }],
    parameters: [idempotencyParameter],
    requestBody: {
        required: true,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    description:
                        "Use the complete dashboard-equivalent preset form. Stratmap eventId references must belong to this clan and use the stratmap's game. Wardogs match map codes use bakurani, ozeti, or zestafona with KOTH as the only mode; its sides are Valkyra, Lonestar, and Manticore.",
                },
            },
        },
    },
    responses: {
        ...responses,
        "201": { description: "Created" },
        "409": { description: "Idempotency conflict" },
    },
}
for (const resource of ["stratmaps", "topic-presets", "squad-presets"]) {
    paths[`/clan/${resource}`] = {
        get: (paths[`/clan/${resource}`] as { get: unknown }).get,
        post: {
            summary: `Create a clan ${resource.slice(0, -1)}`,
            tags: [resourceTags[resource]!],
            ...presetMutation,
        },
    }
    paths[`/clan/${resource}/{id}`] = {
        get: (paths[`/clan/${resource}/{id}`] as { get: unknown }).get,
        patch: {
            summary: `Update a clan ${resource.slice(0, -1)}`,
            tags: [resourceTags[resource]!],
            ...presetMutation,
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
                idempotencyParameter,
            ],
        },
    }
}

// The CRUD read models return Convex documents through apiDocument(). Keep the
// field-level response contract tied to convex/schema.ts and the explicit
// domain DTO schemas rather than a second hand-maintained list in this route.
for (const resource of resources) {
    const collection = paths[`/clan/${resource}`] as {
        get?: OpenApiOperation
    }
    if (collection.get)
        collection.get.responses = {
            ...responses,
            "200": successResponse(resource, true),
        }
    const itemPath = [
        "matches",
        "match-summaries",
        "result-summaries",
    ].includes(resource)
        ? `/clan/${resource}/{eventId}`
        : `/clan/${resource}/{id}`
    const item = paths[itemPath] as { get?: OpenApiOperation }
    if (item.get)
        item.get.responses = {
            ...responses,
            "200": successResponse(resource, false),
        }

    const create = paths[`/clan/${resource}`] as {
        post?: OpenApiOperation
    }
    if (create.post) {
        create.post.responses = {
            ...nonSuccessResponses,
            "201": {
                ...successResponse(resource, false),
                description: `Created ${resource} record`,
            },
        }
    }
    const mutation = paths[itemPath] as {
        patch?: OpenApiOperation
        delete?: OpenApiOperation
    }
    if (mutation.patch)
        mutation.patch.responses = {
            ...responses,
            "200": successResponse(resource, false),
        }
    if (mutation.delete)
        mutation.delete.responses = {
            ...responses,
            "200": deletedResponse(resource),
        }
}

const syncParameters = [
    {
        ...gameParameter,
        required: true,
        description:
            "Exactly one explicit permitted game. No legacy or game=all fallback.",
        schema: {
            type: "string",
            enum: ["hell_let_loose", "hell_let_loose_vietnam", "wardogs"],
        },
    },
]
paths["/clan/changes"] = {
    get: {
        tags: ["Clan API — Synchronization"],
        security: [{ clanApiKey: [] }],
        summary: "Read scoped transactional invalidations",
        description:
            "Requires explicit underlying read grants. First obtain start=now before a baseline sweep, then replay the signed cursor. Keep resources and game fixed. Revisions are canonical decimal strings (compare as integers). Empty pages may have hasMore=true. The cursor remains usable for polling when hasMore=false. Retention is seven days; 410 reset_required requires a new bootstrap. Polling backstops webhook loss. Existing records have revision zero.",
        parameters: [
            ...syncParameters,
            {
                name: "subject",
                in: "query",
                description:
                    "Required exactly once when resources includes membership-summaries; forbidden otherwise. One Discord user ID. Requires an enabled per-key role policy. The signed cursor binds this subject and resets after policy or guild epoch changes; no membership enumeration.",
                schema: { type: "string", pattern: "^[0-9]{17,20}$" },
            },
            {
                name: "resources",
                in: "query",
                required: true,
                description: `Comma-separated subset of ${SYNC_RESOURCES.join(", ")}.`,
                schema: { type: "string" },
            },
            {
                name: "start",
                in: "query",
                schema: { type: "string", enum: ["now"] },
            },
            {
                name: "cursor",
                in: "query",
                description:
                    "Use exactly one of cursor or start=now. Bound to key, guild, game and resources.",
                schema: { type: "string", maxLength: 4096 },
            },
            pageParameters[0],
        ],
        responses: {
            ...responses,
            "410": {
                description: "reset_required: cursor predates retained history",
                content: { "application/json": { schema: error } },
            },
            "200": {
                description:
                    "Filtered change page and next polling/continuation cursor",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["data", "page"],
                            additionalProperties: false,
                            properties: {
                                data: {
                                    type: "array",
                                    items: {
                                        $ref: "#/components/schemas/IntegrationChange",
                                    },
                                },
                                page: {
                                    type: "object",
                                    required: [
                                        "nextCursor",
                                        "hasMore",
                                        "limit",
                                    ],
                                    additionalProperties: false,
                                    properties: {
                                        nextCursor: { type: "string" },
                                        hasMore: { type: "boolean" },
                                        limit: {
                                            type: "integer",
                                            minimum: 1,
                                            maximum: 100,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
}
paths["/clan/sync-records/{resource}/{id}"] = {
    get: {
        tags: ["Clan API — Synchronization"],
        security: [{ clanApiKey: [] }],
        summary: "Atomically read a safe projection and its revision",
        description:
            "Requires an explicit grant for the underlying resource and game. Returns an upsert projection or a retained scoped removal tombstone. Unknown, foreign and expired-tombstone IDs return 404. Dynamic freshness is computed at read time, so consumers must also enforce observedAt age; passage of time does not emit an invalidation.",
        parameters: [
            ...syncParameters,
            {
                name: "resource",
                in: "path",
                required: true,
                schema: { type: "string", enum: [...SYNC_RESOURCES] },
            },
            {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
        ],
        responses: {
            ...responses,
            "200": {
                description: "Atomic projection or tombstone",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["data"],
                            additionalProperties: false,
                            properties: {
                                data: {
                                    $ref: "#/components/schemas/IntegrationSyncRecord",
                                },
                            },
                        },
                    },
                },
            },
        },
    },
}

paths["/clan/membership-summaries/{discordUserId}"] = {
    get: {
        tags: ["Clan API — Membership"],
        security: [{ clanApiKey: [] }],
        summary: "Observe one member with explicit game and role permissions",
        description:
            "Requires an explicit membership-summaries read grant AND enabled per-key role policy configured by a signed-in server administrator. Legacy full-access keys are denied. No collection endpoint exists. Returns only allowlisted role IDs and an independent Logi assignment. Default maximum observation age is 60 seconds (configurable 1–300 seconds); receivedAt does not confer freshness. Stale, unavailable, rate-limited or invalidated observations have state=unknown, completeness=unavailable and no roles. Only Discord Unknown Member proves absence. Direct refresh rechecks stored key and policy after the network wait. Always no-store; consumers must enforce observedAt age at authorization time. This endpoint never grants website privileges. Policy management deliberately has no bearer-key write API.",
        parameters: [
            ...syncParameters,
            {
                name: "discordUserId",
                in: "path",
                required: true,
                schema: { type: "string", pattern: "^[0-9]{17,20}$" },
            },
            {
                name: "maxAgeMs",
                in: "query",
                schema: {
                    type: "integer",
                    minimum: 1000,
                    maximum: 300000,
                    default: 60000,
                },
            },
        ],
        responses: {
            ...responses,
            "503": {
                description:
                    "Membership storage unavailable; deny protected access",
                content: { "application/json": { schema: error } },
            },
            "200": {
                description:
                    "Exact scoped observation; unavailable is an explicit state",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["data"],
                            additionalProperties: false,
                            properties: {
                                data: {
                                    $ref: "#/components/schemas/MembershipObservation",
                                },
                            },
                        },
                    },
                },
            },
        },
    },
}

paths["/clan/league-matches"] = {
    get: {
        tags: ["Clan API — Matches"],
        summary: "Preview a public Wardogs League match URL",
        description:
            "Requires explicit league-matches and wardogs read grants; legacy keys are denied. Reads anonymous server-rendered HTML only, with no Team API key, cookies or browser. URL must be HTTPS wardogsleague.net/matches/{id}, without credentials/query/fragment. Shared cache by match ID for five minutes, 20 origin requests/minute and a shared Retry-After cooldown. Data is public and cached across authorized clans. On refresh failures a last valid snapshot returns HTTP 200 with stale=true, its original fetchedAt, ageSeconds and an error; with no snapshot returns 429 or 503. Consumers should poll no faster than 5–10 minutes and respect nextRefreshAt/Retry-After. Missing values are null. Displayed membership is not a match roster. Only Scheduled HTML has live acceptance evidence; results remain null and unverified states generate warnings. No event/result creation, server passwords, join IDs or authenticated League data. Reads are not emitted in the changes feed. Timestamps use UTC ISO 8601; dashboard renders Europe/Prague. Response is always no-store to consumers.",
        security: [{ clanApiKey: [] }],
        "x-logi-read-access": {
            resource: "league-matches",
            games: ["wardogs"],
            explicitGrantRequired: true,
        },
        parameters: [
            {
                name: "game",
                in: "query",
                required: true,
                schema: { type: "string", enum: ["wardogs"] },
            },
            {
                name: "url",
                in: "query",
                required: true,
                schema: { type: "string", format: "uri", maxLength: 125 },
                description:
                    "Public detail URL; duplicate or unknown parameters are rejected.",
            },
        ],
        responses: {
            "200": {
                description: "Fresh or explicitly stale last-valid match",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["data"],
                            properties: {
                                data: {
                                    $ref: "#/components/schemas/LeagueMatchRead",
                                },
                            },
                        },
                    },
                },
            },
            "400": { description: "Invalid URL or query" },
            "401": { description: "Missing, invalid or revoked API key" },
            "403": { description: "Missing explicit Wardogs League grant" },
            "429": {
                description:
                    "No cached snapshot; shared or upstream rate limit. Retry-After and data.nextRefreshAt apply.",
            },
            "503": {
                description:
                    "No cached snapshot; source or refresh unavailable. Retry metadata is included when known.",
            },
        },
    },
}
paths["/clan/warcon-data/{connectionId}"] = {
    get: {
        tags: ["Clan API — Game data"],
        security: [{ clanApiKey: [] }],
        summary: "Read Warcon gameplay data for one configured connection",
        description:
            "Requires explicit warcon-data and wardogs readAccess grants. Legacy keys are denied. Includes game display names and Steam IDs; never treat these as verified Logi identity or membership. Uses a Logi connection ID from server-snapshots, not the panel UUID or game join code. Only an enabled, matching guild/game/source is readable. Credential provisioning and connection enable/disable are operator/session-only operations. Live includes per-player K/D, cash, ping and separate status/player timestamps and freshness. Closed match detail is null for an unfinished or missing match. Kills exposes configured=false when the upstream feed is disabled; this API never enables it. Career requires a Warcon key restricted to exactly this one server, because upstream career otherwise aggregates its visible organisation. Unknown/admin fields are stripped. Always no-store to consumers. Logi shares a 10-second live cache, 15-second kills cache, 5-minute catalog/capabilities cache and 60-second cache for other views. Provider misses share a 30/minute/connection budget and a lease. Authorization and configuration are rechecked after fetch. On errors return 429/503, never stale data relabeled as live. See WarconQuery for the closed, view-specific parameter combinations: unknown, duplicate and inapplicable parameters are rejected. Warcon reads use polling and are not part of the changes/webhook feed; durable snapshots and reviewed results retain their existing change feed.",
        "x-logi-query-schema": "#/components/schemas/WarconQuery",
        parameters: [
            {
                name: "connectionId",
                in: "path",
                required: true,
                schema: { type: "string" },
            },
            {
                name: "game",
                in: "query",
                required: true,
                schema: { type: "string", const: "wardogs" },
            },
            {
                name: "view",
                in: "query",
                required: true,
                schema: {
                    type: "string",
                    enum: warconQuerySchema.options.map(
                        (option) => option.shape.view.value
                    ),
                },
            },
            {
                name: "range",
                in: "query",
                description:
                    "analytics: 24h (default), 7d, 30d; leaderboard: 7d, 30d (default), 90d, all",
                schema: {
                    type: "string",
                    enum: ["24h", "7d", "30d", "90d", "all"],
                },
            },
            {
                name: "page",
                in: "query",
                description:
                    "matches/leaderboard only; 50 upstream rows per page",
                schema: {
                    type: "integer",
                    minimum: 1,
                    maximum: 100000,
                    default: 1,
                },
            },
            {
                name: "matchId",
                in: "query",
                description: "Required for view=match",
                schema: { type: "string", pattern: "^[1-9][0-9]{0,14}$" },
            },
            {
                name: "steamId",
                in: "query",
                description: "Required for view=career",
                schema: { type: "string", pattern: "^7656119[0-9]{10}$" },
            },
            {
                name: "sort",
                in: "query",
                description:
                    "Leaderboard: kills, deaths, kd, perHour, playtime, seeded, matches, wins, winRate, cash. Players: lastSeen, firstSeen, minutes, sessions, kills, deaths, name.",
                schema: { type: "string" },
            },
            {
                name: "dir",
                in: "query",
                schema: {
                    type: "string",
                    enum: ["asc", "desc"],
                    default: "desc",
                },
            },
            {
                name: "minMinutes",
                in: "query",
                description: "Leaderboard playtime floor",
                schema: {
                    type: "integer",
                    minimum: 0,
                    maximum: 100000,
                    default: 60,
                },
            },
            {
                name: "q",
                in: "query",
                description: "Seen-player name or Steam ID search",
                schema: { type: "string", maxLength: 100 },
            },
            {
                name: "since",
                in: "query",
                description:
                    "Players: last N days, 0=all. Cash: ISO timestamp, defaults to last hour, upstream clamps to 24 hours and newest 3000 samples.",
                schema: {
                    oneOf: [
                        { type: "integer", minimum: 0, maximum: 3650 },
                        { type: "string", format: "date-time" },
                    ],
                },
            },
            {
                name: "offset",
                in: "query",
                description: "Seen players only",
                schema: {
                    type: "integer",
                    minimum: 0,
                    maximum: 1000000,
                    default: 0,
                },
            },
            {
                name: "limit",
                in: "query",
                description: "Seen players: 1–100; kills: 1–200",
                schema: {
                    type: "integer",
                    minimum: 1,
                    maximum: 200,
                    default: 50,
                },
            },
            {
                name: "map",
                in: "query",
                description:
                    "Catalog map ID (for example Kavkazi), NOT the live display name (Bakurani). Required for alternators, optional for experiences.",
                schema: { type: "string", pattern: "^[\\w .-]{1,100}$" },
            },
            {
                name: "before",
                in: "query",
                description: "Kills cursor receipt timestamp",
                schema: { type: "string", format: "date-time" },
            },
            {
                name: "beforeTime",
                in: "query",
                description:
                    "Kills cursor match-clock seconds, requires before",
                schema: { type: "number", minimum: 0 },
            },
            {
                name: "match",
                in: "query",
                description: "Kills match ID filter",
                schema: { type: "string", pattern: "^[1-9][0-9]{0,14}$" },
            },
            ...["player", "killer", "victim"].map((name) => ({
                name,
                in: "query",
                description: "Kills: exact Steam ID or part of name",
                schema: { type: "string", maxLength: 100 },
            })),
            {
                name: "cause",
                in: "query",
                description: "Kills weapon/vehicle tag",
                schema: { type: "string", maxLength: 200 },
            },
            {
                name: "kind",
                in: "query",
                description: "Kills only",
                schema: {
                    type: "string",
                    enum: [
                        "headshot",
                        "teamKill",
                        "suicide",
                        "vehicle",
                        "environment",
                    ],
                },
            },
            {
                name: "minM",
                in: "query",
                description: "Kills minimum distance",
                schema: { type: "integer", minimum: 0, maximum: 100000 },
            },
        ],
        responses: {
            ...responses,
            "200": {
                description:
                    "Validated gameplay data, including provider timestamps",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["data"],
                            properties: {
                                data: {
                                    $ref: "#/components/schemas/WarconEnvelope",
                                },
                            },
                        },
                    },
                },
            },
            "503": {
                description:
                    "Provider or local storage unavailable; fixed error category only",
                content: { "application/json": { schema: error } },
            },
        },
    },
}

// Document every endpoint's effective permission boundary, including legacy-only reads.
Object.assign(paths, peopleReadPaths)
for (const [path, operations] of Object.entries(paths)) {
    if (!path.startsWith("/clan/")) continue
    for (const [method, operation] of Object.entries(
        operations as Record<string, Record<string, unknown>>
    )) {
        const resource = path.split("/")[2]
        if (resource === "league-matches" && method === "get") continue
        operation["x-logi-read-access"] =
            resource === "membership-summaries" && method === "get"
                ? {
                      resource,
                      gameSelection: "one-explicit-game",
                      policy: "enabled-per-key-role-allowlist",
                      subject: "exact-discord-user-id",
                  }
                : method === "get" &&
                    ["changes", "sync-records"].includes(resource)
                  ? {
                        resources: "underlying-explicit-grants",
                        gameSelection: "one-explicit-game",
                    }
                  : method === "get" &&
                      (API_KEY_READ_RESOURCES as readonly string[]).includes(
                          resource
                      )
                    ? {
                          resource,
                          gameSelection: path.includes("{")
                              ? "persisted-record"
                              : "explicit-permitted-games",
                      }
                    : null
    }
}

export async function GET() {
    return NextResponse.json(
        {
            openapi: "3.1.1",
            info: {
                title: "Logi Clan API",
                version: "1.9.0",
                description: `The **Public API — no key required** section contains rate-limited public profiles, matches, and competitions. The **Clan API — API key required** sections contain tenant-scoped dashboard-equivalent data and writes. A clan key can access only its own clan; identifiers from another clan return no data. Game-owned records default to hell_let_loose, including legacy records without gameId. Use game=all for every game, or repeat game (for example game=hell_let_loose&game=wardogs) for an explicit combination. Cursors are opaque and valid only for the resource, game selection, and createdAt ordering that produced them.

### Authenticate and read

For minimized website reads, grant event-summaries and/or match-summaries and use their matching clan endpoints. Each grant is independent of raw events/matches access. Summary DTOs exclude passwords, notes, player identities, source URLs and raw telemetry. They remain private operational content requiring website publication review. Match summaries identify Logi events and expose unknown or provisional results, never automatic confirmation.

Read-only people integrations have three additional independent grants: member-summaries, roster-summaries and player-stat-summaries. Legacy keys do not grant these reads. They expose closed versioned native identity references, published roster/attendance facts and current verified collected-session player facts. Publication consent and fresh role authorization remain separate. Their opaque cursors reset after cross-row identity/source changes; rebuild the entire scope before public display. See the [people integration handoff](https://github.com/Ninjonik/logi/blob/main/docs/integrations/website/v0.14/README.md) for coverage, null metrics, current proof and five-minute reconciliation rules.

Keys with a \`readAccess\` policy can only read their explicitly granted resources and games. Collections require explicit \`game\` values; \`game=all\`, writes, metadata, settings, users, calendar, presets and performance-history return \`403 insufficient_scope\`. Detail reads enforce the persisted record's game and return \`404\` outside it. Revoked keys return \`401\`. Legacy keys without this policy retain their existing access. A manager can issue restricted keys through the session-authenticated \`POST /api/servers/{serverId}/api-keys\` endpoint; bearer keys cannot issue or escalate keys. The System > Website API form defaults to read-only summary resources and requires explicit game selection; full legacy access must be selected separately. See the [read-only integration handoff](https://github.com/Ninjonik/logi/blob/main/docs/integrations/website/v0.4/README.md) for provisioning, compatibility and safe publication rules.


\`curl -H "Authorization: Bearer YOUR_API_KEY" "https://YOUR_LOGI_HOST/api/v1/clan/events?game=wardogs&limit=25&updatedSince=2026-01-01T00:00:00Z"\`

Use \`page.nextCursor\` from that response as \`cursor\` for the next request. Fetch one record with \`GET /clan/events/{id}\`.

### Make retry-safe writes


Send a new \`Idempotency-Key\` for each write, for example \`event-create-42\`. If a timeout occurs, retry the identical method, path, body, and key; Logi replays the original status and body for 24 hours. Changing the request while reusing the key returns \`409 idempotency_conflict\`; use a new key instead. Invalid input returns a \`400\` body shaped as \`{ error: { code, message } }\`.

### Webhooks


Webhook subscriptions are configured by a System administrator in the dashboard's **System** page Webhooks section, rather than through this bearer-key API. Each delivery is an HTTP POST with JSON \`{ id, type, createdAt, guildId, resource }\`, plus \`X-Logi-Event\`, \`X-Logi-Delivery\`, \`X-Logi-Timestamp\`, and \`X-Logi-Signature\` headers. Verify \`X-Logi-Signature\` as \`sha256=<HMAC_SHA256(X-Logi-Timestamp + "." + rawBody, signingSecret)>\` before parsing the raw body, and reject stale timestamps. Network failures, 408, 429, and 5xx responses retry with bounded backoff; other 4xx responses are final. See the [System settings webhook guide](/wiki/configuration/settings#webhooks) for every event's trigger and resource shape.

Article, group, calendar-item, roster, assignment, event, signup, stratmap, and preset write operations are documented below. Event, stratmap, topic-preset, and squad-preset deletion is intentionally unsupported because their dependent roster, match, Discord, and scheduled-job data has no safe deletion lifecycle.`,
            },
            servers: [{ url: "/api/v1" }],
            tags: [
                {
                    name: "Clan API — People",
                    description:
                        "Minimized member, published roster and verified collected-session facts; website remains read-only.",
                },
                {
                    name: "Public API — no key required",
                    description:
                        "Rate-limited public profiles, match data, and competitions. These endpoints never require a bearer key.",
                },
                {
                    name: "Clan API — Overview",
                    description: "Authenticated clan identity and limits.",
                },
                {
                    name: "Clan API — Settings",
                    description: "Safe clan and Discord settings.",
                },
                {
                    name: "Clan API — Articles",
                    description: "Clan knowledge-base articles.",
                },
                {
                    name: "Clan API — Events",
                    description: "Events, conclusion, and signups.",
                },
                {
                    name: "Clan API — Groups",
                    description: "Clan membership groups.",
                },
                {
                    name: "Clan API — Calendar",
                    description: "Manual calendar items.",
                },
                { name: "Clan API — Rosters", description: "Event rosters." },
                {
                    name: "Clan API — Assignments",
                    description: "Clan memberships and roles.",
                },
                {
                    name: "Clan API — Stratmaps",
                    description: "Tactical map presets.",
                },
                {
                    name: "Clan API — Topic presets",
                    description: "Forum topic templates.",
                },
                {
                    name: "Clan API — Squad presets",
                    description: "Roster squad templates.",
                },
                {
                    name: "Clan API — Matches",
                    description: "Stored match results and history.",
                },
                {
                    name: "Clan API — Users",
                    description: "Tenant-scoped member projections.",
                },
            ],
            components: {
                schemas: {
                    ...peopleResponseSchemas,
                    ...generatedOpenApiSchemas,
                    ...summaryResponseSchemas,
                    ...websiteEventCommandSchemas,
                },
                securitySchemes: {
                    clanApiKey: {
                        type: "http",
                        scheme: "bearer",
                        bearerFormat: "logi API key",
                        description:
                            "Send `Authorization: Bearer YOUR_API_KEY`. API keys are scoped to one clan and revoked keys are rejected. Optional readAccess restricts resources and games and forbids generic writes; x-logi-read-access describes each read. Only the separate actor-backed event-commands boundary accepts an explicit writeAccess grant together with an SSO actor token. No readAccess means legacy access to generic routes, never an event-commands grant.",
                    },
                    ssoActorToken: {
                        type: "apiKey",
                        in: "header",
                        name: "X-Logi-Actor-Token",
                        description:
                            "Current opaque SSO access token for this application, subject, central session and guild. Send only from the website backend together with its explicitly permitted service key.",
                    },
                },
            },
            paths: { ...paths, ...websiteEventCommandPaths },
        },
        { headers: { "Cache-Control": "no-store" } }
    )
}
