import {
    SHARED_MATCH_FIELDS,
    participantClan,
} from "../../domain/events/shared-match"
import { ApplyEventScoreUseCase } from "../../application/events/apply-event-score.use-case"
import { DEFAULT_ROSTER_SCORE_SETTINGS } from "../../domain/events/score-policy"
import type { MutationCtx, QueryCtx } from "../../../convex/_generated/server"
import { rosterRevisionTimestamp } from "../../domain/rosters/shared-roster"
import { ConvexEventScoreRepository } from "./event-command-repositories"
import { mergeRosterWithEventState } from "../../domain/rosters/sync"
import type { Doc, Id } from "../../../convex/_generated/dataModel"
import { syncEventAssetReferences } from "./event-asset-references"
import { getUserByDiscordId } from "../../../convex/identity"
import { resolveGameScope } from "../../domain/games/game"
import { refreshEventSchedule } from "./event-scheduling"

export async function sharedMatchMembers(
    ctx: Pick<QueryCtx, "db">,
    event: Doc<"events">
) {
    const hostId = event.hostEventId ?? event._id
    const host = event.hostEventId ? await ctx.db.get(hostId) : event
    if (!host) throw new Error("Host match no longer exists.")
    const invitations = await ctx.db
        .query("sharedMatchInvitations")
        .withIndex("hostEventId", (q) => q.eq("hostEventId", hostId))
        .collect()
    const accepted = invitations.filter(
        (item) => item.status === "accepted" && item.localEventId
    )
    if (
        event.hostEventId &&
        !accepted.some((item) => item.localEventId === event._id)
    )
        throw new Error("Your clan is no longer participating in this match.")
    const locals = await Promise.all(
        accepted.map((item) => ctx.db.get(item.localEventId!))
    )
    return {
        host,
        invitations,
        events: [
            host,
            ...locals.filter((item): item is Doc<"events"> => item !== null),
        ],
    }
}

/** Resolve one match identity without changing any clan's membership records. */
export async function sharedMatchPeople(
    ctx: Pick<QueryCtx, "db">,
    events: Doc<"events">[]
) {
    const guildIds = events.map((event) => event.guildId)
    const assignments = (
        await Promise.all(
            events.map((event) =>
                ctx.db
                    .query("userAssignments")
                    .withIndex("serverId", (q) =>
                        q.eq("serverId", event.guildId)
                    )
                    .collect()
            )
        )
    )
        .flat()
        .filter(
            (item) =>
                resolveGameScope(item.gameId) ===
                    resolveGameScope(events[0].gameId) &&
                item.status !== "pending"
        )
    const roster = await ctx.db
        .query("rosters")
        .withIndex("eventId", (q) => q.eq("eventId", events[0]._id))
        .unique()
    const represented = new Map(
        (roster?.squads ?? []).flatMap((squad) =>
            squad.players.flatMap((slot) =>
                slot.id
                    ? [
                          [
                              slot.id,
                              slot.allocatedGuildId ?? events[0].guildId,
                          ] as const,
                      ]
                    : []
            )
        )
    )
    const ids = new Set([
        ...assignments.map((item) => item.userId),
        ...events.flatMap((event) =>
            [...(event.participants ?? []), ...(event.signUps ?? [])].map(
                (item) => item.userId
            )
        ),
    ])
    const owners = new Map<string, string>()
    const eligibleByGuild = new Map(
        guildIds.map((guildId) => [guildId, new Set<string>()])
    )
    for (const id of ids) {
        const user = await getUserByDiscordId(ctx, id)
        const selected =
            represented.get(id) ??
            events.find(
                (event) =>
                    event.participants?.some((item) => item.userId === id) ||
                    event.signUps?.some((item) => item.userId === id)
            )?.guildId ??
            assignments.find((item) => item.userId === id)?.serverId
        if (!selected) continue
        const mainGuildId = user?.guildId
        const mainParticipates = mainGuildId && guildIds.includes(mainGuildId)
        for (const event of events) {
            if (mainParticipates && mainGuildId !== event.guildId) continue
            if (
                assignments.some(
                    (item) =>
                        item.userId === id &&
                        item.serverId === event.guildId &&
                        !item.paused
                ) ||
                (event.allowNonMembersSignup &&
                    event.participants?.some((person) => person.userId === id))
            )
                eligibleByGuild.get(event.guildId)?.add(id)
        }
        owners.set(
            id,
            participantClan({
                mainGuildId,
                participatingGuildIds: guildIds,
                selectedGuildId: selected,
            })
        )
    }
    return { assignments, owners, eligibleByGuild }
}

export function sharedMatchPatch(host: Doc<"events">) {
    return Object.fromEntries(
        SHARED_MATCH_FIELDS.map((field) => [field, host[field]])
    )
}

export async function sharedDashboardEvent(
    ctx: Pick<QueryCtx, "db">,
    event: Doc<"events">
) {
    if (event.hostEventId) return event
    const { events } = await sharedMatchMembers(ctx, event)
    if (events.length === 1) return event
    const { owners } = await sharedMatchPeople(ctx, events)
    return {
        ...event,
        participants: events.flatMap((item) =>
            (item.participants ?? []).filter(
                (person) => owners.get(person.userId) === item.guildId
            )
        ),
        signUps: events.flatMap((item) =>
            (item.signUps ?? []).filter(
                (person) => owners.get(person.userId) === item.guildId
            )
        ),
        absenceNotices: events.flatMap((item) => item.absenceNotices ?? []),
    }
}

/** Refresh local views in the caller's transaction; never perform network work. */
export async function synchronizeSharedMatch(
    ctx: MutationCtx,
    hostId: Id<"events">
) {
    const host = await ctx.db.get(hostId)
    if (!host || host.hostEventId) return
    const { events } = await sharedMatchMembers(ctx, host)
    if (events.length < 2) {
        if (host.sharedLocalPlayerIds !== undefined) {
            await ctx.db.patch(host._id, { sharedLocalPlayerIds: undefined })
            const roster = await ctx.db
                .query("rosters")
                .withIndex("eventId", (q) => q.eq("eventId", host._id))
                .unique()
            if (roster?.localPlayerIds !== undefined)
                await ctx.db.patch(roster._id, { localPlayerIds: undefined })
        }
        return
    }
    let roster = await ctx.db
        .query("rosters")
        .withIndex("eventId", (q) => q.eq("eventId", hostId))
        .unique()
    const { owners, assignments, eligibleByGuild } = await sharedMatchPeople(
        ctx,
        events
    )
    for (const event of events) {
        const ids = [...owners]
            .filter(([, guild]) => guild === event.guildId)
            .map(([id]) => id)
        if (JSON.stringify(ids) !== JSON.stringify(event.sharedLocalPlayerIds))
            await ctx.db.patch(event._id, {
                sharedLocalPlayerIds: ids,
                updatedAt: new Date().toISOString(),
            })
    }
    if (roster) {
        const localPlayerIds = [...owners]
            .filter(([, guild]) => guild === host.guildId)
            .map(([id]) => id)
        if (
            JSON.stringify(roster.localPlayerIds) !==
            JSON.stringify(localPlayerIds)
        ) {
            await ctx.db.patch(roster._id, { localPlayerIds })
            roster = { ...roster, localPlayerIds }
        }
        const merged = mergeRosterWithEventState(
            roster,
            {
                ...host,
                participants: events.flatMap((item) =>
                    (item.participants ?? []).filter(
                        (person) => owners.get(person.userId) === item.guildId
                    )
                ),
                signUps: events.flatMap((item) =>
                    (item.signUps ?? []).filter(
                        (person) => owners.get(person.userId) === item.guildId
                    )
                ),
            },
            assignments.map((item) => ({ ...item, serverId: host.guildId })),
            new Date(),
            { preservePlacedUsers: true }
        )
        const changed =
            JSON.stringify([
                roster.squads,
                roster.reservePlayerIds,
                roster.notAttendingPlayerIds,
            ]) !==
            JSON.stringify([
                merged.squads,
                merged.reservePlayerIds,
                merged.notAttendingPlayerIds,
            ])
        if (changed) {
            const patch = {
                squads: merged.squads,
                reservePlayerIds: merged.reservePlayerIds,
                notAttendingPlayerIds: merged.notAttendingPlayerIds,
                reserveAttendances: merged.reserveAttendances,
                updatedAt: rosterRevisionTimestamp(
                    roster.updatedAt,
                    new Date()
                ),
            }
            await ctx.db.patch(roster._id, patch)
            roster = { ...roster, ...patch }
        }
    }
    for (const local of events.slice(1)) {
        const patch = sharedMatchPatch(host)
        if (
            SHARED_MATCH_FIELDS.some(
                (field) =>
                    JSON.stringify(host[field]) !== JSON.stringify(local[field])
            )
        ) {
            await ctx.db.patch(local._id, {
                ...patch,
                updatedAt: host.updatedAt ?? host.createdAt,
            })
            const refreshed = await ctx.db.get(local._id)
            if (refreshed) await syncEventAssetReferences(ctx, refreshed)
            await refreshEventSchedule(ctx, local._id)
        }
        if (!roster) {
            if (host.status === "concluded")
                await new ApplyEventScoreUseCase(
                    new ConvexEventScoreRepository(
                        ctx,
                        DEFAULT_ROSTER_SCORE_SETTINGS
                    )
                ).execute(String(local._id))
            continue
        }
        const existing = await ctx.db
            .query("rosters")
            .withIndex("eventId", (q) => q.eq("eventId", local._id))
            .unique()
        const localIds = eligibleByGuild.get(local.guildId) ?? new Set<string>()
        const value = {
            discordMessageVariant: local.localRosterMessageVariant,
            discordMentionPlayers: local.localRosterMentionPlayers,
            localPlayerIds: [...owners]
                .filter(([, guild]) => guild === local.guildId)
                .map(([id]) => id),
            guildId: local.guildId,
            gameId: host.gameId,
            eventId: local._id,
            squads: roster.squads,
            reservePlayerIds: roster.reservePlayerIds.filter((id) =>
                localIds.has(id)
            ),
            reserveAttendances: (roster.reserveAttendances ?? []).filter(
                (item) => localIds.has(item.userId)
            ),
            notAttendingPlayerIds: roster.notAttendingPlayerIds.filter((id) =>
                localIds.has(id)
            ),
            published: roster.published,
            publishedAt: roster.publishedAt,
            publishedPlaces: roster.publishedPlaces,
            previousPublishedPlaces: roster.previousPublishedPlaces,
            updatedAt: roster.updatedAt,
        }
        if (existing) {
            if (
                Object.entries(value).some(
                    ([key, field]) =>
                        JSON.stringify(
                            existing[key as keyof typeof existing]
                        ) !== JSON.stringify(field)
                )
            )
                await ctx.db.patch(existing._id, value)
        } else
            await ctx.db.insert("rosters", {
                ...value,
                createdAt: roster.createdAt,
            })
        if (host.status === "concluded")
            await new ApplyEventScoreUseCase(
                new ConvexEventScoreRepository(
                    ctx,
                    DEFAULT_ROSTER_SCORE_SETTINGS
                )
            ).execute(String(local._id))
    }
}
