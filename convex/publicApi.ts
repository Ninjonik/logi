import type { MutationCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

import {
    ConvexEventCommandRepository,
    ConvexEventScoreRepository,
    DelegatingEventScorePort,
} from "../src/infrastructure/convex/event-command-repositories"
import {
    ConvexAssignmentCommandRepository,
    ConvexAssignmentRosterSyncPort,
} from "../src/infrastructure/convex/assignment-command-repositories"
import {
    ConvexEventWorkflowRepository,
    ConvexEventWorkflowSyncPort,
} from "../src/infrastructure/convex/event-workflow-repositories"
import { ConvexRosterCommandRepository } from "../src/infrastructure/convex/roster-command-repositories"
import { UpsertAssignmentUseCase } from "../src/application/assignments/upsert-assignment.use-case"
import { RemoveAssignmentUseCase } from "../src/application/assignments/remove-assignment.use-case"
import {
    buildDefaultStratmapState,
    stringifyStratmapState,
} from "../src/lib/stratmaps"
import { ApplyEventScoreUseCase } from "../src/application/events/apply-event-score.use-case"
import { UpsertRosterUseCase } from "../src/application/rosters/roster-commands.use-case"
import { ConcludeEventUseCase } from "../src/application/events/conclude-event.use-case"
import { ToggleSignupUseCase } from "../src/application/events/toggle-signup.use-case"
import { UpsertEventUseCase } from "../src/application/events/upsert-event.use-case"
import { refreshEventSchedule } from "../src/infrastructure/convex/event-scheduling"
import type { EventUpsertCommand } from "../src/application/events/command-ports"
import { isClanApiResourceDocument } from "../src/domain/api/resource-document"
import { matchesGameScope, resolveGameScope } from "../src/domain/games/game"
import { IDEMPOTENCY_RETENTION_MS } from "../src/domain/api/idempotency"
import { systemClock } from "../src/domain/shared/clock"
import { DEFAULT_ROSTER_SCORE_SETTINGS } from "./guilds"
import { getGuildByDiscordId } from "./identity"

const INTERNAL_AUTH_SECRET =
    process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret"
function assertInternalSecret(secret: string) {
    if (secret !== INTERNAL_AUTH_SECRET) throw new Error("Unauthorized.")
}

export const createKey = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        name: v.string(),
        keyHash: v.string(),
        keyPrefix: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        if (!(await getGuildByDiscordId(ctx, args.guildId)))
            throw new Error("Clan not found.")
        return await ctx.db.insert("apiKeys", {
            guildId: args.guildId,
            name: args.name.trim().slice(0, 80) || "Website",
            keyHash: args.keyHash,
            keyPrefix: args.keyPrefix,
            createdAt: new Date().toISOString(),
        })
    },
})

export const listKeys = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        return (
            await ctx.db
                .query("apiKeys")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .collect()
        ).map((key) => ({
            id: String(key._id),
            name: key.name,
            keyPrefix: key.keyPrefix,
            createdAt: key.createdAt,
            lastUsedAt: key.lastUsedAt,
            revokedAt: key.revokedAt,
        }))
    },
})

export const revokeKey = mutation({
    args: { secret: v.string(), guildId: v.string(), keyId: v.id("apiKeys") },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await ctx.db.get(args.keyId)
        if (!key || key.guildId !== args.guildId)
            throw new Error("API key not found.")
        await ctx.db.patch(args.keyId, { revokedAt: new Date().toISOString() })
    },
})

export const checkRateLimit = mutation({
    args: {
        secret: v.string(),
        bucket: v.string(),
        limit: v.number(),
        windowMs: v.number(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const now = Date.now()
        const existing = await ctx.db
            .query("apiRateLimitBuckets")
            .withIndex("bucket", (q) => q.eq("bucket", args.bucket))
            .unique()
        if (!existing || existing.resetAt <= now) {
            if (existing)
                await ctx.db.patch(existing._id, {
                    count: 1,
                    resetAt: now + args.windowMs,
                })
            else
                await ctx.db.insert("apiRateLimitBuckets", {
                    bucket: args.bucket,
                    count: 1,
                    resetAt: now + args.windowMs,
                })
            return {
                allowed: true,
                remaining: args.limit - 1,
                resetAt: now + args.windowMs,
            }
        }
        if (existing.count >= args.limit)
            return { allowed: false, remaining: 0, resetAt: existing.resetAt }
        await ctx.db.patch(existing._id, { count: existing.count + 1 })
        return {
            allowed: true,
            remaining: args.limit - existing.count - 1,
            resetAt: existing.resetAt,
        }
    },
})

type IdempotentMutationInput = {
    keyHash: string
    idempotencyKey: string
    bodyHash: string
    methodPath: string
}

type IdempotentMutationStart =
    | { kind: "unauthorized" }
    | { kind: "complete"; result: { status: number; body: string } }
    | {
          kind: "started"
          key: Doc<"apiKeys">
          idempotencyId: Id<"apiIdempotencyKeys">
          createdAt: string
      }

/**
 * Starts an API-key mutation in the same Convex transaction as its resource
 * write and response recording. Keeping this local prevents a retry from
 * observing a reservation without its corresponding resource result.
 */
async function startIdempotentMutation(
    ctx: MutationCtx,
    args: IdempotentMutationInput
): Promise<IdempotentMutationStart> {
    const key = await ctx.db
        .query("apiKeys")
        .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
        .unique()
    if (!key || key.revokedAt) return { kind: "unauthorized" }

    const existing = await ctx.db
        .query("apiIdempotencyKeys")
        .withIndex("guildId_key", (q) =>
            q.eq("guildId", key.guildId).eq("key", args.idempotencyKey)
        )
        .unique()
    if (existing && existing.expiresAt > Date.now()) {
        if (
            existing.methodPath !== args.methodPath ||
            existing.bodyHash !== args.bodyHash
        )
            return {
                kind: "complete",
                result: {
                    status: 409,
                    body: JSON.stringify({
                        error: {
                            code: "idempotency_conflict",
                            message:
                                "This Idempotency-Key was used for a different request.",
                        },
                    }),
                },
            }
        return {
            kind: "complete",
            result: { status: existing.status, body: existing.responseBody },
        }
    }
    if (existing) await ctx.db.delete(existing._id)

    const createdAt = new Date().toISOString()
    const idempotencyId = await ctx.db.insert("apiIdempotencyKeys", {
        guildId: key.guildId,
        key: args.idempotencyKey,
        methodPath: args.methodPath,
        bodyHash: args.bodyHash,
        status: 500,
        responseBody: "",
        createdAt,
        expiresAt: Date.now() + IDEMPOTENCY_RETENTION_MS,
    })
    return { kind: "started", key, idempotencyId, createdAt }
}

export const mutateClanArticle = mutation({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        idempotencyKey: v.string(),
        bodyHash: v.string(),
        methodPath: v.string(),
        operation: v.union(
            v.literal("create"),
            v.literal("update"),
            v.literal("delete")
        ),
        articleId: v.optional(v.id("articles")),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        body: v.optional(v.string()),
        attachments: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const idempotency = await startIdempotentMutation(ctx, args)
        if (idempotency.kind === "unauthorized") return null
        if (idempotency.kind === "complete") return idempotency.result
        const { key, idempotencyId, createdAt } = idempotency
        let status = 200
        let response!: Record<string, unknown>
        let eventType: string
        if (args.operation === "delete") {
            const article = args.articleId
                ? await ctx.db.get(args.articleId)
                : null
            if (!article || article.guildId !== key.guildId) {
                status = 404
                response = {
                    error: { code: "not_found", message: "Article not found." },
                }
                eventType = ""
            } else {
                await ctx.db.delete(article._id)
                response = { data: { id: String(article._id), deleted: true } }
                eventType = "article.deleted"
            }
        } else {
            const title = args.title?.trim() ?? ""
            const description = args.description?.trim() ?? ""
            const body = args.body ?? ""
            if (!title || !description || !body) {
                status = 400
                response = {
                    error: {
                        code: "validation_error",
                        message: "title, description, and body are required.",
                    },
                }
                eventType = ""
            } else {
                const value = {
                    title,
                    description,
                    body,
                    tags: (args.tags ?? [])
                        .map((tag) => tag.trim())
                        .filter(Boolean)
                        .slice(0, 20),
                    attachments: (args.attachments ?? [])
                        .map((attachment) => attachment.trim())
                        .filter(Boolean),
                    updatedAt: createdAt,
                }
                if (args.operation === "update") {
                    const article = args.articleId
                        ? await ctx.db.get(args.articleId)
                        : null
                    if (!article || article.guildId !== key.guildId) {
                        status = 404
                        response = {
                            error: {
                                code: "not_found",
                                message: "Article not found.",
                            },
                        }
                        eventType = ""
                    } else {
                        await ctx.db.patch(article._id, value)
                        response = {
                            data: {
                                id: String(article._id),
                                ...value,
                                guildId: key.guildId,
                                createdAt: article.createdAt,
                            },
                        }
                        eventType = "article.updated"
                    }
                } else {
                    const articleId = await ctx.db.insert("articles", {
                        guildId: key.guildId,
                        authorId: `api:${key._id}`,
                        createdAt,
                        ...value,
                    })
                    response = {
                        data: {
                            id: String(articleId),
                            ...value,
                            guildId: key.guildId,
                            authorId: `api:${key._id}`,
                            createdAt,
                        },
                    }
                    status = 201
                    eventType = "article.created"
                }
            }
        }
        if (eventType)
            await enqueueClanWebhook(ctx, {
                guildId: key.guildId,
                eventType,
                createdAt,
                resource: response.data,
            })
        const responseBody = JSON.stringify(response)
        await ctx.db.patch(idempotencyId, { status, responseBody })
        return { status, body: responseBody }
    },
})

/** Atomically applies an API-key signup and records an idempotent response. */
async function enqueueClanWebhook(
    ctx: MutationCtx,
    input: {
        guildId: string
        eventType: string
        createdAt: string
        resource: unknown
    }
) {
    const payload = JSON.stringify({
        id: crypto.randomUUID(),
        type: input.eventType,
        createdAt: input.createdAt,
        guildId: input.guildId,
        resource: input.resource,
    })
    const hooks = await ctx.db
        .query("webhookSubscriptions")
        .withIndex("guildId", (q) => q.eq("guildId", input.guildId))
        .collect()
    for (const hook of hooks)
        if (hook.enabled && hook.eventTypes.includes(input.eventType))
            await ctx.db.insert("webhookDeliveries", {
                webhookId: hook._id,
                guildId: input.guildId,
                eventType: input.eventType,
                payload,
                attempt: 0,
                status: "pending",
                nextAttemptAt: Date.now(),
                createdAt: input.createdAt,
            })
}

async function applyEventScore(ctx: MutationCtx, eventId: string) {
    await new ApplyEventScoreUseCase(
        new ConvexEventScoreRepository(ctx, DEFAULT_ROSTER_SCORE_SETTINGS)
    ).execute(eventId)
}

/** Atomically applies a dashboard-equivalent event upsert or conclude action. */
export const mutateClanEvent = mutation({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        idempotencyKey: v.string(),
        bodyHash: v.string(),
        methodPath: v.string(),
        operation: v.union(
            v.literal("create"),
            v.literal("update"),
            v.literal("conclude")
        ),
        eventId: v.optional(v.id("events")),
        // The route validates the complete dashboard event schema. Keeping it as
        // one object avoids maintaining a second, drifting Convex validator.
        event: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const idempotency = await startIdempotentMutation(ctx, args)
        if (idempotency.kind === "unauthorized") return null
        if (idempotency.kind === "complete") return idempotency.result
        const { key, idempotencyId, createdAt } = idempotency
        let status = args.operation === "create" ? 201 : 200
        let response: Record<string, unknown>
        let eventType: "event.created" | "event.updated" | null = null
        try {
            const current = args.eventId ? await ctx.db.get(args.eventId) : null
            if (
                args.operation !== "create" &&
                (!current || current.guildId !== key.guildId)
            ) {
                status = 404
                response = {
                    error: { code: "not_found", message: "Event not found." },
                }
            } else if (args.operation === "conclude") {
                await new ConcludeEventUseCase(
                    new ConvexEventCommandRepository(ctx),
                    new DelegatingEventScorePort((eventId) =>
                        applyEventScore(ctx, eventId)
                    ),
                    systemClock
                ).execute(String(args.eventId))
                const event = await ctx.db.get(args.eventId!)
                response = { data: apiDocument(event!) }
                eventType = "event.updated"
            } else {
                const event = args.event as Record<string, unknown>
                const references = [
                    ...((event.signupGroupIds as string[] | undefined) ?? []),
                    ...((event.stratmapIds as string[] | undefined) ?? []),
                    ...(event.topicPresetId
                        ? [event.topicPresetId as string]
                        : []),
                ]
                if (
                    references.some(
                        (value) => typeof value !== "string" || !value
                    )
                )
                    throw new Error("Referenced resource IDs are invalid.")
                for (const groupId of (event.signupGroupIds as
                    string[] | undefined) ?? []) {
                    const group = await ctx.db.get(groupId as Id<"groups">)
                    if (!group || group.guildId !== key.guildId)
                        throw new Error(
                            "Referenced signup group was not found."
                        )
                }
                for (const stratmapId of (event.stratmapIds as
                    string[] | undefined) ?? []) {
                    const stratmap = await ctx.db.get(
                        stratmapId as Id<"stratmaps">
                    )
                    if (!stratmap || stratmap.guildId !== key.guildId)
                        throw new Error("Referenced stratmap was not found.")
                }
                if (event.topicPresetId) {
                    const preset = await ctx.db.get(
                        event.topicPresetId as Id<"topicPresets">
                    )
                    if (!preset || preset.guildId !== key.guildId)
                        throw new Error(
                            "Referenced topic preset was not found."
                        )
                }
                const eventId = await new UpsertEventUseCase(
                    new ConvexEventCommandRepository(ctx),
                    new DelegatingEventScorePort((id) =>
                        applyEventScore(ctx, id)
                    ),
                    systemClock
                ).execute({
                    ...(event as EventUpsertCommand),
                    guildId: key.guildId,
                    ...(args.eventId ? { eventId: String(args.eventId) } : {}),
                })
                await refreshEventSchedule(ctx, eventId as Id<"events">)
                const saved = await ctx.db.get(eventId as Id<"events">)
                response = { data: apiDocument(saved!) }
                eventType =
                    args.operation === "create"
                        ? "event.created"
                        : "event.updated"
            }
        } catch (error) {
            status = 400
            response = {
                error: {
                    code: "validation_error",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unable to save event.",
                },
            }
        }
        if (eventType)
            await enqueueClanWebhook(ctx, {
                guildId: key.guildId,
                eventType,
                createdAt,
                resource: response.data as Record<string, unknown>,
            })
        const body = JSON.stringify(response)
        await ctx.db.patch(idempotencyId, { status, responseBody: body })
        return { status, body }
    },
})

export const mutateClanEventSignup = mutation({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        eventId: v.id("events"),
        idempotencyKey: v.string(),
        bodyHash: v.string(),
        methodPath: v.string(),
        userId: v.string(),
        group: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const idempotency = await startIdempotentMutation(ctx, args)
        if (idempotency.kind === "unauthorized") return null
        if (idempotency.kind === "complete") return idempotency.result
        const { key, idempotencyId, createdAt } = idempotency
        const event = await ctx.db.get(args.eventId)
        let status = 200
        let response!: Record<string, unknown>
        if (!event || event.guildId !== key.guildId) {
            status = 404
            response = {
                error: { code: "not_found", message: "Event not found." },
            }
        } else if (!args.userId.trim()) {
            status = 400
            response = {
                error: {
                    code: "validation_error",
                    message: "userId is required.",
                },
            }
        } else {
            try {
                const result = await new ToggleSignupUseCase(
                    new ConvexEventWorkflowRepository(ctx),
                    new ConvexEventWorkflowSyncPort(ctx),
                    systemClock
                ).execute({
                    eventId: String(args.eventId),
                    userId: args.userId.trim(),
                    group: args.group,
                })
                response = {
                    data: {
                        eventId: String(args.eventId),
                        userId: args.userId.trim(),
                        ...result,
                    },
                }
                await enqueueClanWebhook(ctx, {
                    guildId: key.guildId,
                    eventType: "roster.updated",
                    createdAt,
                    resource: response.data,
                })
            } catch (error) {
                status = 400
                response = {
                    error: {
                        code: "validation_error",
                        message:
                            error instanceof Error
                                ? error.message
                                : "Unable to update signup.",
                    },
                }
            }
        }
        const responseBody = JSON.stringify(response)
        await ctx.db.patch(idempotencyId, { status, responseBody })
        return { status, body: responseBody }
    },
})

export const mutateClanGroup = mutation({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        idempotencyKey: v.string(),
        bodyHash: v.string(),
        methodPath: v.string(),
        operation: v.union(
            v.literal("create"),
            v.literal("update"),
            v.literal("delete")
        ),
        groupId: v.optional(v.id("groups")),
        gameId: v.optional(
            v.union(
                v.literal("hell_let_loose"),
                v.literal("hell_let_loose_vietnam"),
                v.literal("wardogs")
            )
        ),
        name: v.optional(v.string()),
        color: v.optional(v.string()),
        order: v.optional(v.number()),
        parentId: v.optional(v.id("groups")),
        description: v.optional(v.string()),
        discordRoleId: v.optional(v.string()),
        discordEmoji: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const idempotency = await startIdempotentMutation(ctx, args)
        if (idempotency.kind === "unauthorized") return null
        if (idempotency.kind === "complete") return idempotency.result
        const { key, idempotencyId, createdAt } = idempotency
        let status = 200
        let response: Record<string, unknown>
        const group = args.groupId ? await ctx.db.get(args.groupId) : null
        if (
            args.operation !== "create" &&
            (!group || group.guildId !== key.guildId)
        ) {
            status = 404
            response = {
                error: { code: "not_found", message: "Group not found." },
            }
        } else if (args.operation === "delete") {
            const assignments = await ctx.db
                .query("userAssignments")
                .withIndex("serverId", (q) => q.eq("serverId", key.guildId))
                .collect()
            for (const assignment of assignments) {
                if (
                    assignment.primaryGroupId === group!._id ||
                    (assignment.secondaryGroupIds ?? []).some(
                        (id) => id === group!._id
                    )
                )
                    await ctx.db.patch(assignment._id, {
                        primaryGroupId:
                            assignment.primaryGroupId === group!._id
                                ? undefined
                                : assignment.primaryGroupId,
                        secondaryGroupIds: (
                            assignment.secondaryGroupIds ?? []
                        ).filter((id) => id !== group!._id),
                        updatedAt: createdAt,
                    })
            }
            await ctx.db.delete(group!._id)
            response = { data: { id: String(group!._id), deleted: true } }
        } else {
            const name = args.name?.trim() ?? ""
            const color = args.color
            const order = args.order
            if (
                !name ||
                !color ||
                !/^#[0-9A-Fa-f]{6}$/.test(color) ||
                typeof order !== "number" ||
                !Number.isInteger(order)
            ) {
                status = 400
                response = {
                    error: {
                        code: "validation_error",
                        message:
                            "name, a #RRGGBB color, and an integer order are required.",
                    },
                }
            } else {
                const gameId = group?.gameId ?? args.gameId
                if (args.parentId) {
                    const parent = await ctx.db.get(args.parentId)
                    if (
                        !parent ||
                        parent.guildId !== key.guildId ||
                        resolveGameScope(parent.gameId) !==
                            resolveGameScope(gameId)
                    ) {
                        status = 400
                        response = {
                            error: {
                                code: "validation_error",
                                message: "Parent group not found.",
                            },
                        }
                    }
                }
                if (!response!) {
                    const sameName = await ctx.db
                        .query("groups")
                        .withIndex("guildId_name", (q) =>
                            q.eq("guildId", key.guildId).eq("name", name)
                        )
                        .collect()
                    const duplicate = sameName.some(
                        (candidate) =>
                            candidate._id !== group?._id &&
                            resolveGameScope(candidate.gameId) ===
                                resolveGameScope(gameId)
                    )
                    if (duplicate) {
                        status = 400
                        response = {
                            error: {
                                code: "validation_error",
                                message:
                                    "A group with this name already exists.",
                            },
                        }
                    } else if (group) {
                        await ctx.db.patch(group._id, {
                            name,
                            color: args.color,
                            order: args.order,
                            parentId: args.parentId,
                            description: args.description?.trim() || undefined,
                            discordRoleId:
                                args.discordRoleId?.trim() || undefined,
                            discordEmoji:
                                args.discordEmoji?.trim() || undefined,
                            updatedAt: createdAt,
                        })
                        response = {
                            data: apiDocument({
                                ...group,
                                name,
                                color,
                                order,
                                parentId: args.parentId,
                                description:
                                    args.description?.trim() || undefined,
                                discordRoleId:
                                    args.discordRoleId?.trim() || undefined,
                                discordEmoji:
                                    args.discordEmoji?.trim() || undefined,
                                updatedAt: createdAt,
                            }),
                        }
                    } else {
                        const groupId = await ctx.db.insert("groups", {
                            guildId: key.guildId,
                            gameId,
                            name,
                            color,
                            order,
                            parentId: args.parentId,
                            description: args.description?.trim() || undefined,
                            discordRoleId:
                                args.discordRoleId?.trim() || undefined,
                            discordEmoji:
                                args.discordEmoji?.trim() || undefined,
                            createdAt,
                            updatedAt: createdAt,
                        })
                        response = {
                            data: {
                                id: String(groupId),
                                guildId: key.guildId,
                                gameId: resolveGameScope(gameId),
                                name,
                                color,
                                order,
                                parentId: args.parentId,
                                description:
                                    args.description?.trim() || undefined,
                                discordRoleId:
                                    args.discordRoleId?.trim() || undefined,
                                discordEmoji:
                                    args.discordEmoji?.trim() || undefined,
                                createdAt,
                                updatedAt: createdAt,
                            },
                        }
                        status = 201
                    }
                }
            }
        }
        const responseBody = JSON.stringify(response!)
        await ctx.db.patch(idempotencyId, { status, responseBody })
        return { status, body: responseBody }
    },
})

const calendarRecurrence = v.object({
    frequency: v.union(
        v.literal("weekly"),
        v.literal("monthly_date"),
        v.literal("monthly_nth_weekday"),
        v.literal("yearly")
    ),
    interval: v.number(),
    until: v.optional(v.string()),
})

/** Creates or updates a preset through the same validation surface as the dashboard. */
export const mutateClanPreset = mutation({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        idempotencyKey: v.string(),
        bodyHash: v.string(),
        methodPath: v.string(),
        resource: v.union(
            v.literal("stratmaps"),
            v.literal("topic-presets"),
            v.literal("squad-presets")
        ),
        operation: v.union(v.literal("create"), v.literal("update")),
        presetId: v.optional(
            v.union(
                v.id("stratmaps"),
                v.id("topicPresets"),
                v.id("squadPresets")
            )
        ),
        payload: v.any(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const idempotency = await startIdempotentMutation(ctx, args)
        if (idempotency.kind === "unauthorized") return null
        if (idempotency.kind === "complete") return idempotency.result
        const { key, idempotencyId, createdAt } = idempotency
        const table =
            args.resource === "stratmaps"
                ? "stratmaps"
                : args.resource === "topic-presets"
                  ? "topicPresets"
                  : "squadPresets"
        const current = args.presetId ? await ctx.db.get(args.presetId) : null
        const resourceMatches =
            current &&
            (args.resource === "stratmaps"
                ? "state" in current && "title" in current
                : args.resource === "topic-presets"
                  ? "topics" in current
                  : "squads" in current)
        let status = args.operation === "create" ? 201 : 200
        let response: Record<string, unknown>
        if (
            args.operation === "update" &&
            (!current || !resourceMatches || current.guildId !== key.guildId)
        ) {
            status = 404
            response = {
                error: { code: "not_found", message: "Preset not found." },
            }
        } else {
            try {
                const payload = args.payload as Record<string, unknown>
                let value: Record<string, unknown>
                if (args.resource === "stratmaps") {
                    const stratmap = current as
                        | (typeof current & {
                              gameId?:
                                  | "hell_let_loose"
                                  | "hell_let_loose_vietnam"
                                  | "wardogs"
                              state?: string
                          })
                        | null
                    const eventId =
                        typeof payload.eventId === "string" && payload.eventId
                            ? (payload.eventId as Id<"events">)
                            : undefined
                    const event = eventId ? await ctx.db.get(eventId) : null
                    const gameId =
                        stratmap?.gameId ??
                        (payload.gameId as
                            | "hell_let_loose"
                            | "hell_let_loose_vietnam"
                            | "wardogs"
                            | undefined) ??
                        "hell_let_loose"
                    if (eventId && !event)
                        throw new Error("Referenced event was not found.")
                    if (event && event.guildId !== key.guildId)
                        throw new Error("Referenced event was not found.")
                    if (
                        event &&
                        gameId &&
                        resolveGameScope(event.gameId) !==
                            resolveGameScope(gameId)
                    )
                        throw new Error(
                            "Referenced event must use the same game as the stratmap."
                        )
                    if (
                        args.operation === "update" &&
                        payload.gameId !== undefined &&
                        resolveGameScope(stratmap!.gameId) !==
                            resolveGameScope(
                                payload.gameId as
                                    | "hell_let_loose"
                                    | "hell_let_loose_vietnam"
                                    | "wardogs"
                            )
                    )
                        throw new Error("A stratmap game cannot be changed.")
                    const title = String(payload.title ?? "").trim()
                    const baseMapId = String(payload.baseMapId ?? "").trim()
                    if (!title || !baseMapId)
                        throw new Error(
                            "Stratmap title and base map are required."
                        )
                    const state =
                        typeof payload.state === "string"
                            ? payload.state
                            : (stratmap?.state ??
                              stringifyStratmapState(
                                  buildDefaultStratmapState(baseMapId)
                              ))
                    value = {
                        gameId,
                        eventId,
                        title,
                        description:
                            typeof payload.description === "string" &&
                            payload.description.trim()
                                ? payload.description.trim()
                                : undefined,
                        baseMapId,
                        side:
                            typeof payload.side === "string" &&
                            payload.side.trim()
                                ? payload.side.trim()
                                : undefined,
                        strongpointId:
                            typeof payload.strongpointId === "string" &&
                            payload.strongpointId.trim()
                                ? payload.strongpointId.trim()
                                : undefined,
                        state,
                    }
                } else if (args.resource === "topic-presets") {
                    const name = String(payload.name ?? "").trim()
                    const topics = Array.isArray(payload.topics)
                        ? payload.topics
                        : []
                    if (
                        !name ||
                        !topics.length ||
                        topics.some(
                            (topic) =>
                                !topic ||
                                typeof topic !== "object" ||
                                !String(
                                    (topic as { title?: unknown }).title ?? ""
                                ).trim()
                        )
                    )
                        throw new Error(
                            "Preset name and at least one named topic are required."
                        )
                    value = {
                        name,
                        side:
                            typeof payload.side === "string" &&
                            payload.side.trim()
                                ? payload.side.trim()
                                : undefined,
                        map:
                            typeof payload.map === "string" &&
                            payload.map.trim()
                                ? payload.map.trim()
                                : undefined,
                        cap:
                            typeof payload.cap === "string" &&
                            payload.cap.trim()
                                ? payload.cap.trim()
                                : undefined,
                        notes:
                            typeof payload.notes === "string" &&
                            payload.notes.trim()
                                ? payload.notes.trim()
                                : undefined,
                        topics,
                    }
                } else {
                    const name = String(payload.name ?? "").trim()
                    const squads = Array.isArray(payload.squads)
                        ? payload.squads
                        : []
                    if (!name || !squads.length)
                        throw new Error(
                            "Preset name and at least one squad are required."
                        )
                    value = { name, squads }
                }
                if (current) {
                    await ctx.db.patch(current._id, {
                        ...value,
                        updatedAt: createdAt,
                    })
                    response = {
                        data: apiDocument({
                            ...current,
                            ...value,
                            updatedAt: createdAt,
                        }),
                    }
                } else {
                    const id = await ctx.db.insert(table, {
                        guildId: key.guildId,
                        ...(args.resource === "stratmaps"
                            ? { createdBy: `api:${key._id}` }
                            : {}),
                        ...value,
                        createdAt,
                        updatedAt: createdAt,
                    } as never)
                    response = {
                        data: {
                            id: String(id),
                            guildId: key.guildId,
                            ...(args.resource === "stratmaps"
                                ? { createdBy: `api:${key._id}` }
                                : {}),
                            ...value,
                            createdAt,
                            updatedAt: createdAt,
                        },
                    }
                }
            } catch (error) {
                status = 400
                response = {
                    error: {
                        code: "validation_error",
                        message:
                            error instanceof Error
                                ? error.message
                                : "Unable to save preset.",
                    },
                }
            }
        }
        const body = JSON.stringify(response)
        await ctx.db.patch(idempotencyId, { status, responseBody: body })
        return { status, body }
    },
})

const assignmentType = v.union(
    v.literal("member"),
    v.literal("reserve_member"),
    v.literal("mercenary")
)
const assignmentStatus = v.union(
    v.literal("pending"),
    v.literal("recruit"),
    v.literal("active")
)

async function hasAffectedRoster(
    ctx: MutationCtx,
    guildId: string,
    gameId?: "hell_let_loose" | "hell_let_loose_vietnam" | "wardogs"
) {
    const now = Date.now()
    const events = await ctx.db
        .query("events")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .collect()
    for (const event of events) {
        if (
            (event.kind ?? "match") !== "match" ||
            (gameId && resolveGameScope(event.gameId) !== gameId) ||
            Date.parse(event.registrationEnd) <= now
        )
            continue
        if (
            await ctx.db
                .query("rosters")
                .withIndex("eventId", (q) => q.eq("eventId", event._id))
                .unique()
        )
            return true
    }
    return false
}

export const mutateClanRoster = mutation({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        idempotencyKey: v.string(),
        bodyHash: v.string(),
        methodPath: v.string(),
        operation: v.union(v.literal("update"), v.literal("delete")),
        rosterId: v.id("rosters"),
        payload: v.optional(v.any()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const idempotency = await startIdempotentMutation(ctx, args)
        if (idempotency.kind === "unauthorized") return null
        if (idempotency.kind === "complete") return idempotency.result
        const { key, idempotencyId, createdAt } = idempotency
        const roster = await ctx.db.get(args.rosterId)
        const event = roster ? await ctx.db.get(roster.eventId) : null
        let status = 200
        let response: Record<string, unknown>
        if (!roster || !event || event.guildId !== key.guildId) {
            status = 404
            response = {
                error: { code: "not_found", message: "Roster not found." },
            }
        } else if (args.operation === "delete") {
            if (roster.published) {
                status = 400
                response = {
                    error: {
                        code: "validation_error",
                        message: "Published rosters cannot be deleted.",
                    },
                }
            } else {
                await ctx.db.delete(roster._id)
                response = { data: { id: String(roster._id), deleted: true } }
            }
        } else {
            try {
                const payload = args.payload as Record<string, unknown>
                if (payload.eventId !== String(roster.eventId))
                    throw new Error(
                        "A roster cannot be moved to another event."
                    )
                if (payload.squadPresetId) {
                    const preset = await ctx.db.get(
                        payload.squadPresetId as Id<"squadPresets">
                    )
                    if (!preset || preset.guildId !== key.guildId)
                        throw new Error("Squad preset not found.")
                }
                await new UpsertRosterUseCase(
                    new ConvexRosterCommandRepository(ctx)
                ).execute({
                    rosterId: String(roster._id),
                    eventId: String(roster.eventId),
                    squadPresetId: payload.squadPresetId as string | undefined,
                    squads: payload.squads as never,
                    reservePlayerIds: payload.reservePlayerIds as string[],
                    reserveAttendances: payload.reserveAttendances as never,
                    notAttendingPlayerIds:
                        payload.notAttendingPlayerIds as string[],
                    streamerId: payload.streamerId as string | undefined,
                    published: payload.published as boolean,
                })
                const saved = await ctx.db.get(roster._id)
                response = { data: apiDocument(saved!) }
            } catch (error) {
                status = 400
                response = {
                    error: {
                        code: "validation_error",
                        message:
                            error instanceof Error
                                ? error.message
                                : "Unable to save roster.",
                    },
                }
            }
        }
        if (status < 300)
            await enqueueClanWebhook(ctx, {
                guildId: key.guildId,
                eventType: "roster.updated",
                createdAt,
                resource: response.data as Record<string, unknown>,
            })
        const body = JSON.stringify(response)
        await ctx.db.patch(idempotencyId, { status, responseBody: body })
        return { status, body }
    },
})

export const mutateClanAssignment = mutation({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        idempotencyKey: v.string(),
        bodyHash: v.string(),
        methodPath: v.string(),
        operation: v.union(
            v.literal("create"),
            v.literal("update"),
            v.literal("delete")
        ),
        assignmentId: v.optional(v.id("userAssignments")),
        userId: v.optional(v.string()),
        gameId: v.optional(
            v.union(
                v.literal("hell_let_loose"),
                v.literal("hell_let_loose_vietnam"),
                v.literal("wardogs")
            )
        ),
        type: v.optional(assignmentType),
        status: v.optional(assignmentStatus),
        primaryGroupId: v.optional(v.id("groups")),
        secondaryGroupIds: v.optional(v.array(v.id("groups"))),
        paused: v.optional(v.boolean()),
        pausedNote: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const idempotency = await startIdempotentMutation(ctx, args)
        if (idempotency.kind === "unauthorized") return null
        if (idempotency.kind === "complete") return idempotency.result
        const { key, idempotencyId, createdAt } = idempotency
        const current = args.assignmentId
            ? await ctx.db.get(args.assignmentId)
            : null
        let status = args.operation === "create" ? 201 : 200
        let response: Record<string, unknown>
        if (
            args.operation !== "create" &&
            (!current || current.serverId !== key.guildId)
        ) {
            status = 404
            response = {
                error: { code: "not_found", message: "Assignment not found." },
            }
        } else {
            try {
                const gameId =
                    args.operation === "delete" ? current?.gameId : args.gameId
                const affectsRoster = await hasAffectedRoster(
                    ctx,
                    key.guildId,
                    gameId
                )
                const repository = new ConvexAssignmentCommandRepository(ctx)
                const rosterSync = new ConvexAssignmentRosterSyncPort(ctx)
                if (args.operation === "delete") {
                    await new RemoveAssignmentUseCase(
                        repository,
                        rosterSync,
                        systemClock
                    ).execute(String(args.assignmentId))
                    response = {
                        data: { id: String(args.assignmentId), deleted: true },
                    }
                } else {
                    if (
                        !args.userId ||
                        !args.type ||
                        !args.status ||
                        args.paused === undefined
                    )
                        throw new Error(
                            "userId, type, status, and paused are required."
                        )
                    if (
                        args.operation === "update" &&
                        args.userId !== current!.userId
                    )
                        throw new Error(
                            "An assignment cannot be moved to another user."
                        )
                    if (
                        args.operation === "update" &&
                        args.gameId !== undefined &&
                        resolveGameScope(args.gameId) !==
                            resolveGameScope(current!.gameId)
                    )
                        throw new Error(
                            "An assignment cannot be moved to another game."
                        )
                    const assignmentId = await new UpsertAssignmentUseCase(
                        repository,
                        rosterSync,
                        systemClock
                    ).execute({
                        assignmentId:
                            args.operation === "update"
                                ? String(args.assignmentId)
                                : undefined,
                        userId: args.userId,
                        serverDiscordId: key.guildId,
                        gameId:
                            args.operation === "update"
                                ? current!.gameId
                                : args.gameId,
                        type: args.type,
                        status: args.status,
                        primaryGroupId: args.primaryGroupId
                            ? String(args.primaryGroupId)
                            : undefined,
                        secondaryGroupIds: (args.secondaryGroupIds ?? []).map(
                            String
                        ),
                        paused: args.paused,
                        pausedNote: args.pausedNote,
                    })
                    const saved = await ctx.db.get(
                        assignmentId as Id<"userAssignments">
                    )
                    response = { data: apiDocument(saved!) }
                }
                if (affectsRoster)
                    await enqueueClanWebhook(ctx, {
                        guildId: key.guildId,
                        eventType: "roster.updated",
                        createdAt,
                        resource: response.data as Record<string, unknown>,
                    })
            } catch (error) {
                status = 400
                response = {
                    error: {
                        code: "validation_error",
                        message:
                            error instanceof Error
                                ? error.message
                                : "Unable to save assignment.",
                    },
                }
            }
        }
        const body = JSON.stringify(response)
        await ctx.db.patch(idempotencyId, { status, responseBody: body })
        return { status, body }
    },
})

export const mutateClanCalendarItem = mutation({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        idempotencyKey: v.string(),
        bodyHash: v.string(),
        methodPath: v.string(),
        operation: v.union(
            v.literal("create"),
            v.literal("update"),
            v.literal("delete")
        ),
        calendarItemId: v.optional(v.id("calendarItems")),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        color: v.optional(v.string()),
        emoji: v.optional(v.string()),
        label: v.optional(v.string()),
        startAt: v.optional(v.string()),
        endAt: v.optional(v.string()),
        allDay: v.optional(v.boolean()),
        recurrence: v.optional(calendarRecurrence),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const idempotency = await startIdempotentMutation(ctx, args)
        if (idempotency.kind === "unauthorized") return null
        if (idempotency.kind === "complete") return idempotency.result
        const { key, idempotencyId, createdAt } = idempotency
        const item = args.calendarItemId
            ? await ctx.db.get(args.calendarItemId)
            : null
        let status = 200
        let response: Record<string, unknown>
        if (
            args.operation !== "create" &&
            (!item || item.guildId !== key.guildId)
        ) {
            status = 404
            response = {
                error: {
                    code: "not_found",
                    message: "Calendar item not found.",
                },
            }
        } else if (args.operation === "delete") {
            await ctx.db.delete(item!._id)
            response = { data: { id: String(item!._id), deleted: true } }
        } else {
            const title = args.title?.trim() ?? ""
            const color = args.color
            const startAt = args.startAt
            const endAt = args.endAt
            if (
                !title ||
                !color ||
                !/^#[0-9A-Fa-f]{6}$/.test(color) ||
                !startAt ||
                !endAt ||
                Number.isNaN(Date.parse(startAt)) ||
                Number.isNaN(Date.parse(endAt)) ||
                Date.parse(endAt) < Date.parse(startAt) ||
                args.allDay === undefined ||
                (args.recurrence &&
                    (!Number.isInteger(args.recurrence.interval) ||
                        args.recurrence.interval < 1 ||
                        (args.recurrence.until &&
                            Number.isNaN(Date.parse(args.recurrence.until)))))
            ) {
                status = 400
                response = {
                    error: {
                        code: "validation_error",
                        message:
                            "title, color, valid start/end times, and allDay are required.",
                    },
                }
            } else {
                const value = {
                    title,
                    description: args.description?.trim() || undefined,
                    color,
                    emoji: args.emoji?.trim() || undefined,
                    label: args.label?.trim() || undefined,
                    startAt,
                    endAt,
                    allDay: args.allDay,
                    recurrence: args.recurrence,
                }
                if (item) {
                    await ctx.db.patch(item._id, {
                        ...value,
                        updatedAt: createdAt,
                    })
                    response = {
                        data: apiDocument({
                            ...item,
                            ...value,
                            updatedAt: createdAt,
                        }),
                    }
                } else {
                    const calendarItemId = await ctx.db.insert(
                        "calendarItems",
                        {
                            guildId: key.guildId,
                            ...value,
                            createdAt,
                            updatedAt: createdAt,
                        }
                    )
                    response = {
                        data: {
                            id: String(calendarItemId),
                            guildId: key.guildId,
                            ...value,
                            createdAt,
                            updatedAt: createdAt,
                        },
                    }
                    status = 201
                }
            }
        }
        const responseBody = JSON.stringify(response!)
        await ctx.db.patch(idempotencyId, { status, responseBody })
        return { status, body: responseBody }
    },
})

/** Authenticates a hash only; callers never receive a bearer key or its hash. */
export const authenticateKey = mutation({
    args: { secret: v.string(), keyHash: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
            .unique()
        if (!key || key.revokedAt) return null
        const guild = await getGuildByDiscordId(ctx, key.guildId)
        if (!guild) return null
        // Usage telemetry must not alter authorization; this best-effort write is
        // deliberately separate from every resource read.
        await ctx.db.patch(key._id, { lastUsedAt: new Date().toISOString() })
        return {
            guildId: key.guildId,
        }
    },
})

/** A deliberately small, authenticated sync marker and count projection. */
export const getClanMeta = query({
    args: { secret: v.string(), keyHash: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
            .unique()
        if (!key || key.revokedAt) return null
        const guild = await getGuildByDiscordId(ctx, key.guildId)
        if (!guild) return null
        const guildId = key.guildId
        const events = await ctx.db
            .query("events")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect()
        const [
            groups,
            assignments,
            calendarItems,
            stratmaps,
            topicPresets,
            squadPresets,
            matches,
            articles,
            apiKeys,
            enabledGames,
        ] = await Promise.all([
            ctx.db
                .query("groups")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect(),
            ctx.db
                .query("userAssignments")
                .withIndex("serverId", (q) => q.eq("serverId", guildId))
                .collect(),
            ctx.db
                .query("calendarItems")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect(),
            ctx.db
                .query("stratmaps")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect(),
            ctx.db
                .query("topicPresets")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect(),
            ctx.db
                .query("squadPresets")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect(),
            ctx.db
                .query("matchStats")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect(),
            ctx.db
                .query("articles")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect(),
            ctx.db
                .query("apiKeys")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect(),
            ctx.db
                .query("guildGames")
                .filter((q) => q.eq(q.field("guildId"), guildId))
                .collect(),
        ])
        const rosters = await Promise.all(
            events.map((event) =>
                ctx.db
                    .query("rosters")
                    .withIndex("eventId", (q) => q.eq("eventId", event._id))
                    .unique()
            )
        )
        return {
            guild: { id: String(guild._id), guildId, name: guild.name },
            enabledGames: enabledGames
                .filter((entry) => entry.enabled)
                .map((entry) => entry.gameId),
            counts: {
                events: events.length,
                groups: groups.length,
                rosters: rosters.filter(Boolean).length,
                assignments: assignments.length,
                users: new Set(assignments.map((entry) => entry.userId)).size,
                "calendar-items": calendarItems.length,
                stratmaps: stratmaps.length,
                "topic-presets": topicPresets.length,
                "squad-presets": squadPresets.length,
                matches: matches.length,
                articles: articles.length,
                settings: 1,
                "api-keys": apiKeys.length,
            },
            updatedAt: guild.updatedAt,
        }
    },
})

export const getClanSettings = query({
    args: { secret: v.string(), keyHash: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
            .unique()
        if (!key || key.revokedAt) return null
        const [guild, discordConfig] = await Promise.all([
            getGuildByDiscordId(ctx, key.guildId),
            ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", key.guildId))
                .unique(),
        ])
        if (!guild) return null
        const safeDiscordConfig = discordConfig
            ? (() => {
                  const {
                      playerStatsServers: _playerStatsServers,
                      gameOverrides,
                      ...config
                  } = discordConfig
                  return {
                      ...config,
                      id: String(discordConfig._id),
                      ...(gameOverrides
                          ? {
                                gameOverrides: Object.fromEntries(
                                    Object.entries(gameOverrides).map(
                                        ([gameId, override]) => {
                                            const {
                                                playerStatsServers: _tokens,
                                                ...safeOverride
                                            } = override
                                            return [gameId, safeOverride]
                                        }
                                    )
                                ),
                            }
                          : {}),
                  }
              })()
            : null
        return {
            guild: { ...guild, id: String(guild._id) },
            discordConfig: safeDiscordConfig,
        }
    },
})

/** Applies only explicit safe settings fields; omitted fields are preserved. */
export const mutateClanSettings = mutation({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        idempotencyKey: v.string(),
        bodyHash: v.string(),
        methodPath: v.string(),
        name: v.optional(v.string()),
        avatar: v.optional(v.string()),
        description: v.optional(v.union(v.string(), v.null())),
        timezone: v.optional(v.string()),
        defaultLanguage: v.optional(
            v.union(v.literal("en"), v.literal("cs"), v.literal("de"))
        ),
        announcementsChannelId: v.optional(v.union(v.string(), v.null())),
        eventInfoChannelId: v.optional(v.union(v.string(), v.null())),
        errorsChannelId: v.optional(v.union(v.string(), v.null())),
        calendarChannelId: v.optional(v.union(v.string(), v.null())),
        forumCategoryId: v.optional(v.union(v.string(), v.null())),
        meetingChannelId: v.optional(v.union(v.string(), v.null())),
        clanRoleId: v.optional(v.union(v.string(), v.null())),
        dashboardAdminRoleId: v.optional(v.union(v.string(), v.null())),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const idempotency = await startIdempotentMutation(ctx, args)
        if (idempotency.kind === "unauthorized") return null
        if (idempotency.kind === "complete") return idempotency.result
        const { key, idempotencyId, createdAt: now } = idempotency
        const guild = await getGuildByDiscordId(ctx, key.guildId)
        let status = 200
        let response: Record<string, unknown> | undefined
        if (!guild) {
            status = 404
            response = {
                error: { code: "not_found", message: "Settings not found." },
            }
        } else {
            const config = await ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", key.guildId))
                .unique()
            const hasDiscordPatch = [
                args.timezone,
                args.defaultLanguage,
                args.announcementsChannelId,
                args.eventInfoChannelId,
                args.errorsChannelId,
                args.calendarChannelId,
                args.forumCategoryId,
                args.meetingChannelId,
                args.clanRoleId,
                args.dashboardAdminRoleId,
            ].some((value) => value !== undefined)
            if (hasDiscordPatch && !config) {
                status = 400
                response = {
                    error: {
                        code: "validation_error",
                        message:
                            "Discord configuration has not been initialized.",
                    },
                }
            }
            const guildPatch: Record<string, string | undefined> = {}
            if (args.name !== undefined) guildPatch.name = args.name.trim()
            if (args.avatar !== undefined)
                guildPatch.avatar = args.avatar.trim()
            if (args.description !== undefined)
                guildPatch.description = args.description?.trim() || undefined
            if (!response && Object.keys(guildPatch).length)
                await ctx.db.patch(guild._id, { ...guildPatch, updatedAt: now })
            const fields = [
                "announcementsChannelId",
                "eventInfoChannelId",
                "errorsChannelId",
                "calendarChannelId",
                "forumCategoryId",
                "meetingChannelId",
                "clanRoleId",
                "dashboardAdminRoleId",
            ] as const
            const discordPatch = Object.fromEntries(
                fields.flatMap((field) =>
                    args[field] === undefined
                        ? []
                        : [[field, args[field]?.trim() || undefined]]
                )
            )
            if (args.timezone !== undefined)
                Object.assign(discordPatch, { timezone: args.timezone.trim() })
            if (args.defaultLanguage !== undefined)
                Object.assign(discordPatch, {
                    defaultLanguage: args.defaultLanguage,
                })
            if (!response && Object.keys(discordPatch).length && config)
                await ctx.db.patch(config._id, {
                    ...discordPatch,
                    updatedAt: now,
                })
            if (!response!) {
                const updatedGuild = await ctx.db.get(guild._id)
                const updatedConfig = config
                    ? await ctx.db.get(config._id)
                    : null
                const safeDiscordConfig = updatedConfig
                    ? (() => {
                          const {
                              playerStatsServers: _playerStatsServers,
                              gameOverrides,
                              ...safeConfig
                          } = updatedConfig
                          return {
                              ...safeConfig,
                              id: String(updatedConfig._id),
                              ...(gameOverrides
                                  ? {
                                        gameOverrides: Object.fromEntries(
                                            Object.entries(gameOverrides).map(
                                                ([gameId, override]) => {
                                                    const {
                                                        playerStatsServers:
                                                            _tokens,
                                                        ...safeOverride
                                                    } = override
                                                    return [
                                                        gameId,
                                                        safeOverride,
                                                    ]
                                                }
                                            )
                                        ),
                                    }
                                  : {}),
                          }
                      })()
                    : null
                response = {
                    data: {
                        guild: updatedGuild
                            ? { ...updatedGuild, id: String(updatedGuild._id) }
                            : null,
                        discordConfig: safeDiscordConfig,
                    },
                }
                await enqueueClanWebhook(ctx, {
                    guildId: key.guildId,
                    eventType: "settings.updated",
                    createdAt: now,
                    resource: response.data,
                })
            }
        }
        if (!response)
            throw new Error("Settings mutation did not produce a response.")
        const body = JSON.stringify(response)
        await ctx.db.patch(idempotencyId, { status, responseBody: body })
        return { status, body }
    },
})

const apiResource = v.union(
    v.literal("events"),
    v.literal("groups"),
    v.literal("rosters"),
    v.literal("assignments"),
    v.literal("calendar-items"),
    v.literal("stratmaps"),
    v.literal("topic-presets"),
    v.literal("squad-presets"),
    v.literal("matches"),
    v.literal("articles"),
    v.literal("users")
)
const apiGameScope = v.union(
    v.literal("hell_let_loose"),
    v.literal("hell_let_loose_vietnam"),
    v.literal("wardogs"),
    v.literal("all")
)
const apiGameSelection = v.union(
    apiGameScope,
    v.array(
        v.union(
            v.literal("hell_let_loose"),
            v.literal("hell_let_loose_vietnam"),
            v.literal("wardogs")
        )
    )
)

export const getClanPerformanceHistory = query({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        game: apiGameSelection,
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
            .unique()
        if (!key || key.revokedAt) return null
        const history = await ctx.db
            .query("guildPerformanceHistory")
            .withIndex("guildId", (q) => q.eq("guildId", key.guildId))
            .unique()
        if (!history) return { matches: [], updatedAt: null }
        return {
            matches: history.matches
                .filter((match) => matchesGameScope(match.gameId, args.game))
                .map((match) => ({
                    ...match,
                    gameId: resolveGameScope(match.gameId),
                })),
            updatedAt: history.updatedAt,
        }
    },
})

export const getClanMatchByEvent = query({
    args: { secret: v.string(), keyHash: v.string(), eventId: v.id("events") },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
            .unique()
        if (!key || key.revokedAt) return null
        const event = await ctx.db.get(args.eventId)
        if (!event || event.guildId !== key.guildId) return null
        const match = await ctx.db
            .query("matchStats")
            .withIndex("eventId", (q) => q.eq("eventId", event._id))
            .unique()
        return match
            ? {
                  ...apiDocument(match),
                  eventId: String(event._id),
                  gameId: resolveGameScope(match.gameId),
              }
            : null
    },
})

export const getClanUser = query({
    args: { secret: v.string(), keyHash: v.string(), userId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
            .unique()
        if (!key || key.revokedAt) return null
        const assignment = await ctx.db
            .query("userAssignments")
            .withIndex("serverId_userId", (q) =>
                q.eq("serverId", key.guildId).eq("userId", args.userId)
            )
            .first()
        if (!assignment) return null
        const user = await ctx.db
            .query("users")
            .withIndex("discordId", (q) => q.eq("discordId", args.userId))
            .unique()
        return user ? apiDocument(user) : null
    },
})

function apiDocument<T extends { _id: unknown; gameId?: unknown }>(
    document: T
) {
    return {
        ...document,
        id: String(document._id),
        ...(Object.prototype.hasOwnProperty.call(document, "gameId")
            ? { gameId: resolveGameScope(document.gameId as never) }
            : {}),
    }
}

function apiGameDocument<T extends { _id: unknown; gameId?: unknown }>(
    document: T
) {
    return {
        ...apiDocument(document),
        gameId: resolveGameScope(document.gameId as never),
    }
}

function belongsToGame(
    document: { gameId?: never },
    game: string | readonly string[]
) {
    return matchesGameScope(document.gameId as never, game as never)
}

/**
 * A bounded, authenticated page for exactly one clan concern. This intentionally
 * replaces getClanData: no endpoint may load a clan's entire database.
 */
export const getClanResourcePage = query({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        resource: apiResource,
        game: apiGameSelection,
        cursor: v.union(v.string(), v.null()),
        limit: v.number(),
        updatedSince: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
            .unique()
        if (!key || key.revokedAt) return null
        const guildId = key.guildId
        const options = { cursor: args.cursor, numItems: args.limit }
        const pageFor = async (query: {
            paginate: (value: typeof options) => Promise<{
                page: Array<Record<string, unknown>>
                continueCursor: string
                isDone: boolean
            }>
        }) => {
            const result = await query.paginate(options)
            return {
                items: result.page
                    .filter((item) => belongsToGame(item as never, args.game))
                    .map((item) =>
                        [
                            "events",
                            "groups",
                            "rosters",
                            "assignments",
                            "stratmaps",
                            "matches",
                        ].includes(args.resource)
                            ? apiGameDocument(item as never)
                            : apiDocument(item as never)
                    ),
                nextCursor: result.isDone ? null : result.continueCursor,
                limit: args.limit,
            }
        }
        switch (args.resource) {
            case "events":
                return await pageFor(
                    args.updatedSince
                        ? ctx.db
                              .query("events")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                              .filter((q) =>
                                  q.gte(
                                      q.field("updatedAt"),
                                      args.updatedSince!
                                  )
                              )
                        : ctx.db
                              .query("events")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                )
            case "groups":
                return await pageFor(
                    args.updatedSince
                        ? ctx.db
                              .query("groups")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                              .filter((q) =>
                                  q.gte(
                                      q.field("updatedAt"),
                                      args.updatedSince!
                                  )
                              )
                        : ctx.db
                              .query("groups")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                )
            case "assignments":
                return await pageFor(
                    args.updatedSince
                        ? ctx.db
                              .query("userAssignments")
                              .withIndex("serverId", (q) =>
                                  q.eq("serverId", guildId)
                              )
                              .filter((q) =>
                                  q.gte(
                                      q.field("updatedAt"),
                                      args.updatedSince!
                                  )
                              )
                        : ctx.db
                              .query("userAssignments")
                              .withIndex("serverId", (q) =>
                                  q.eq("serverId", guildId)
                              )
                )
            case "calendar-items":
                return await pageFor(
                    args.updatedSince
                        ? ctx.db
                              .query("calendarItems")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                              .filter((q) =>
                                  q.gte(
                                      q.field("updatedAt"),
                                      args.updatedSince!
                                  )
                              )
                        : ctx.db
                              .query("calendarItems")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                )
            case "stratmaps":
                return await pageFor(
                    args.updatedSince
                        ? ctx.db
                              .query("stratmaps")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                              .filter((q) =>
                                  q.gte(
                                      q.field("updatedAt"),
                                      args.updatedSince!
                                  )
                              )
                        : ctx.db
                              .query("stratmaps")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                )
            case "topic-presets":
                return await pageFor(
                    args.updatedSince
                        ? ctx.db
                              .query("topicPresets")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                              .filter((q) =>
                                  q.gte(
                                      q.field("updatedAt"),
                                      args.updatedSince!
                                  )
                              )
                        : ctx.db
                              .query("topicPresets")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                )
            case "squad-presets":
                return await pageFor(
                    args.updatedSince
                        ? ctx.db
                              .query("squadPresets")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                              .filter((q) =>
                                  q.gte(
                                      q.field("updatedAt"),
                                      args.updatedSince!
                                  )
                              )
                        : ctx.db
                              .query("squadPresets")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                )
            case "matches":
                return await pageFor(
                    args.updatedSince
                        ? ctx.db
                              .query("matchStats")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                              .filter((q) =>
                                  q.gte(
                                      q.field("updatedAt"),
                                      args.updatedSince!
                                  )
                              )
                        : ctx.db
                              .query("matchStats")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                )
            case "articles":
                return await pageFor(
                    args.updatedSince
                        ? ctx.db
                              .query("articles")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                              .filter((q) =>
                                  q.gte(
                                      q.field("updatedAt"),
                                      args.updatedSince!
                                  )
                              )
                        : ctx.db
                              .query("articles")
                              .withIndex("guildId", (q) =>
                                  q.eq("guildId", guildId)
                              )
                )
            case "rosters": {
                const rosterPage = await (
                    args.updatedSince
                        ? ctx.db
                              .query("rosters")
                              .withIndex("guildId_updatedAt", (q) =>
                                  q
                                      .eq("guildId", guildId)
                                      .gte("updatedAt", args.updatedSince!)
                              )
                        : ctx.db
                              .query("rosters")
                              .withIndex("guildId_updatedAt", (q) =>
                                  q.eq("guildId", guildId)
                              )
                ).paginate(options)
                const events = await Promise.all(
                    rosterPage.page.map((roster) => ctx.db.get(roster.eventId))
                )
                return {
                    items: rosterPage.page.flatMap((roster, index) => {
                        const event = events[index]
                        if (!event || !belongsToGame(event as never, args.game))
                            return []
                        return [
                            {
                                ...apiDocument(roster),
                                gameId: resolveGameScope(event.gameId),
                            },
                        ]
                    }),
                    nextCursor: rosterPage.isDone
                        ? null
                        : rosterPage.continueCursor,
                    limit: args.limit,
                }
            }
            case "users": {
                const projectionPage = await (
                    args.updatedSince
                        ? ctx.db
                              .query("clanApiUserProjections")
                              .withIndex("guildId_updatedAt", (q) =>
                                  q
                                      .eq("guildId", guildId)
                                      .gte("updatedAt", args.updatedSince!)
                              )
                        : ctx.db
                              .query("clanApiUserProjections")
                              .withIndex("guildId_updatedAt", (q) =>
                                  q.eq("guildId", guildId)
                              )
                ).paginate(options)
                const users = await Promise.all(
                    projectionPage.page.map((projection) =>
                        ctx.db
                            .query("users")
                            .withIndex("discordId", (q) =>
                                q.eq("discordId", projection.userId)
                            )
                            .unique()
                    )
                )
                return {
                    items: users
                        .filter(Boolean)
                        .map((user) => apiDocument(user!)),
                    nextCursor: projectionPage.isDone
                        ? null
                        : projectionPage.continueCursor,
                    limit: args.limit,
                }
            }
        }
    },
})

/** Returns a single record only after proving its direct or parent ownership. */
export const getClanResource = query({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        resource: apiResource,
        id: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
            .unique()
        if (!key || key.revokedAt) return null
        const item = (await ctx.db.get(args.id as never)) as
            (Record<string, unknown> & { _id: unknown }) | null
        if (!item) return null
        if (!isClanApiResourceDocument(args.resource, item)) return null
        const guildId = key.guildId
        const directGuildId =
            typeof item.guildId === "string"
                ? item.guildId
                : typeof item.serverId === "string"
                  ? item.serverId
                  : undefined
        if (directGuildId !== guildId) {
            if (args.resource === "rosters") {
                const event = await ctx.db.get(item.eventId as Id<"events">)
                if (!event || event.guildId !== guildId) return null
                return {
                    ...apiDocument(item),
                    gameId: resolveGameScope(event.gameId),
                }
            }
            if (args.resource === "users") {
                const userId =
                    typeof item.discordId === "string"
                        ? item.discordId
                        : typeof item.id === "string"
                          ? item.id
                          : ""
                const assignment = await ctx.db
                    .query("userAssignments")
                    .withIndex("serverId", (q) => q.eq("serverId", guildId))
                    .filter((q) => q.eq(q.field("userId"), userId))
                    .first()
                if (!assignment) return null
            } else return null
        }
        return [
            "events",
            "groups",
            "rosters",
            "assignments",
            "stratmaps",
            "matches",
        ].includes(args.resource)
            ? apiGameDocument(item)
            : apiDocument(item)
    },
})
