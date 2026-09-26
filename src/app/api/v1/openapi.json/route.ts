import { NextResponse } from "next/server"

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
    { name: "cursor", in: "query", schema: { type: "string", nullable: true } },
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
    schema: {
        type: "string",
        enum: ["hell_let_loose", "hell_let_loose_vietnam", "wardogs", "all"],
        default: "hell_let_loose",
    },
}
const updatedSinceParameter = {
    name: "updatedSince",
    in: "query",
    description: "Only records updated at or after this ISO-8601 timestamp.",
    schema: { type: "string", format: "date-time" },
}
const resources = [
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
        content: { "application/json": { schema: error } },
    },
    "401": {
        description: "Invalid API key",
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
const paths: Record<string, unknown> = {
    "/clan/meta": {
        get: {
            summary:
                "Get authenticated guild identity, enabled games, resource counts, API limits, and server time",
            security: [{ clanApiKey: [] }],
            responses,
        },
    },
    "/clan/settings": {
        get: {
            summary:
                "Get authenticated clan and Discord configuration without runtime secrets",
            security: [{ clanApiKey: [] }],
            responses,
        },
    },
    "/clan/performance-history": {
        get: {
            summary:
                "Get stored clan performance history (up to ten matches per game)",
            security: [{ clanApiKey: [] }],
            parameters: [gameParameter],
            responses,
        },
    },
}
for (const resource of resources) {
    const isGameOwned = [
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
            security: [{ clanApiKey: [] }],
            parameters: [
                ...pageParameters,
                updatedSinceParameter,
                ...(isGameOwned ? [gameParameter] : []),
            ],
            responses,
        },
    }
    const itemPath =
        resource === "matches"
            ? `/clan/${resource}/{eventId}`
            : `/clan/${resource}/{id}`
    paths[itemPath] = {
        get: {
            summary:
                resource === "matches"
                    ? "Get match details for a clan event"
                    : `Get a clan ${resource} record`,
            security: [{ clanApiKey: [] }],
            parameters: [
                {
                    name: resource === "matches" ? "eventId" : "id",
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
    schema: { type: "string", maxLength: 200 },
}
paths["/clan/settings"] = {
    get: (paths["/clan/settings"] as { get: unknown }).get,
    patch: {
        summary: "Patch safe clan and Discord settings",
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
                        "Use the complete dashboard-equivalent preset form. Stratmap eventId references must belong to this clan and use the stratmap's game.",
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
            ...presetMutation,
        },
    }
    paths[`/clan/${resource}/{id}`] = {
        get: (paths[`/clan/${resource}/{id}`] as { get: unknown }).get,
        patch: {
            summary: `Update a clan ${resource.slice(0, -1)}`,
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

export async function GET() {
    return NextResponse.json(
        {
            openapi: "3.1.1",
            info: {
                title: "Logi Clan API",
                version: "1.0.0",
                description:
                    "Bounded clan-owned data API. Game-owned records default to hell_let_loose, including legacy records without gameId; game=all is the explicit cross-game scope. List cursors are opaque and only valid with their original resource, game and creation-order sort. Article, group, calendar-item, event, event-signup, roster, assignment, stratmap, and preset writes require Idempotency-Key; an identical retry replays the original response for 24 hours and a changed request returns 409. Successful article writes, event create/update actions, event-signup changes, and roster-affecting roster/assignment writes enqueue subscribed webhook events signed as sha256=<HMAC_SHA256(timestamp + '.' + rawBody, secret)> in X-Logi-Signature, with X-Logi-Timestamp in Unix seconds. Webhook deliveries retry transient network, 408, 429, and 5xx failures with bounded backoff; other 4xx responses are final.",
            },
            servers: [{ url: "/api/v1" }],
            components: {
                securitySchemes: {
                    clanApiKey: {
                        type: "http",
                        scheme: "bearer",
                        bearerFormat: "logi API key",
                    },
                },
            },
            paths,
        },
        { headers: { "Cache-Control": "no-store" } }
    )
}
