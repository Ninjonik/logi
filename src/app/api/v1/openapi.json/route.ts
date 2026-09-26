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
        "Game scope for game-owned records. Omit for Hell Let Loose; use all only when intentionally combining games.",
    schema: {
        type: "string",
        enum: ["hell_let_loose", "hell_let_loose_vietnam", "wardogs", "all"],
        default: "hell_let_loose",
    },
}
const updatedSinceParameter = {
    name: "updatedSince",
    in: "query",
    description:
        "Only records updated at or after this ISO-8601 timestamp, for incremental synchronization.",
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
const resourceTags: Record<string, string> = {
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
    "/public/matches": {
        get: {
            summary: "List public matches",
            tags: ["Public API — no key required"],
            description:
                "Public, rate-limited match feed. No Authorization header is required.",
            parameters: [
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
                "Public, rate-limited competition details. Use collection=divisions for divisions.",
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
            tags: [resourceTags[resource]!],
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

export async function GET() {
    return NextResponse.json(
        {
            openapi: "3.1.1",
            info: {
                title: "Logi Clan API",
                version: "1.0.0",
                description: `The **Public API — no key required** section contains rate-limited public profiles, matches, and competitions. The **Clan API — API key required** sections contain tenant-scoped dashboard-equivalent data and writes. A clan key can access only its own clan; identifiers from another clan return no data. Game-owned records default to hell_let_loose, including legacy records without gameId; use game=all only for an intentional cross-game view. Cursors are opaque and valid only for the resource, game, and createdAt ordering that produced them.

### Authenticate and read


\`curl -H "Authorization: Bearer YOUR_API_KEY" "https://YOUR_LOGI_HOST/api/v1/clan/events?game=wardogs&limit=25&updatedSince=2026-01-01T00:00:00Z"\`

Use \`page.nextCursor\` from that response as \`cursor\` for the next request. Fetch one record with \`GET /clan/events/{id}\`.

### Make retry-safe writes


Send a new \`Idempotency-Key\` for each write, for example \`event-create-42\`. If a timeout occurs, retry the identical method, path, body, and key; Logi replays the original status and body for 24 hours. Changing the request while reusing the key returns \`409 idempotency_conflict\`; use a new key instead. Invalid input returns a \`400\` body shaped as \`{ error: { code, message } }\`.

### Webhooks


Webhook subscriptions are configured by a System administrator in the dashboard's **System → Webhooks** screen, rather than through this bearer-key API. Subscribed successful writes enqueue JSON \`{ id, type, createdAt, guildId, resource }\`. Verify \`X-Logi-Signature\` as \`sha256=<HMAC_SHA256(X-Logi-Timestamp + "." + rawBody, signingSecret)>\` and reject stale timestamps. Network failures, 408, 429, and 5xx responses retry with bounded backoff; other 4xx responses are final. See the [System settings webhook guide](/wiki/configuration/settings#webhooks) for setup and payload details.

Article, group, calendar-item, roster, assignment, event, signup, stratmap, and preset write operations are documented below. Event, stratmap, topic-preset, and squad-preset deletion is intentionally unsupported because their dependent roster, match, Discord, and scheduled-job data has no safe deletion lifecycle.`,
            },
            servers: [{ url: "/api/v1" }],
            tags: [
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
                securitySchemes: {
                    clanApiKey: {
                        type: "http",
                        scheme: "bearer",
                        bearerFormat: "logi API key",
                        description:
                            "Send `Authorization: Bearer YOUR_API_KEY`. API keys are scoped to one clan and revoked keys are rejected.",
                    },
                },
            },
            paths,
        },
        { headers: { "Cache-Control": "no-store" } }
    )
}
