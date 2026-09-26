import { createHash, randomBytes } from "node:crypto"

import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

import { getInternalAuthSecret } from "@/lib/env"

const createKeyReference = makeFunctionReference<"mutation">(
    "publicApi:createKey"
)
const listKeysReference = makeFunctionReference<"query">("publicApi:listKeys")
const revokeKeyReference = makeFunctionReference<"mutation">(
    "publicApi:revokeKey"
)
const rateLimitReference = makeFunctionReference<"mutation">(
    "publicApi:checkRateLimit"
)
const authenticateKeyReference = makeFunctionReference<"mutation">(
    "publicApi:authenticateKey"
)
const clanResourcePageReference = makeFunctionReference<"query">(
    "publicApi:getClanResourcePage"
)
const clanResourceReference = makeFunctionReference<"query">(
    "publicApi:getClanResource"
)
const mutateArticleReference = makeFunctionReference<"mutation">(
    "publicApi:mutateClanArticle"
)
const mutateEventSignupReference = makeFunctionReference<"mutation">(
    "publicApi:mutateClanEventSignup"
)
const mutateEventReference = makeFunctionReference<"mutation">(
    "publicApi:mutateClanEvent"
)
const mutateGroupReference = makeFunctionReference<"mutation">(
    "publicApi:mutateClanGroup"
)
const mutateCalendarItemReference = makeFunctionReference<"mutation">(
    "publicApi:mutateClanCalendarItem"
)
const mutatePresetReference = makeFunctionReference<"mutation">(
    "publicApi:mutateClanPreset"
)
const mutateRosterReference = makeFunctionReference<"mutation">(
    "publicApi:mutateClanRoster"
)
const mutateAssignmentReference = makeFunctionReference<"mutation">(
    "publicApi:mutateClanAssignment"
)
const clanMetaReference = makeFunctionReference<"query">(
    "publicApi:getClanMeta"
)
const clanSettingsReference = makeFunctionReference<"query">(
    "publicApi:getClanSettings"
)
const mutateClanSettingsReference = makeFunctionReference<"mutation">(
    "publicApi:mutateClanSettings"
)
const clanPerformanceHistoryReference = makeFunctionReference<"query">(
    "publicApi:getClanPerformanceHistory"
)
const clanMatchByEventReference = makeFunctionReference<"query">(
    "publicApi:getClanMatchByEvent"
)
const clanUserReference = makeFunctionReference<"query">(
    "publicApi:getClanUser"
)

export const clanApiResources = [
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
] as const
export type ClanApiResource = (typeof clanApiResources)[number]

export function hashApiKey(value: string) {
    return createHash("sha256").update(value).digest("hex")
}

export async function createClanApiKey(guildId: string, name: string) {
    const value = `logi_${randomBytes(32).toString("base64url")}`
    await fetchMutation(createKeyReference, {
        secret: getInternalAuthSecret(),
        guildId,
        name,
        keyHash: hashApiKey(value),
        keyPrefix: value.slice(0, 13),
    })
    return value
}

export async function listClanApiKeys(guildId: string) {
    return (await fetchQuery(listKeysReference, {
        secret: getInternalAuthSecret(),
        guildId,
    })) as Array<{
        id: string
        name: string
        keyPrefix: string
        createdAt: string
        lastUsedAt?: string
        revokedAt?: string
    }>
}

export async function revokeClanApiKey(guildId: string, keyId: string) {
    await fetchMutation(revokeKeyReference, {
        secret: getInternalAuthSecret(),
        guildId,
        keyId: keyId as never,
    })
}

export async function checkPublicApiRateLimit(bucket: string, limit: number) {
    return (await fetchMutation(rateLimitReference, {
        secret: getInternalAuthSecret(),
        bucket,
        limit,
        windowMs: 60_000,
    })) as { allowed: boolean; remaining: number; resetAt: number }
}

export async function authenticateClanApiKey(key: string) {
    return (await fetchMutation(authenticateKeyReference, {
        secret: getInternalAuthSecret(),
        keyHash: hashApiKey(key),
    })) as { guildId: string } | null
}

export async function getClanApiResourcePage(
    key: string,
    input: {
        resource: ClanApiResource
        game: "hell_let_loose" | "hell_let_loose_vietnam" | "wardogs" | "all"
        cursor: string | null
        limit: number
        updatedSince?: string
    }
) {
    return await fetchQuery(clanResourcePageReference, {
        secret: getInternalAuthSecret(),
        keyHash: hashApiKey(key),
        ...input,
    })
}

export async function getClanApiResource(
    key: string,
    resource: ClanApiResource,
    id: string
) {
    return await fetchQuery(clanResourceReference, {
        secret: getInternalAuthSecret(),
        keyHash: hashApiKey(key),
        resource,
        id,
    })
}

export async function getClanApiMeta(key: string) {
    return await fetchQuery(clanMetaReference, {
        secret: getInternalAuthSecret(),
        keyHash: hashApiKey(key),
    })
}

export async function getClanApiSettings(key: string) {
    return await fetchQuery(clanSettingsReference, {
        secret: getInternalAuthSecret(),
        keyHash: hashApiKey(key),
    })
}
export async function mutateClanApiSettings(input: {
    key: string
    idempotencyKey: string
    bodyHash: string
    methodPath: string
    name?: string
    avatar?: string
    description?: string | null
    timezone?: string
    defaultLanguage?: "en" | "cs" | "de"
    announcementsChannelId?: string | null
    eventInfoChannelId?: string | null
    errorsChannelId?: string | null
    calendarChannelId?: string | null
    forumCategoryId?: string | null
    meetingChannelId?: string | null
    clanRoleId?: string | null
    dashboardAdminRoleId?: string | null
}) {
    return (await fetchMutation(mutateClanSettingsReference, {
        secret: getInternalAuthSecret(),
        ...input,
        keyHash: hashApiKey(input.key),
    })) as { status: number; body: string } | null
}

export async function getClanApiPerformanceHistory(
    key: string,
    game: "hell_let_loose" | "hell_let_loose_vietnam" | "wardogs" | "all"
) {
    return await fetchQuery(clanPerformanceHistoryReference, {
        secret: getInternalAuthSecret(),
        keyHash: hashApiKey(key),
        game,
    })
}
export async function getClanApiMatchByEvent(key: string, eventId: string) {
    return await fetchQuery(clanMatchByEventReference, {
        secret: getInternalAuthSecret(),
        keyHash: hashApiKey(key),
        eventId: eventId as never,
    })
}
export async function getClanApiUser(key: string, userId: string) {
    return await fetchQuery(clanUserReference, {
        secret: getInternalAuthSecret(),
        keyHash: hashApiKey(key),
        userId,
    })
}

export async function mutateClanApiArticle(input: {
    key: string
    idempotencyKey: string
    bodyHash: string
    methodPath: string
    operation: "create" | "update" | "delete"
    articleId?: string
    title?: string
    description?: string
    tags?: string[]
    body?: string
    attachments?: string[]
}) {
    return (await fetchMutation(mutateArticleReference, {
        secret: getInternalAuthSecret(),
        ...input,
        keyHash: hashApiKey(input.key),
        ...(input.articleId ? { articleId: input.articleId as never } : {}),
    })) as { status: number; body: string } | null
}

export async function mutateClanApiEventSignup(input: {
    key: string
    eventId: string
    idempotencyKey: string
    bodyHash: string
    methodPath: string
    userId: string
    group: string | null
}) {
    return (await fetchMutation(mutateEventSignupReference, {
        secret: getInternalAuthSecret(),
        keyHash: hashApiKey(input.key),
        eventId: input.eventId as never,
        idempotencyKey: input.idempotencyKey,
        bodyHash: input.bodyHash,
        methodPath: input.methodPath,
        userId: input.userId,
        group: input.group,
    })) as { status: number; body: string } | null
}

export async function mutateClanApiEvent(input: {
    key: string
    idempotencyKey: string
    bodyHash: string
    methodPath: string
    operation: "create" | "update" | "conclude"
    eventId?: string
    event?: Record<string, unknown>
}) {
    return (await fetchMutation(mutateEventReference, {
        secret: getInternalAuthSecret(),
        keyHash: hashApiKey(input.key),
        idempotencyKey: input.idempotencyKey,
        bodyHash: input.bodyHash,
        methodPath: input.methodPath,
        operation: input.operation,
        ...(input.eventId ? { eventId: input.eventId as never } : {}),
        ...(input.event ? { event: input.event } : {}),
    })) as { status: number; body: string } | null
}

export async function mutateClanApiGroup(input: {
    key: string
    idempotencyKey: string
    bodyHash: string
    methodPath: string
    operation: "create" | "update" | "delete"
    groupId?: string
    gameId?: "hell_let_loose" | "hell_let_loose_vietnam" | "wardogs"
    name?: string
    color?: string
    order?: number
    parentId?: string
    description?: string
    discordRoleId?: string
    discordEmoji?: string
}) {
    return (await fetchMutation(mutateGroupReference, {
        secret: getInternalAuthSecret(),
        ...input,
        keyHash: hashApiKey(input.key),
        ...(input.groupId ? { groupId: input.groupId as never } : {}),
        ...(input.parentId ? { parentId: input.parentId as never } : {}),
    })) as { status: number; body: string } | null
}

export async function mutateClanApiCalendarItem(
    input: Record<string, unknown> & {
        key: string
        idempotencyKey: string
        bodyHash: string
        methodPath: string
        operation: "create" | "update" | "delete"
        calendarItemId?: string
    }
) {
    return (await fetchMutation(mutateCalendarItemReference, {
        secret: getInternalAuthSecret(),
        ...input,
        keyHash: hashApiKey(input.key),
        ...(input.calendarItemId
            ? { calendarItemId: input.calendarItemId as never }
            : {}),
    })) as { status: number; body: string } | null
}

export async function mutateClanApiPreset(input: {
    key: string
    idempotencyKey: string
    bodyHash: string
    methodPath: string
    resource: "stratmaps" | "topic-presets" | "squad-presets"
    operation: "create" | "update"
    presetId?: string
    payload: Record<string, unknown>
}) {
    return (await fetchMutation(mutatePresetReference, {
        secret: getInternalAuthSecret(),
        ...input,
        keyHash: hashApiKey(input.key),
        ...(input.presetId ? { presetId: input.presetId as never } : {}),
    })) as { status: number; body: string } | null
}

export async function mutateClanApiRoster(input: {
    key: string
    idempotencyKey: string
    bodyHash: string
    methodPath: string
    operation: "update" | "delete"
    rosterId: string
    payload?: Record<string, unknown>
}) {
    return (await fetchMutation(mutateRosterReference, {
        secret: getInternalAuthSecret(),
        ...input,
        keyHash: hashApiKey(input.key),
        rosterId: input.rosterId as never,
    })) as { status: number; body: string } | null
}

export async function mutateClanApiAssignment(input: {
    key: string
    idempotencyKey: string
    bodyHash: string
    methodPath: string
    operation: "create" | "update" | "delete"
    assignmentId?: string
    userId?: string
    gameId?: "hell_let_loose" | "hell_let_loose_vietnam" | "wardogs"
    type?: "member" | "reserve_member" | "mercenary"
    status?: "pending" | "recruit" | "active"
    primaryGroupId?: string
    secondaryGroupIds?: string[]
    paused?: boolean
    pausedNote?: string
}) {
    return (await fetchMutation(mutateAssignmentReference, {
        secret: getInternalAuthSecret(),
        ...input,
        keyHash: hashApiKey(input.key),
        ...(input.assignmentId
            ? { assignmentId: input.assignmentId as never }
            : {}),
        ...(input.primaryGroupId
            ? { primaryGroupId: input.primaryGroupId as never }
            : {}),
        ...(input.secondaryGroupIds
            ? { secondaryGroupIds: input.secondaryGroupIds as never }
            : {}),
    })) as { status: number; body: string } | null
}

export function readBearerToken(request: Request) {
    const value = request.headers.get("authorization")
    return value?.startsWith("Bearer ") ? value.slice(7).trim() : null
}

export function rateLimitHeaders(result: {
    remaining: number
    resetAt: number
}) {
    return {
        "RateLimit-Limit": "300",
        "RateLimit-Remaining": String(result.remaining),
        "RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    }
}
