import { NextResponse } from "next/server"
import { createHash } from "node:crypto"

import {
    clanApiResources,
    getClanApiResource,
    getClanApiResourcePage,
    getClanApiMeta,
    getClanApiSettings,
    getClanApiPerformanceHistory,
    getClanApiMatchByEvent,
    getClanApiUser,
    mutateClanApiArticle,
    mutateClanApiEventSignup,
    mutateClanApiEvent,
    mutateClanApiGroup,
    mutateClanApiCalendarItem,
    mutateClanApiPreset,
    mutateClanApiRoster,
    mutateClanApiAssignment,
    mutateClanApiSettings,
    type ClanApiResource,
} from "@/lib/public-api"
import {
    authenticateClanRequest,
    isAuthError,
} from "@/lib/api/authenticated-clan-route"
import { isApiPageQueryError, parseApiPageQuery } from "@/lib/api/page-query"
import { isApiGameScopeError, parseApiGameScope } from "@/lib/api/game-scope"
import { userAssignmentSchema } from "@/lib/validation/user-assignment"
import { parseClanSettingsPatch } from "@/domain/api/settings-patch"
import { rosterMutationSchema } from "@/domain/api/roster-mutation"
import { parsePresetMutation } from "@/domain/api/preset-mutation"
import { validateIdempotencyKey } from "@/domain/api/idempotency"
import { eventSchema } from "@/lib/validation/event"

export const runtime = "nodejs"

const gameOwned = new Set<ClanApiResource>([
    "events",
    "groups",
    "rosters",
    "assignments",
    "stratmaps",
    "matches",
])

function isResource(value: string): value is ClanApiResource {
    return (clanApiResources as readonly string[]).includes(value)
}

async function mutateArticle(
    request: Request,
    path: string[],
    operation: "create" | "update" | "delete"
) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) return auth
    const rawBody = operation === "delete" ? "" : await request.text()
    let body: Record<string, unknown> = {}
    if (rawBody) {
        try {
            body = JSON.parse(rawBody) as Record<string, unknown>
        } catch {
            return error(
                "invalid_json",
                "Request body must be JSON.",
                400,
                auth.headers
            )
        }
    }
    const idempotencyKey = request.headers.get("idempotency-key")
    const idempotencyError = validateIdempotencyKey(idempotencyKey)
    if (idempotencyError || !idempotencyKey)
        return error(
            "missing_idempotency_key",
            idempotencyError ?? "Idempotency-Key is required.",
            400,
            auth.headers
        )
    const result = await mutateClanApiArticle({
        key: auth.key,
        idempotencyKey,
        bodyHash: createHash("sha256").update(rawBody).digest("hex"),
        methodPath: `${request.method} /clan/articles${path[1] ? "/{articleId}" : ""}`,
        operation,
        ...(path[1] ? { articleId: path[1] } : {}),
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(typeof body.description === "string"
            ? { description: body.description }
            : {}),
        ...(typeof body.body === "string" ? { body: body.body } : {}),
        ...(Array.isArray(body.tags) &&
        body.tags.every((value) => typeof value === "string")
            ? { tags: body.tags }
            : {}),
        ...(Array.isArray(body.attachments) &&
        body.attachments.every((value) => typeof value === "string")
            ? { attachments: body.attachments }
            : {}),
    })
    if (!result)
        return error(
            "invalid_api_key",
            "The API key is invalid or revoked.",
            401,
            auth.headers
        )
    return new NextResponse(result.body, {
        status: result.status,
        headers: { ...auth.headers, "Content-Type": "application/json" },
    })
}

async function mutateEventSignup(request: Request, eventId: string) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) return auth
    const rawBody = await request.text()
    let body: Record<string, unknown>
    try {
        body = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
        return error(
            "invalid_json",
            "Request body must be JSON.",
            400,
            auth.headers
        )
    }
    if (typeof body.userId !== "string" || body.userId.trim().length === 0)
        return error(
            "validation_error",
            "userId is required.",
            400,
            auth.headers
        )
    if (body.group !== null && typeof body.group !== "string")
        return error(
            "validation_error",
            "group must be a string or null.",
            400,
            auth.headers
        )
    const idempotencyKey = request.headers.get("idempotency-key")
    const idempotencyError = validateIdempotencyKey(idempotencyKey)
    if (idempotencyError || !idempotencyKey)
        return error(
            "missing_idempotency_key",
            idempotencyError ?? "Idempotency-Key is required.",
            400,
            auth.headers
        )
    const result = await mutateClanApiEventSignup({
        key: auth.key,
        eventId,
        idempotencyKey,
        bodyHash: createHash("sha256").update(rawBody).digest("hex"),
        methodPath: "POST /clan/events/{eventId}/signup",
        userId: body.userId,
        group: body.group,
    })
    if (!result)
        return error(
            "invalid_api_key",
            "The API key is invalid or revoked.",
            401,
            auth.headers
        )
    return new NextResponse(result.body, {
        status: result.status,
        headers: { ...auth.headers, "Content-Type": "application/json" },
    })
}

async function mutateEvent(
    request: Request,
    eventId: string | undefined,
    operation: "create" | "update" | "conclude"
) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) return auth
    const rawBody = operation === "conclude" ? "" : await request.text()
    const idempotencyKey = request.headers.get("idempotency-key")
    const idempotencyError = validateIdempotencyKey(idempotencyKey)
    if (idempotencyError || !idempotencyKey)
        return error(
            "missing_idempotency_key",
            idempotencyError ?? "Idempotency-Key is required.",
            400,
            auth.headers
        )
    let event: Record<string, unknown> | undefined
    if (operation !== "conclude") {
        let body: unknown
        try {
            body = JSON.parse(rawBody)
        } catch {
            return error(
                "invalid_json",
                "Request body must be JSON.",
                400,
                auth.headers
            )
        }
        const parsed = eventSchema.safeParse(body)
        if (!parsed.success)
            return error(
                "validation_error",
                parsed.error.issues[0]?.message ?? "Event is invalid.",
                400,
                auth.headers
            )
        event = {
            ...parsed.data,
            gameStart: parsed.data.gameStart ?? parsed.data.meetingStart,
            gameEnd:
                parsed.data.gameEnd ??
                parsed.data.gameStart ??
                parsed.data.meetingStart,
        }
    }
    const result = await mutateClanApiEvent({
        key: auth.key,
        idempotencyKey,
        bodyHash: createHash("sha256").update(rawBody).digest("hex"),
        methodPath:
            operation === "create"
                ? "POST /clan/events"
                : operation === "update"
                  ? "PATCH /clan/events/{eventId}"
                  : "POST /clan/events/{eventId}/actions/conclude",
        operation,
        ...(eventId ? { eventId } : {}),
        ...(event ? { event } : {}),
    })
    if (!result)
        return error(
            "invalid_api_key",
            "The API key is invalid or revoked.",
            401,
            auth.headers
        )
    return new NextResponse(result.body, {
        status: result.status,
        headers: { ...auth.headers, "Content-Type": "application/json" },
    })
}

async function mutateSettings(request: Request) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) return auth
    const rawBody = await request.text()
    let body: Record<string, unknown>
    try {
        body = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
        return error(
            "invalid_json",
            "Request body must be JSON.",
            400,
            auth.headers
        )
    }
    const idempotencyKey = request.headers.get("idempotency-key")
    const idempotencyError = validateIdempotencyKey(idempotencyKey)
    if (idempotencyError || !idempotencyKey)
        return error(
            "missing_idempotency_key",
            idempotencyError ?? "Idempotency-Key is required.",
            400,
            auth.headers
        )
    const patch = parseClanSettingsPatch(body)
    if (!patch.ok)
        return error("validation_error", patch.error, 400, auth.headers)
    const result = await mutateClanApiSettings({
        key: auth.key,
        idempotencyKey,
        bodyHash: createHash("sha256").update(rawBody).digest("hex"),
        methodPath: "PATCH /clan/settings",
        ...patch.value,
    })
    if (!result)
        return error(
            "invalid_api_key",
            "The API key is invalid or revoked.",
            401,
            auth.headers
        )
    return new NextResponse(result.body, {
        status: result.status,
        headers: { ...auth.headers, "Content-Type": "application/json" },
    })
}

async function mutateGroup(
    request: Request,
    groupId: string | undefined,
    operation: "create" | "update" | "delete"
) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) return auth
    const rawBody = operation === "delete" ? "" : await request.text()
    let body: Record<string, unknown> = {}
    if (rawBody) {
        try {
            body = JSON.parse(rawBody) as Record<string, unknown>
        } catch {
            return error(
                "invalid_json",
                "Request body must be JSON.",
                400,
                auth.headers
            )
        }
    }
    const idempotencyKey = request.headers.get("idempotency-key")
    const idempotencyError = validateIdempotencyKey(idempotencyKey)
    if (idempotencyError || !idempotencyKey)
        return error(
            "missing_idempotency_key",
            idempotencyError ?? "Idempotency-Key is required.",
            400,
            auth.headers
        )
    const result = await mutateClanApiGroup({
        key: auth.key,
        idempotencyKey,
        bodyHash: createHash("sha256").update(rawBody).digest("hex"),
        methodPath: `${request.method} /clan/groups${groupId ? "/{groupId}" : ""}`,
        operation,
        groupId,
        ...(typeof body.gameId === "string"
            ? {
                  gameId: body.gameId as
                      "hell_let_loose" | "hell_let_loose_vietnam" | "wardogs",
              }
            : {}),
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.color === "string" ? { color: body.color } : {}),
        ...(typeof body.order === "number" ? { order: body.order } : {}),
        ...(typeof body.parentId === "string"
            ? { parentId: body.parentId }
            : {}),
        ...(typeof body.description === "string"
            ? { description: body.description }
            : {}),
        ...(typeof body.discordRoleId === "string"
            ? { discordRoleId: body.discordRoleId }
            : {}),
        ...(typeof body.discordEmoji === "string"
            ? { discordEmoji: body.discordEmoji }
            : {}),
    })
    if (!result)
        return error(
            "invalid_api_key",
            "The API key is invalid or revoked.",
            401,
            auth.headers
        )
    return new NextResponse(result.body, {
        status: result.status,
        headers: { ...auth.headers, "Content-Type": "application/json" },
    })
}

async function mutateCalendarItem(
    request: Request,
    calendarItemId: string | undefined,
    operation: "create" | "update" | "delete"
) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) return auth
    const rawBody = operation === "delete" ? "" : await request.text()
    let body: Record<string, unknown> = {}
    if (rawBody)
        try {
            body = JSON.parse(rawBody) as Record<string, unknown>
        } catch {
            return error(
                "invalid_json",
                "Request body must be JSON.",
                400,
                auth.headers
            )
        }
    const idempotencyKey = request.headers.get("idempotency-key")
    const idempotencyError = validateIdempotencyKey(idempotencyKey)
    if (idempotencyError || !idempotencyKey)
        return error(
            "missing_idempotency_key",
            idempotencyError ?? "Idempotency-Key is required.",
            400,
            auth.headers
        )
    if (
        body.recurrence !== undefined &&
        (!body.recurrence ||
            typeof body.recurrence !== "object" ||
            ![
                "weekly",
                "monthly_date",
                "monthly_nth_weekday",
                "yearly",
            ].includes(
                (body.recurrence as { frequency?: unknown }).frequency as string
            ) ||
            !Number.isInteger(
                (body.recurrence as { interval?: unknown }).interval
            ))
    )
        return error(
            "validation_error",
            "recurrence is invalid.",
            400,
            auth.headers
        )
    const result = await mutateClanApiCalendarItem({
        key: auth.key,
        idempotencyKey,
        bodyHash: createHash("sha256").update(rawBody).digest("hex"),
        methodPath: `${request.method} /clan/calendar-items${calendarItemId ? "/{calendarItemId}" : ""}`,
        operation,
        calendarItemId,
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(typeof body.description === "string"
            ? { description: body.description }
            : {}),
        ...(typeof body.color === "string" ? { color: body.color } : {}),
        ...(typeof body.emoji === "string" ? { emoji: body.emoji } : {}),
        ...(typeof body.label === "string" ? { label: body.label } : {}),
        ...(typeof body.startAt === "string" ? { startAt: body.startAt } : {}),
        ...(typeof body.endAt === "string" ? { endAt: body.endAt } : {}),
        ...(typeof body.allDay === "boolean" ? { allDay: body.allDay } : {}),
        ...(typeof body.recurrence === "object" && body.recurrence !== null
            ? { recurrence: body.recurrence }
            : {}),
    })
    if (!result)
        return error(
            "invalid_api_key",
            "The API key is invalid or revoked.",
            401,
            auth.headers
        )
    return new NextResponse(result.body, {
        status: result.status,
        headers: { ...auth.headers, "Content-Type": "application/json" },
    })
}

async function mutatePreset(
    request: Request,
    resource: "stratmaps" | "topic-presets" | "squad-presets",
    presetId: string | undefined,
    operation: "create" | "update"
) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) return auth
    const rawBody = await request.text()
    let body: unknown
    try {
        body = JSON.parse(rawBody)
    } catch {
        return error(
            "invalid_json",
            "Request body must be JSON.",
            400,
            auth.headers
        )
    }
    const parsed = parsePresetMutation(resource, body)
    if (!parsed.success)
        return error(
            "validation_error",
            parsed.error.issues[0]?.message ?? "Request body is invalid.",
            400,
            auth.headers
        )
    const idempotencyKey = request.headers.get("idempotency-key")
    const idempotencyError = validateIdempotencyKey(idempotencyKey)
    if (idempotencyError || !idempotencyKey)
        return error(
            "missing_idempotency_key",
            idempotencyError ?? "Idempotency-Key is required.",
            400,
            auth.headers
        )
    const result = await mutateClanApiPreset({
        key: auth.key,
        idempotencyKey,
        bodyHash: createHash("sha256").update(rawBody).digest("hex"),
        methodPath: `${request.method} /clan/${resource}${presetId ? "/{id}" : ""}`,
        resource,
        operation,
        presetId,
        payload: parsed.data,
    })
    if (!result)
        return error(
            "invalid_api_key",
            "The API key is invalid or revoked.",
            401,
            auth.headers
        )
    return new NextResponse(result.body, {
        status: result.status,
        headers: { ...auth.headers, "Content-Type": "application/json" },
    })
}

async function mutateRoster(
    request: Request,
    rosterId: string,
    operation: "update" | "delete"
) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) return auth
    const rawBody = operation === "delete" ? "" : await request.text()
    let payload: Record<string, unknown> | undefined
    if (rawBody) {
        try {
            const parsed = rosterMutationSchema.safeParse(JSON.parse(rawBody))
            if (!parsed.success)
                return error(
                    "validation_error",
                    parsed.error.issues[0]?.message ?? "Roster is invalid.",
                    400,
                    auth.headers
                )
            payload = parsed.data
        } catch {
            return error(
                "invalid_json",
                "Request body must be JSON.",
                400,
                auth.headers
            )
        }
    }
    const idempotencyKey = request.headers.get("idempotency-key")
    const idempotencyError = validateIdempotencyKey(idempotencyKey)
    if (idempotencyError || !idempotencyKey)
        return error(
            "missing_idempotency_key",
            idempotencyError ?? "Idempotency-Key is required.",
            400,
            auth.headers
        )
    const result = await mutateClanApiRoster({
        key: auth.key,
        idempotencyKey,
        bodyHash: createHash("sha256").update(rawBody).digest("hex"),
        methodPath: `${request.method} /clan/rosters/{rosterId}`,
        operation,
        rosterId,
        ...(payload ? { payload } : {}),
    })
    if (!result)
        return error(
            "invalid_api_key",
            "The API key is invalid or revoked.",
            401,
            auth.headers
        )
    return new NextResponse(result.body, {
        status: result.status,
        headers: { ...auth.headers, "Content-Type": "application/json" },
    })
}

async function mutateAssignment(
    request: Request,
    assignmentId: string | undefined,
    operation: "create" | "update" | "delete"
) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) return auth
    const rawBody = operation === "delete" ? "" : await request.text()
    let assignment: ReturnType<typeof userAssignmentSchema.parse> | undefined
    if (rawBody) {
        try {
            const parsed = userAssignmentSchema.safeParse(JSON.parse(rawBody))
            if (!parsed.success)
                return error(
                    "validation_error",
                    parsed.error.issues[0]?.message ?? "Assignment is invalid.",
                    400,
                    auth.headers
                )
            assignment = parsed.data
        } catch {
            return error(
                "invalid_json",
                "Request body must be JSON.",
                400,
                auth.headers
            )
        }
    }
    const idempotencyKey = request.headers.get("idempotency-key")
    const idempotencyError = validateIdempotencyKey(idempotencyKey)
    if (idempotencyError || !idempotencyKey)
        return error(
            "missing_idempotency_key",
            idempotencyError ?? "Idempotency-Key is required.",
            400,
            auth.headers
        )
    const result = await mutateClanApiAssignment({
        key: auth.key,
        idempotencyKey,
        bodyHash: createHash("sha256").update(rawBody).digest("hex"),
        methodPath: `${request.method} /clan/assignments${assignmentId ? "/{assignmentId}" : ""}`,
        operation,
        assignmentId,
        ...(assignment
            ? {
                  userId: assignment.userId,
                  gameId: assignment.gameId,
                  type: assignment.type,
                  status: assignment.status,
                  primaryGroupId: assignment.primaryGroupId,
                  secondaryGroupIds: assignment.secondaryGroupIds,
                  paused: assignment.paused,
                  pausedNote: assignment.pausedNote,
              }
            : {}),
    })
    if (!result)
        return error(
            "invalid_api_key",
            "The API key is invalid or revoked.",
            401,
            auth.headers
        )
    return new NextResponse(result.body, {
        status: result.status,
        headers: { ...auth.headers, "Content-Type": "application/json" },
    })
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ path?: string[] }> }
) {
    const path = (await params).path ?? []
    if (path.length === 1 && path[0] === "articles")
        return mutateArticle(request, path, "create")
    if (path.length === 1 && path[0] === "groups")
        return mutateGroup(request, undefined, "create")
    if (path.length === 1 && path[0] === "calendar-items")
        return mutateCalendarItem(request, undefined, "create")
    if (path.length === 1 && path[0] === "events")
        return mutateEvent(request, undefined, "create")
    if (path.length === 1 && path[0] === "assignments")
        return mutateAssignment(request, undefined, "create")
    if (
        path.length === 1 &&
        (path[0] === "stratmaps" ||
            path[0] === "topic-presets" ||
            path[0] === "squad-presets")
    )
        return mutatePreset(request, path[0], undefined, "create")
    if (path.length === 3 && path[0] === "events" && path[2] === "signup")
        return mutateEventSignup(request, path[1]!)
    if (
        path.length === 4 &&
        path[0] === "events" &&
        path[2] === "actions" &&
        path[3] === "conclude"
    )
        return mutateEvent(request, path[1], "conclude")
    return error("not_found", "Resource not found.", 404)
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ path?: string[] }> }
) {
    const path = (await params).path ?? []
    if (path.length === 1 && path[0] === "settings")
        return mutateSettings(request)
    if (path.length === 2 && path[0] === "events")
        return mutateEvent(request, path[1], "update")
    if (path.length === 2 && path[0] === "rosters")
        return mutateRoster(request, path[1], "update")
    if (path.length === 2 && path[0] === "assignments")
        return mutateAssignment(request, path[1], "update")
    if (
        path.length === 2 &&
        (path[0] === "stratmaps" ||
            path[0] === "topic-presets" ||
            path[0] === "squad-presets")
    )
        return mutatePreset(request, path[0], path[1], "update")
    if (path.length !== 2 || path[0] !== "articles")
        return path.length === 2 && path[0] === "groups"
            ? mutateGroup(request, path[1], "update")
            : path.length === 2 && path[0] === "calendar-items"
              ? mutateCalendarItem(request, path[1], "update")
              : error("not_found", "Resource not found.", 404)
    return mutateArticle(request, path, "update")
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ path?: string[] }> }
) {
    const path = (await params).path ?? []
    if (path.length !== 2 || path[0] !== "articles")
        return path.length === 2 && path[0] === "groups"
            ? mutateGroup(request, path[1], "delete")
            : path.length === 2 && path[0] === "calendar-items"
              ? mutateCalendarItem(request, path[1], "delete")
              : path.length === 2 && path[0] === "rosters"
                ? mutateRoster(request, path[1], "delete")
                : path.length === 2 && path[0] === "assignments"
                  ? mutateAssignment(request, path[1], "delete")
                  : error("not_found", "Resource not found.", 404)
    return mutateArticle(request, path, "delete")
}

function error(
    code: string,
    message: string,
    status: number,
    headers?: HeadersInit
) {
    return NextResponse.json({ error: { code, message } }, { status, headers })
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ path?: string[] }> }
) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) return auth
    const path = (await params).path ?? []
    if (path.length === 1 && path[0] === "meta") {
        const meta = await getClanApiMeta(auth.key)
        if (!meta)
            return error(
                "invalid_api_key",
                "The API key is invalid or revoked.",
                401,
                auth.headers
            )
        return NextResponse.json(
            {
                data: {
                    ...meta,
                    limits: {
                        requestsPerMinute: 300,
                        defaultPageSize: 25,
                        maximumPageSize: 100,
                    },
                    serverTime: new Date().toISOString(),
                },
            },
            {
                headers: {
                    ...auth.headers,
                    "Cache-Control": "private, max-age=30",
                },
            }
        )
    }
    if (path.length === 1 && path[0] === "settings") {
        const data = await getClanApiSettings(auth.key)
        if (!data)
            return error(
                "invalid_api_key",
                "The API key is invalid or revoked.",
                401,
                auth.headers
            )
        return NextResponse.json({ data }, { headers: auth.headers })
    }
    if (path.length === 1 && path[0] === "performance-history") {
        const game = parseApiGameScope(request)
        if (isApiGameScopeError(game))
            return error("invalid_query", game.error, 400, auth.headers)
        const data = await getClanApiPerformanceHistory(auth.key, game)
        if (!data)
            return error(
                "invalid_api_key",
                "The API key is invalid or revoked.",
                401,
                auth.headers
            )
        return NextResponse.json({ data }, { headers: auth.headers })
    }
    const [resource, id] = path
    if (!resource || !isResource(resource) || path.length > 2)
        return error("not_found", "Resource not found.", 404, auth.headers)
    if (id) {
        if (resource === "users") {
            const data = await getClanApiUser(auth.key, id)
            if (!data)
                return error(
                    "not_found",
                    "Record not found.",
                    404,
                    auth.headers
                )
            return NextResponse.json({ data }, { headers: auth.headers })
        }
        if (resource === "matches") {
            const data = await getClanApiMatchByEvent(auth.key, id)
            if (!data)
                return error(
                    "not_found",
                    "Record not found.",
                    404,
                    auth.headers
                )
            return NextResponse.json({ data }, { headers: auth.headers })
        }
        const data = await getClanApiResource(auth.key, resource, id)
        if (!data)
            return error("not_found", "Record not found.", 404, auth.headers)
        return NextResponse.json({ data }, { headers: auth.headers })
    }
    const query = parseApiPageQuery(request, {
        gameOwned: gameOwned.has(resource),
        supportsUpdatedSince: true,
    })
    if (isApiPageQueryError(query))
        return error("invalid_query", query.error, 400, auth.headers)
    let data
    try {
        data = await getClanApiResourcePage(auth.key, {
            resource,
            game: query.game,
            cursor: query.cursor,
            limit: query.limit,
            ...(query.updatedSince ? { updatedSince: query.updatedSince } : {}),
        })
    } catch {
        // Convex validates opaque cursors against the resource query.
        return error("invalid_query", "cursor is invalid.", 400, auth.headers)
    }
    if (!data)
        return error(
            "invalid_api_key",
            "The API key is invalid or revoked.",
            401,
            auth.headers
        )
    return NextResponse.json(
        {
            data: data.items,
            page: { nextCursor: data.nextCursor, limit: data.limit },
        },
        { headers: { ...auth.headers, "Cache-Control": "private, max-age=30" } }
    )
}
