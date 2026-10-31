import {
    topicPresetRepository,
    squadPresetRepository,
} from "../src/infrastructure/convex/preset-repositories"
import {
    applyClanSettingsSlicePatches,
    readClanSettingsSlices,
} from "../src/domain/api/settings-slices"
import {
    apiDocument,
    assertInternalSecret,
    safeDiscordConfigOf,
} from "./publicApiShared"
import { ConvexCalendarItemRepository } from "../src/infrastructure/convex/calendar-item-repository"
import {
    saveTopicPreset,
    saveSquadPreset,
} from "../src/application/presets/save-preset"
import { ConvexStratmapRepository } from "../src/infrastructure/convex/stratmap-repository"
import { CalendarItemCommands } from "../src/application/calendar/calendar-item-commands"
import { ConvexArticleRepository } from "../src/infrastructure/convex/article-repository"
import { ConvexGroupRepository } from "../src/infrastructure/convex/group-repository"
import { ArticleCommands } from "../src/application/articles/article-commands"
import { CLAN_SETTINGS_SLICES } from "../src/domain/api/clan-settings-slices"
import { managedRolePolicy } from "../src/domain/membership/managed-roles"
import { stratmapMutationSchema } from "../src/domain/api/preset-mutation"
import { saveStratmap } from "../src/application/stratmaps/save-stratmap"
import { GroupCommands } from "../src/application/groups/group-commands"
import { wakeWebhookGuild, scheduleWebhookDrain } from "./webhookQueue"
import { topicPresetSchema } from "../src/lib/validation/topic-preset"
import { squadPresetSchema } from "../src/lib/validation/squad-preset"
import { prepareExternalClanSettings } from "./clanSettingsStores"
import { readExternalClanSettings } from "./clanSettingsReads"
import type { MutationCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { GAME_IDS } from "../src/domain/games/game"
import { mutation } from "./integrationMutation"
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
import { syncEventAssetReferences } from "../src/infrastructure/convex/event-asset-references"
import { ApplyEventScoreUseCase } from "../src/application/events/apply-event-score.use-case"
import { ConcludeEventUseCase } from "../src/application/events/conclude-event.use-case"
import { ToggleSignupUseCase } from "../src/application/events/toggle-signup.use-case"
import { UpsertEventUseCase } from "../src/application/events/upsert-event.use-case"
import { refreshEventSchedule } from "../src/infrastructure/convex/event-scheduling"
import type { EventUpsertCommand } from "../src/application/events/command-ports"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { rosterMutationSchema } from "../src/domain/api/roster-mutation"
import { ManageRoster } from "../src/application/rosters/manage-roster"
import { isApiKeyReadAccess } from "../src/domain/api/key-access"
import { currentEventStatus } from "../src/domain/events/status"
import { requestRegistrationAfterSave } from "./discordCommands"
import { resolveGameScope } from "../src/domain/games/game"
import { isDraftEvent } from "../src/domain/events/drafts"
import { startIdempotentMutation } from "./apiIdempotency"
import { systemClock } from "../src/domain/shared/clock"
import { DEFAULT_ROSTER_SCORE_SETTINGS } from "./guilds"
import { apiKeyReadAccess } from "./apiKeyValidators"
import { resolveEventMatchTeams } from "./matchTeams"
import { getGuildByDiscordId } from "./identity"

// The per-request reads of `/api/v1` live in `publicApiReads.ts`; only the
// idempotent writes and the key commands stay here, so a website read never
// evaluates the command use-cases or the stratmap catalogue.

export const createKey = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        actor: dashboardActor,
        name: v.string(),
        keyHash: v.string(),
        keyPrefix: v.string(),
        readAccess: v.optional(apiKeyReadAccess),
    },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        if (
            args.readAccess !== undefined &&
            !isApiKeyReadAccess(args.readAccess)
        )
            throw new Error("Invalid API key read access.")
        if (!(await getGuildByDiscordId(ctx, args.guildId)))
            throw new Error("Clan not found.")
        return await ctx.db.insert("apiKeys", {
            guildId: args.guildId,
            name: args.name.trim().slice(0, 80) || "Website",
            keyHash: args.keyHash,
            keyPrefix: args.keyPrefix,
            ...(args.readAccess !== undefined
                ? { readAccess: args.readAccess }
                : {}),
            createdAt: new Date().toISOString(),
        })
    },
})

export const revokeKey = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        keyId: v.id("apiKeys"),
        actor: dashboardActor,
    },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const key = await ctx.db.get(args.keyId)
        if (!key || key.guildId !== args.guildId)
            throw new Error("API key not found.")
        await ctx.db.patch(args.keyId, { revokedAt: new Date().toISOString() })
    },
})

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
                await new ArticleCommands(new ConvexArticleRepository(ctx), {
                    now: () => new Date(createdAt),
                }).remove(key.guildId, String(article._id))
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
                const commands = new ArticleCommands(
                    new ConvexArticleRepository(ctx),
                    { now: () => new Date(createdAt) }
                )
                const fields = {
                    title,
                    description,
                    body,
                    tags: args.tags ?? [],
                    attachments: args.attachments ?? [],
                    guildId: key.guildId,
                    authorId: `api:${key._id}`,
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
                        const saved = await commands.save({
                            ...fields,
                            articleId: String(article._id),
                        })
                        const {
                            id: _id,
                            guildId: _guild,
                            authorId: _author,
                            createdAt: _created,
                            ...value
                        } = saved
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
                    const saved = await commands.save(fields)
                    response = { data: saved }
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
    let enqueued = false
    for (const hook of hooks)
        if (hook.enabled && hook.eventTypes.includes(input.eventType)) {
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
            enqueued = true
        }
    if (enqueued) {
        await wakeWebhookGuild(ctx, input.guildId)
        await scheduleWebhookDrain(ctx)
    }
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
                (!current ||
                    current.guildId !== key.guildId ||
                    isDraftEvent(current))
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
                // Team selections are read-only for bearer-key event writes: an API
                // key alone is not a writing actor, so selections change only through
                // the actor-backed website event commands. A returned selection is
                // ignored like other stored fields; the saved one is kept and
                // re-validated against game or kind changes below.
                const { matchTeams: _readOnlyMatchTeams, ...event } =
                    args.event as Record<string, unknown>
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
                // "" clears the squad preset on an update; an ID must be this clan's.
                if (
                    typeof event.squadPresetId === "string" &&
                    event.squadPresetId.trim()
                ) {
                    const squadPresetId = ctx.db.normalizeId(
                        "squadPresets",
                        event.squadPresetId.trim()
                    )
                    const squadPreset = squadPresetId
                        ? await ctx.db.get(squadPresetId)
                        : null
                    if (!squadPreset || squadPreset.guildId !== key.guildId)
                        throw new Error(
                            "Referenced squad preset was not found."
                        )
                }
                const kept = await resolveEventMatchTeams(ctx, {
                    gameId:
                        (event as EventUpsertCommand).gameId ?? current?.gameId,
                    kind: (event as EventUpsertCommand).kind ?? current?.kind,
                    status: current ? currentEventStatus(current) : undefined,
                    inputs: undefined,
                    previous: current?.matchTeams,
                    now: new Date().toISOString(),
                })
                if (!kept.ok) throw new Error(`match_teams:${kept.error}`)
                const eventId = await new UpsertEventUseCase(
                    new ConvexEventCommandRepository(ctx),
                    new DelegatingEventScorePort((id) =>
                        applyEventScore(ctx, id)
                    ),
                    systemClock
                ).execute({
                    ...(event as EventUpsertCommand),
                    guildId: key.guildId,
                    matchTeams: kept.matchTeams,
                    ...(args.eventId ? { eventId: String(args.eventId) } : {}),
                })
                const written = await ctx.db.get(eventId as Id<"events">)
                if (written) await syncEventAssetReferences(ctx, written)
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
        if (!event || event.guildId !== key.guildId || isDraftEvent(event)) {
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
                v.literal("wardogs"),
                v.literal("world_of_warcraft_forever")
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
            await new GroupCommands(new ConvexGroupRepository(ctx), {
                now: () => new Date(createdAt),
            }).remove(key.guildId, String(group!._id))
            response = { data: { id: String(group!._id), deleted: true } }
        } else {
            const name = args.name?.trim() ?? ""
            const color = args.color
            const order = args.order
            if (!name || !color || typeof order !== "number") {
                status = 400
                response = {
                    error: {
                        code: "validation_error",
                        message:
                            "name, a #RRGGBB color, and an integer order are required.",
                    },
                }
            } else {
                try {
                    const saved = await new GroupCommands(
                        new ConvexGroupRepository(ctx),
                        { now: () => new Date(createdAt) }
                    ).save({
                        guildId: key.guildId,
                        groupId: group ? String(group._id) : undefined,
                        gameId: group?.gameId ?? args.gameId,
                        name,
                        color,
                        order,
                        parentId: args.parentId,
                        description: args.description?.trim() || undefined,
                        discordRoleId: args.discordRoleId,
                        discordEmoji: args.discordEmoji,
                    })
                    if (group) {
                        const { id: _id, ...fields } = saved
                        response = {
                            data: apiDocument({ ...group, ...fields }),
                        }
                    } else {
                        status = 201
                        response = {
                            data: {
                                ...saved,
                                gameId: resolveGameScope(saved.gameId),
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
                                    : "Unable to save group.",
                        },
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
                const binding = {
                    guildId: key.guildId,
                    presetId: current ? String(current._id) : undefined,
                }
                const clock = { now: () => new Date(createdAt) }
                if (args.resource === "stratmaps") {
                    const fields = stratmapMutationSchema.parse(args.payload)
                    const saved = await saveStratmap(
                        new ConvexStratmapRepository(ctx),
                        clock,
                        {
                            ...fields,
                            guildId: key.guildId,
                            stratmapId: binding.presetId,
                            createdBy: `api:${key._id}`,
                        }
                    )
                    response = {
                        data: current
                            ? apiDocument({ ...current, ...saved })
                            : saved,
                    }
                } else {
                    const saved =
                        args.resource === "topic-presets"
                            ? await saveTopicPreset(
                                  topicPresetRepository(ctx),
                                  clock,
                                  {
                                      ...topicPresetSchema.parse(args.payload),
                                      ...binding,
                                  }
                              )
                            : await saveSquadPreset(
                                  squadPresetRepository(ctx),
                                  clock,
                                  {
                                      ...squadPresetSchema.parse(args.payload),
                                      ...binding,
                                  }
                              )
                    response = {
                        data: current
                            ? apiDocument({ ...current, ...saved })
                            : saved,
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
    gameId?:
        | "hell_let_loose"
        | "hell_let_loose_vietnam"
        | "wardogs"
        | "world_of_warcraft_forever"
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
                await new ManageRoster(new ConvexRosterCommandRepository(ctx), {
                    now: () => new Date(createdAt),
                }).deleteDraft(String(roster._id), key.guildId)
                response = { data: { id: String(roster._id), deleted: true } }
            }
        } else {
            try {
                const payload = rosterMutationSchema.parse(args.payload)
                if (payload.eventId !== String(roster.eventId))
                    throw new Error(
                        "A roster cannot be moved to another event."
                    )
                await new ManageRoster(new ConvexRosterCommandRepository(ctx), {
                    now: () => new Date(createdAt),
                }).save({
                    ...payload,
                    rosterId: String(roster._id),
                    guildId: key.guildId,
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
                v.literal("wardogs"),
                v.literal("world_of_warcraft_forever")
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
                    gameId as never
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
            await new CalendarItemCommands(
                new ConvexCalendarItemRepository(ctx),
                { now: () => new Date(createdAt) }
            ).remove(key.guildId, String(item!._id))
            response = { data: { id: String(item!._id), deleted: true } }
        } else {
            const title = args.title?.trim() ?? ""
            const color = args.color
            const startAt = args.startAt
            const endAt = args.endAt
            if (
                !title ||
                !color ||
                !startAt ||
                !endAt ||
                args.allDay === undefined
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
                try {
                    const saved = await new CalendarItemCommands(
                        new ConvexCalendarItemRepository(ctx),
                        { now: () => new Date(createdAt) }
                    ).save({
                        guildId: key.guildId,
                        calendarItemId: item ? String(item._id) : undefined,
                        title,
                        color,
                        startAt,
                        endAt,
                        allDay: args.allDay,
                        recurrence: args.recurrence,
                        description: args.description,
                        emoji: args.emoji,
                        label: args.label,
                    })
                    if (item) {
                        const { id: _id, ...fields } = saved
                        response = { data: apiDocument({ ...item, ...fields }) }
                    } else {
                        response = { data: saved }
                        status = 201
                    }
                } catch (error) {
                    status = 400
                    response = {
                        error: {
                            code: "validation_error",
                            message:
                                error instanceof Error
                                    ? error.message
                                    : "Unable to save calendar item.",
                        },
                    }
                }
            }
        }
        const responseBody = JSON.stringify(response!)
        await ctx.db.patch(idempotencyId, { status, responseBody })
        return { status, body: responseBody }
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
        eventResultsChannelId: v.optional(v.union(v.string(), v.null())),
        errorsChannelId: v.optional(v.union(v.string(), v.null())),
        calendarChannelId: v.optional(v.union(v.string(), v.null())),
        forumCategoryId: v.optional(v.union(v.string(), v.null())),
        meetingChannelId: v.optional(v.union(v.string(), v.null())),
        squadVoiceCategoryId: v.optional(v.union(v.string(), v.null())),
        clanRoleId: v.optional(v.union(v.string(), v.null())),
        dashboardAdminRoleId: v.optional(v.union(v.string(), v.null())),
        /** Feature settings slices by key; validated again below with Zod. */
        slices: v.optional(v.record(v.string(), v.any())),
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
            const slicePatch = applyClanSettingsSlicePatches(
                args.slices,
                { discordConfig: safeDiscordConfigOf(config) },
                CLAN_SETTINGS_SLICES
            )
            if (!slicePatch.ok) {
                status = 400
                response = {
                    error: {
                        code: "validation_error",
                        message: slicePatch.error,
                    },
                }
            }
            // Slices in their own table are checked against the database
            // here and written below only when the whole request is accepted.
            const external =
                slicePatch.ok && args.slices
                    ? await prepareExternalClanSettings(
                          ctx,
                          key.guildId,
                          args.slices,
                          CLAN_SETTINGS_SLICES
                      )
                    : null
            if (external && !external.ok && !response) {
                status = external.error.status
                response = {
                    error: {
                        code: external.error.code,
                        message: external.error.message,
                    },
                }
            }
            const hasDiscordPatch = [
                // External slices write no Discord configuration fields.
                slicePatch.ok && Object.keys(slicePatch.patch).length
                    ? true
                    : undefined,
                args.timezone,
                args.defaultLanguage,
                args.announcementsChannelId,
                args.eventInfoChannelId,
                args.eventResultsChannelId,
                args.errorsChannelId,
                args.calendarChannelId,
                args.forumCategoryId,
                args.meetingChannelId,
                args.squadVoiceCategoryId,
                args.clanRoleId,
                args.dashboardAdminRoleId,
            ].some((value) => value !== undefined)
            if (hasDiscordPatch && !config && !response) {
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
            if (
                config &&
                (args.clanRoleId !== undefined ||
                    args.dashboardAdminRoleId !== undefined)
            ) {
                const prospective = {
                    ...config,
                    clanRoleId:
                        args.clanRoleId === undefined
                            ? config.clanRoleId
                            : args.clanRoleId?.trim() || undefined,
                    dashboardAdminRoleId:
                        args.dashboardAdminRoleId === undefined
                            ? config.dashboardAdminRoleId
                            : args.dashboardAdminRoleId?.trim() || undefined,
                }
                try {
                    for (const gameId of GAME_IDS)
                        managedRolePolicy(prospective, gameId)
                } catch {
                    status = 400
                    response = {
                        error: {
                            code: "validation_error",
                            message: "Managed role scope exceeds 100 roles.",
                        },
                    }
                }
            }
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
                "eventResultsChannelId",
                "errorsChannelId",
                "calendarChannelId",
                "forumCategoryId",
                "meetingChannelId",
                "squadVoiceCategoryId",
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
            if (slicePatch.ok) Object.assign(discordPatch, slicePatch.patch)
            if (!response && Object.keys(discordPatch).length && config)
                await ctx.db.patch(config._id, {
                    ...discordPatch,
                    updatedAt: now,
                })
            // A saved `commands` slice registers the commands again, as a
            // save on the "Příkazy" page does (M1-B01, N3-B02).
            if (!response && config && args.slices?.commands !== undefined)
                await requestRegistrationAfterSave(ctx, key.guildId)
            if (!response && external?.ok)
                await external.commit(`api:${String(key._id)}`)
            if (!response!) {
                const updatedGuild = await ctx.db.get(guild._id)
                const updatedConfig = config
                    ? await ctx.db.get(config._id)
                    : null
                const safeDiscordConfig = safeDiscordConfigOf(updatedConfig)
                response = {
                    data: {
                        guild: updatedGuild
                            ? { ...updatedGuild, id: String(updatedGuild._id) }
                            : null,
                        discordConfig: safeDiscordConfig,
                        slices: readClanSettingsSlices(
                            {
                                discordConfig: safeDiscordConfig,
                                external: await readExternalClanSettings(
                                    ctx,
                                    key.guildId,
                                    CLAN_SETTINGS_SLICES
                                ),
                            },
                            CLAN_SETTINGS_SLICES
                        ),
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
