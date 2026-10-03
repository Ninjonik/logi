import { GAME_IDS } from "../games/game"
import { z } from "zod"

/** Authenticated operational facts. None of these fields grants public consent or access. */
export const PEOPLE_RESOURCES = [
    "member-summaries",
    "roster-summaries",
    "player-stat-summaries",
] as const
export type PeopleResource = (typeof PEOPLE_RESOURCES)[number]
const id = z.string().min(1).max(200)
const instant = z.iso.datetime()
const label = z.string().min(1).max(200)
const common = {
    schemaVersion: z.literal(1),
    id,
    guildId: z.string().regex(/^\d{5,25}$/),
    gameId: z.enum(GAME_IDS),
    updatedAt: instant.nullable(),
}
export const memberReferenceSchema = z
    .object({
        memberId: id.nullable(),
        identityId: id.nullable(),
        identityState: z.enum(["resolved", "unresolved", "conflict"]),
    })
    .strict()
    .refine(
        (row) =>
            row.identityState === "resolved"
                ? row.memberId !== null && row.identityId !== null
                : row.memberId === null && row.identityId === null,
        {
            message:
                "Only an unambiguous scoped member may have identity references.",
        }
    )

export const clanMemberSummarySchema = z
    .object({
        ...common,
        identityId: id.nullable(),
        discordSubject: z
            .string()
            .regex(/^\d{17,20}$/)
            .nullable(),
        identityState: z.enum(["resolved", "unresolved", "conflict"]),
        displayName: label.nullable(),
        type: z.enum(["member", "reserve_member", "mercenary"]),
        status: z.enum(["pending", "recruit", "active"]),
        paused: z.boolean(),
        groups: z
            .array(z.object({ id, name: label, primary: z.boolean() }).strict())
            .max(100),
    })
    .strict()
    .refine(
        (row) =>
            row.identityState === "resolved"
                ? row.identityId !== null
                : row.identityId === null &&
                  row.discordSubject === null &&
                  row.displayName === null,
        {
            message:
                "Unresolved or conflicting users cannot expose another account's identity.",
        }
    )

const attendance = z.enum(["pending", "acknowledged", "confirmed"])
const attendedReference = memberReferenceSchema.safeExtend({ attendance })
export const clanRosterSummarySchema = z
    .object({
        ...common,
        eventId: id,
        published: z.literal(true),
        squads: z
            .array(
                z
                    .object({
                        index: z.number().int().nonnegative(),
                        name: label,
                        slots: z
                            .array(
                                attendedReference.safeExtend({
                                    index: z.number().int().nonnegative(),
                                })
                            )
                            .max(300),
                    })
                    .strict()
            )
            .max(64),
        reserves: z.array(attendedReference).max(300),
        notAttending: z.array(memberReferenceSchema).max(300),
        eventParticipation: z
            .array(
                memberReferenceSchema.safeExtend({
                    status: z.enum(["attending", "not_attending"]),
                    completed: z.enum(["passed", "failed"]).nullable(),
                })
            )
            .max(1000),
    })
    .strict()
    .refine(
        (row) =>
            row.squads.reduce(
                (count, squad) => count + squad.slots.length,
                0
            ) <= 300,
        { message: "At most 300 roster slots can be projected." }
    )

const metric = z.number().finite().nonnegative().nullable()
export const playerFactMetricsSchema = z
    .object({
        kills: metric,
        deaths: metric,
        combat: metric,
        offense: metric,
        defense: metric,
        support: metric,
        seconds: metric,
        cashDelta: z.number().finite().nullable(),
        headshots: metric,
        teamKills: metric,
        suicides: metric,
        vehicleKills: metric,
        longestM: metric,
        killStreak: metric,
        deathStreak: metric,
    })
    .strict()
export const clanPlayerStatSummarySchema = z
    .object({
        ...common,
        connectionId: id,
        source: z.literal("collected_session"),
        provider: z.enum(["hll_crcon", "wardogs_warcon"]),
        externalSessionId: id,
        startedAt: instant.nullable(),
        endedAt: instant.nullable(),
        complete: z.boolean(),
        fetchedAt: instant,
        sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
        attributionCheckedAt: instant,
        players: z
            .array(
                z
                    .object({
                        memberId: id,
                        identityId: id,
                        verifiedAt: instant,
                        metrics: playerFactMetricsSchema,
                    })
                    .strict()
            )
            .max(300),
        coverage: z
            .object({
                observedPlayers: z.number().int().min(0).max(300),
                verifiedMembers: z.number().int().min(0).max(300),
                unlinkedPlayers: z.number().int().min(0).max(300),
            })
            .strict(),
        eventRefs: z
            .array(
                z
                    .object({
                        eventId: id,
                        resultVersion: z.number().int().positive(),
                        resultState: z.enum(["confirmed", "corrected"]),
                    })
                    .strict()
            )
            .max(100),
    })
    .strict()
    .refine(
        (row) =>
            row.coverage.verifiedMembers === row.players.length &&
            row.coverage.verifiedMembers + row.coverage.unlinkedPlayers ===
                row.coverage.observedPlayers &&
            new Set(row.players.map((player) => player.identityId)).size ===
                row.players.length,
        {
            message:
                "Player coverage must be complete and identities unambiguous.",
        }
    )

export type ClanMemberSummary = z.infer<typeof clanMemberSummarySchema>
export type ClanRosterSummary = z.infer<typeof clanRosterSummarySchema>
export type ClanPlayerStatSummary = z.infer<typeof clanPlayerStatSummarySchema>
export type MemberReference = z.infer<typeof memberReferenceSchema>
export type PeopleSummary =
    ClanMemberSummary | ClanRosterSummary | ClanPlayerStatSummary

/** Preserve unsupported/absent metrics; zero is only a provider observation. */
export function projectPlayerMetrics(metrics: Record<string, number | null>) {
    return playerFactMetricsSchema.parse(
        Object.fromEntries(
            Object.keys(playerFactMetricsSchema.shape).map((key) => {
                const value = metrics[key]
                return [
                    key,
                    typeof value === "number" &&
                    Number.isFinite(value) &&
                    (key === "cashDelta" || value >= 0)
                        ? value
                        : null,
                ]
            })
        )
    )
}

export function projectAttendance(
    ack: boolean,
    confirmed?: boolean
): z.infer<typeof attendance> {
    return ack ? (confirmed === true ? "confirmed" : "acknowledged") : "pending"
}
