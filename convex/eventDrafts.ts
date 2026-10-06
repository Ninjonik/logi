import {
    EventDraftsUseCase,
    type EventDraftRepository,
    type EventDraftWrite,
} from "../src/application/events/event-drafts.use-case"
import { syncEventAssetReferences } from "../src/infrastructure/convex/event-asset-references"
import { refreshEventSchedule } from "../src/infrastructure/convex/event-scheduling"
import type { EventUpsertInput } from "../src/domain/events/upsert-policy"
import { normalizeEventRecord } from "../src/domain/events/normalization"
import { query, type MutationCtx } from "./_generated/server"
import { getGuildById, getGuildDiscordId } from "./identity"
import { systemClock } from "../src/domain/shared/clock"
import type { WithoutSystemFields } from "convex/server"
import { assertInternalSecret } from "./discord_shared"
import type { Doc, Id } from "./_generated/dataModel"
import { resolveEventMatchTeams } from "./matchTeams"
import { eventWriteFields } from "./eventValidators"
import { mutation } from "./integrationMutation"
import { v } from "convex/values"

/** The stored row: preset and stratmap references become this deployment's IDs. */
function eventDoc(
    ctx: MutationCtx,
    record: EventDraftWrite
): WithoutSystemFields<Doc<"events">> {
    const { topicPresetId, stratmapIds, squadPresetId, ...rest } = record
    return {
        ...rest,
        topicPresetId: topicPresetId
            ? (ctx.db.normalizeId("topicPresets", topicPresetId) ?? undefined)
            : undefined,
        stratmapIds: stratmapIds.flatMap(
            (id) => ctx.db.normalizeId("stratmaps", id) ?? []
        ),
        squadPresetId: squadPresetId
            ? (ctx.db.normalizeId("squadPresets", squadPresetId) ?? undefined)
            : undefined,
    }
}

class ConvexEventDraftRepository implements EventDraftRepository {
    constructor(private readonly ctx: MutationCtx) {}

    async getById(eventId: string) {
        const event = await this.ctx.db.get(eventId as Id<"events">)
        return event
            ? {
                  id: String(event._id),
                  guildId: event.guildId,
                  isDraft: event.isDraft,
                  createdAt: event.createdAt,
              }
            : null
    }
    async create(record: EventDraftWrite) {
        return String(
            await this.ctx.db.insert("events", eventDoc(this.ctx, record))
        )
    }
    async replace(eventId: string, record: EventDraftWrite) {
        await this.ctx.db.replace(
            eventId as Id<"events">,
            eventDoc(this.ctx, record)
        )
    }
    async remove(eventId: string) {
        await this.ctx.db.delete(eventId as Id<"events">)
    }
}

const writeArgs = {
    secret: v.string(),
    serverId: v.id("guilds"),
    eventId: v.optional(v.id("events")),
    ...eventWriteFields,
}

type WriteArgs = {
    secret: string
    serverId: Id<"guilds">
    eventId?: Id<"events">
    matchTeams?: unknown
    topicPresetId?: Id<"topicPresets">
    stratmapIds?: Id<"stratmaps">[]
    squadPresetId?: Id<"squadPresets">
    gameId?: Doc<"events">["gameId"]
    kind?: Doc<"events">["kind"]
} & Omit<
    EventUpsertInput,
    "guildId" | "matchTeams" | "topicPresetId" | "stratmapIds" | "squadPresetId"
>

/**
 * Turns the caller's fields into the domain input inside this clan: team
 * selections are resolved and snapshotted here, never taken from the client,
 * and a squad preset of another clan is dropped.
 */
async function draftInput(ctx: MutationCtx, args: WriteArgs) {
    assertInternalSecret(args.secret)
    const guild = await getGuildById(ctx, String(args.serverId))
    if (!guild) throw new Error("Server not found.")
    const guildId = getGuildDiscordId(guild)
    const existing = args.eventId ? await ctx.db.get(args.eventId) : null
    // Another clan's event is never read further; the use case refuses it.
    const own = existing && existing.guildId === guildId ? existing : null
    const resolved = await resolveEventMatchTeams(ctx, {
        gameId: args.gameId,
        kind: args.kind,
        status: undefined,
        inputs: args.matchTeams,
        previous: own?.isDraft ? own.matchTeams : undefined,
        now: new Date().toISOString(),
    })
    // The dashboard route maps this prefix to a 400 with the bare code.
    if (!resolved.ok) throw new Error(`match_teams:${resolved.error}`)
    const squadPreset = args.squadPresetId
        ? await ctx.db.get(args.squadPresetId)
        : null
    const {
        secret: _secret,
        serverId: _serverId,
        matchTeams: _matchTeams,
        ...fields
    } = args
    const input: EventUpsertInput & { eventId?: string } = {
        ...fields,
        guildId,
        eventId: args.eventId ? String(args.eventId) : undefined,
        matchTeams: resolved.matchTeams,
        topicPresetId: args.topicPresetId
            ? String(args.topicPresetId)
            : undefined,
        stratmapIds: args.stratmapIds?.map((id) => String(id)),
        squadPresetId:
            squadPreset && squadPreset.guildId === guildId
                ? String(squadPreset._id)
                : undefined,
    }
    return input
}

async function afterWrite(ctx: MutationCtx, eventId: string) {
    const saved = await ctx.db.get(eventId as Id<"events">)
    if (saved) await syncEventAssetReferences(ctx, saved)
    // Replaces the deadlines; a draft gets none.
    await refreshEventSchedule(ctx, eventId as Id<"events">)
}

/** Creates or overwrites a draft of the new-match flow. */
export const save = mutation({
    args: writeArgs,
    handler: async (ctx, args) => {
        const input = await draftInput(ctx, args)
        const result = await new EventDraftsUseCase(
            new ConvexEventDraftRepository(ctx),
            systemClock
        ).save(input)
        if (result.ok) await afterWrite(ctx, result.eventId)
        return result
    },
})

/**
 * Publishes the flow: an existing draft becomes the event in place (same
 * ID), otherwise the event is created directly. Only then does the bot see it.
 */
export const publish = mutation({
    args: writeArgs,
    handler: async (ctx, args) => {
        const input = await draftInput(ctx, args)
        const result = await new EventDraftsUseCase(
            new ConvexEventDraftRepository(ctx),
            systemClock
        ).publish(input)
        if (result.ok) await afterWrite(ctx, result.eventId)
        return result
    },
})

/** Deletes a draft; a published event is never deleted here. */
export const remove = mutation({
    args: {
        secret: v.string(),
        serverId: v.id("guilds"),
        eventId: v.id("events"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const guild = await getGuildById(ctx, String(args.serverId))
        if (!guild) throw new Error("Server not found.")
        const guildId = getGuildDiscordId(guild)
        const draft = await ctx.db.get(args.eventId)
        const result = await new EventDraftsUseCase(
            new ConvexEventDraftRepository(ctx),
            systemClock
        ).remove({ guildId, eventId: String(args.eventId) })
        if (result.ok && draft) {
            const jobs = await ctx.db
                .query("eventScheduleJobs")
                .withIndex("eventId", (q) => q.eq("eventId", args.eventId))
                .collect()
            await Promise.all(jobs.map((job) => ctx.db.delete(job._id)))
            // Releases the team logos the draft referenced.
            await syncEventAssetReferences(ctx, {
                _id: draft._id,
                guildId: draft.guildId,
                matchTeams: [],
            })
        }
        return result
    },
})

/** One draft of this clan, to resume the new-match flow; anything else reads as missing. */
export const get = query({
    args: {
        secret: v.string(),
        serverId: v.id("guilds"),
        eventId: v.id("events"),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const guild = await getGuildById(ctx, String(args.serverId))
        if (!guild) return null
        const event = await ctx.db.get(args.eventId)
        if (
            !event ||
            event.isDraft !== true ||
            event.guildId !== getGuildDiscordId(guild)
        )
            return null
        return {
            ...normalizeEventRecord(event),
            id: String(event._id),
        }
    },
})
