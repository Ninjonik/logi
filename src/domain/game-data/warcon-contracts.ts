import { z } from "zod"

// Explicit field projections: upstream additions never automatically become website data.
const text = z.string().max(200)
const count = z.number().int().nonnegative().safe()
const number = z.number().finite()
const positive = number.nonnegative()
const time = z.iso.datetime({ offset: true })
const steam = z.string().regex(/^7656119\d{10}$/)
const color = z
    .string()
    .regex(/^#[\da-f]{6}$/i)
    .or(z.literal(""))
    .nullable()
const names = z.array(text).max(100)
const outcome = z.enum(["win", "loss", "draw"]).nullable()
const score = z.object({ name: text, score: number })
const faction = score.extend({ colorHex: color })
const player = z.object({
    steamId: steam,
    name: text,
    faction: text.nullable(),
    kills: count,
    deaths: count,
    cash: number,
    ping: positive.nullable(),
})
const status = z.object({
    serverName: text,
    map: text,
    experiences: names,
    lighting: text,
    alternator: text,
    scoreTick: number.nullable(),
    scoreTickMin: number.nullable(),
    scoreTickMax: number.nullable(),
    scoreCap: number.nullable(),
    matchSeconds: positive.nullable(),
    playerCount: count,
    maxPlayers: count,
    scores: z.array(faction).max(16),
    rotationNow: z.number().int(),
    rotationNext: z.number().int(),
})
export const warconLiveSchema = z
    .object({
        serverId: z.uuid(),
        ok: z.boolean(),
        tier: z.enum(["watched", "hot", "idle", "offline"]),
        build: text,
        gameServerId: text,
        startedAt: time.nullable(),
        reservedSlots: count.nullable(),
        throttledUntil: time.nullable(),
        status: status.nullable(),
        players: z.array(player).max(300),
        statusAt: time.nullable(),
        playersAt: time.nullable(),
        observedAt: time.nullable(),
    })
    .refine(
        (v) =>
            new Set(v.players.map((p) => p.steamId)).size === v.players.length
    )
const freshness = z.enum(["fresh", "stale", "unavailable"])
export const warconLiveDataSchema = warconLiveSchema.extend({
    freshness,
    playersFreshness: freshness,
})

export const warconMatchSchema = z.object({
    id: count,
    startedAt: time,
    endedAt: time.nullable(),
    map: text.nullable(),
    experiences: text.nullable(),
    lighting: text.nullable(),
    peakPlayers: count,
    players: count,
    finalScores: z.array(score).max(16).nullable(),
    winner: text.nullable(),
})
export const warconMatchesSchema = z.object({
    matches: z.array(warconMatchSchema).max(50),
    live: z.array(faction).max(16),
    page: count,
    pageSize: count,
    total: count,
    pages: count,
})
const matchLine = z.object({
    steamId: steam,
    name: text,
    faction: text.nullable(),
    seconds: positive,
    kills: count,
    deaths: count,
    cashDelta: number,
    headshots: count,
    teamKills: count,
    suicides: count,
    vehicleKills: count,
    longestM: positive.nullable(),
    killStreak: count,
    deathStreak: count,
    result: outcome,
})
export const warconMatchDetailSchema = z
    .object({
        match: warconMatchSchema,
        factions: z.array(z.object({ name: text, colorHex: color })).max(16),
        lines: z.array(matchLine).max(300),
        timeline: z.array(z.array(number).min(1).max(17)).max(10_000),
        awards: z
            .array(
                z.object({
                    key: z.enum(["kills", "kd", "longest", "streak", "cash"]),
                    label: text,
                    steamId: steam,
                    name: text,
                    value: text,
                })
            )
            .max(5),
        kills: count,
        hasFeed: z.boolean(),
    })
    .refine(
        (v) =>
            v.match.endedAt !== null &&
            Date.parse(v.match.endedAt) >= Date.parse(v.match.startedAt) &&
            new Set(v.lines.map((p) => p.steamId)).size === v.lines.length &&
            v.timeline.every((point) => point.length === v.factions.length + 1)
    )

const boardCounts = {
    kills: count,
    deaths: count,
    headshots: count,
    teamKills: count,
    suicides: count,
    vehicleKills: count,
    killStreak: count,
    deathStreak: count,
    matches: count,
    wins: count,
    losses: count,
    draws: count,
}
export const warconLeaderboardSchema = z.object({
    query: z.object({
        scope: z.literal("server"),
        range: z.enum(["7d", "30d", "90d", "all"]),
        sort: z.enum([
            "kills",
            "deaths",
            "kd",
            "perHour",
            "playtime",
            "seeded",
            "matches",
            "wins",
            "winRate",
            "cash",
        ]),
        dir: z.enum(["asc", "desc"]),
        page: count,
        minMinutes: positive,
    }),
    rows: z
        .array(
            z.object({
                rank: count,
                steamId: steam,
                name: text,
                minutes: positive,
                seedMinutes: positive,
                ...boardCounts,
                cash: number,
                lastSeen: time.nullable(),
            })
        )
        .max(50),
    total: count,
    pageSize: count,
    hasFeed: z.boolean(),
})
export const warconPlayersSchema = z.object({
    players: z
        .array(
            z.object({
                steamId: steam,
                name: text,
                firstSeen: time,
                lastSeen: time,
                sessions: count,
                minutes: positive,
                kills: count,
                deaths: count,
                online: z.boolean(),
            })
        )
        .max(100),
    total: count,
})
const group = z.object({
    key: text,
    matches: count,
    wins: count,
    losses: count,
    draws: count,
    kills: count,
    deaths: count,
})
export const warconCareerSchema = z.object({
    rank: z.object({ server: count.nullable(), floorMinutes: positive }),
    streak: z.object({ kind: z.enum(["win", "loss"]), n: count }).nullable(),
    matches: count,
    wins: count,
    losses: count,
    draws: count,
    kills: count,
    deaths: count,
    minutes: positive,
    headshots: count,
    vehicleKills: count,
    longestM: positive.nullable(),
    killStreak: count,
    deathStreak: count,
    maps: z.array(group).max(1000),
    factions: z.array(group).max(100),
    last: z
        .array(
            z.object({
                matchId: count,
                serverId: z.uuid(),
                serverName: text,
                startedAt: time,
                endedAt: time.nullable(),
                map: text.nullable(),
                faction: text.nullable(),
                result: outcome,
                seconds: positive,
                kills: count,
                deaths: count,
                cashDelta: number,
                headshots: count,
                killStreak: count,
            })
        )
        .max(10),
})
const killPlayer = z.object({
    steamId: steam,
    name: text,
    faction: text.nullable(),
})
export const warconKillSchema = z.object({
    eventId: text,
    ts: time,
    map: text,
    eventTime: positive,
    killer: killPlayer.nullable(),
    victim: killPlayer,
    cause: text.nullable(),
    distanceM: positive.nullable(),
    headshot: z.boolean(),
    suicide: z.boolean(),
    teamKill: z.boolean(),
    tags: names,
})
export const warconKillsSchema = z.object({
    configured: z.boolean(),
    feedAt: time.nullable(),
    kills: z.array(warconKillSchema).max(200),
    total: count.nullable(),
})

const catalogItem = z.object({ id: text, display: text })
const items = z.array(catalogItem).max(1000)
export const warconCatalogSchema = z.object({
    maps: items,
    lightings: items,
    experiences: items,
})
export const warconRotationSchema = z.object({
    enabled: z.boolean(),
    mode: text,
    nowIndex: z.number().int(),
    nextIndex: z.number().int(),
    entries: z
        .array(
            z.object({
                map: text,
                experiences: names,
                lighting: text,
                zoneAlternator: text,
                denied: z.boolean(),
                status: text,
            })
        )
        .max(1000),
})
export const warconHealthSchema = z.object({
    status: text,
    uptimeSeconds: positive,
    connections: z.object({ active: count }),
    gameThreadQueue: z.object({
        inFlight: count,
        depth: count,
        rejectedTotal: count,
    }),
})
export const warconCapabilitiesSchema = z.object({
    routes: z.array(z.string().max(300)).max(300),
    features: z.object({
        changeTeam: z.boolean(),
        configDocument: z.boolean(),
        reservedSlots: z.boolean(),
        rotationEdit: z.boolean(),
        rotationSave: z.boolean(),
        liveSettings: z.boolean(),
        serverId: z.boolean(),
    }),
})
export const warconExperiencesSchema = z.object({ experiences: items })
export const warconAlternatorsSchema = z.object({
    alternators: z.array(z.object({ tag: text, display: text })).max(1000),
})
export const warconCashSchema = z.object({
    since: time,
    points: z
        .array(
            z.object({
                ts: time,
                total: number.nullable(),
                factions: z
                    .record(text, number)
                    .refine((v) => Object.keys(v).length <= 16),
            })
        )
        .max(3000),
})

export const warconAnalyticsSchema = z.object({
    range: z.enum(["24h", "7d", "30d"]),
    from: time,
    to: time,
    sampleSeconds: positive,
    bucketSeconds: positive,
    summary: z.object({
        uniquePlayers: count,
        peakPlayers: count,
        avgPlayers: positive,
        uptimePct: positive.max(100).nullable(),
        onlineNow: count,
        samples: count,
        matches: count,
        coveredHours: positive,
    }),
    population: z
        .array(
            z.object({
                ts: time,
                avg: positive.nullable(),
                max: positive.nullable(),
                cap: positive.nullable(),
                ok: positive,
                total: positive,
                up: positive,
                down: positive,
            })
        )
        .max(1000),
    cash: z
        .array(
            z.object({
                ts: time,
                total: number.nullable(),
                factions: z
                    .record(text, number)
                    .refine((v) => Object.keys(v).length <= 16),
            })
        )
        .max(1000),
    maps: z
        .array(z.object({ map: text, minutes: positive, matches: count }))
        .max(1000),
    wins: z.object({
        teams: z
            .array(z.object({ name: text, wins: count, colorHex: color }))
            .max(100),
        decided: count,
        draws: count,
        noResult: count,
    }),
    players: z
        .array(
            z.object({
                steamId: steam,
                name: text,
                minutes: positive,
                sessions: count,
                kills: count,
                deaths: count,
                lastSeen: time,
                online: z.boolean(),
            })
        )
        .max(100),
    matches: z.array(warconMatchSchema.omit({ players: true })).max(100),
    hourly: z.array(z.object({ hour: count.max(23), avg: positive })).max(24),
    combat: z
        .object({
            kills: count,
            headshots: count,
            teamKills: count,
            suicides: count,
            vehicleKills: count,
            perBucket: z.array(z.object({ ts: time, kills: count })).max(1000),
            causes: z
                .array(
                    z.object({ cause: text, kills: count, headshots: count })
                )
                .max(1000),
            players: z
                .array(
                    z.object({
                        steamId: steam,
                        name: text,
                        kills: count,
                        deaths: count,
                        headshots: count,
                        teamKills: count,
                        avgDistanceM: positive.nullable(),
                    })
                )
                .max(100),
            longest: z
                .array(
                    z.object({
                        ts: time,
                        killer: text,
                        victim: text,
                        cause: text.nullable(),
                        distanceM: positive,
                    })
                )
                .max(100),
        })
        .nullable(),
})

export const warconReadSchema = z.discriminatedUnion("view", [
    z.object({ view: z.literal("live"), data: warconLiveDataSchema }),
    z.object({ view: z.literal("analytics"), data: warconAnalyticsSchema }),
    z.object({ view: z.literal("cash"), data: warconCashSchema }),
    z.object({ view: z.literal("matches"), data: warconMatchesSchema }),
    z.object({
        view: z.literal("match"),
        data: warconMatchDetailSchema.nullable(),
    }),
    z.object({ view: z.literal("leaderboard"), data: warconLeaderboardSchema }),
    z.object({ view: z.literal("players"), data: warconPlayersSchema }),
    z.object({ view: z.literal("career"), data: warconCareerSchema }),
    z.object({ view: z.literal("kills"), data: warconKillsSchema }),
    z.object({ view: z.literal("catalog"), data: warconCatalogSchema }),
    z.object({ view: z.literal("rotation"), data: warconRotationSchema }),
    z.object({ view: z.literal("health"), data: warconHealthSchema }),
    z.object({
        view: z.literal("capabilities"),
        data: warconCapabilitiesSchema,
    }),
    z.object({ view: z.literal("experiences"), data: warconExperiencesSchema }),
    z.object({ view: z.literal("alternators"), data: warconAlternatorsSchema }),
])
export type WarconRead = z.infer<typeof warconReadSchema>
export const warconEnvelopeSchema = z.object({
    connectionId: z.string(),
    gameId: z.literal("wardogs"),
    provider: z.literal("wardogs_warcon"),
    fetchedAt: time,
    cacheUntil: time,
    result: warconReadSchema,
})
export type WarconEnvelope = z.infer<typeof warconEnvelopeSchema>

export function warconFreshness(
    timestamp: string | null,
    now: number,
    ok = true
): z.infer<typeof freshness> {
    const age = timestamp === null ? Infinity : now - Date.parse(timestamp)
    return age < 0 || age >= 180_000
        ? "unavailable"
        : !ok || age >= 45_000
          ? "stale"
          : "fresh"
}
