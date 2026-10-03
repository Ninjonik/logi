import { z } from "zod"

const integer = (min: number, max: number) =>
    z
        .union([z.number(), z.string().regex(/^\d+$/)])
        .pipe(z.coerce.number<string | number>().int().min(min).max(max))
const page = integer(1, 100_000).default(1)
const steam = z.string().regex(/^7656119\d{10}$/)
const matchId = z.string().regex(/^[1-9]\d{0,14}$/)
const direction = z.enum(["asc", "desc"]).default("desc")
const map = z.string().regex(/^[\w .-]{1,100}$/)
export const warconQuerySchema = z.discriminatedUnion("view", [
    z.strictObject({ view: z.literal("live") }),
    z.strictObject({
        view: z.literal("analytics"),
        range: z.enum(["24h", "7d", "30d"]).default("24h"),
    }),
    z.strictObject({
        view: z.literal("cash"),
        since: z.iso.datetime({ offset: true }).optional(),
    }),
    z.strictObject({ view: z.literal("matches"), page }),
    z.strictObject({ view: z.literal("match"), matchId }),
    z.strictObject({
        view: z.literal("leaderboard"),
        range: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
        sort: z
            .enum([
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
            ])
            .default("kills"),
        dir: direction,
        page,
        minMinutes: integer(0, 100_000).default(60),
    }),
    z.strictObject({
        view: z.literal("players"),
        q: z.string().max(100).default(""),
        since: integer(0, 3650).default(0),
        sort: z
            .enum([
                "lastSeen",
                "firstSeen",
                "minutes",
                "sessions",
                "kills",
                "deaths",
                "name",
            ])
            .default("lastSeen"),
        dir: direction,
        offset: integer(0, 1_000_000).default(0),
        limit: integer(1, 100).default(50),
    }),
    z.strictObject({ view: z.literal("career"), steamId: steam }),
    z.strictObject({
        view: z.literal("kills"),
        limit: integer(1, 200).default(50),
        before: z.iso.datetime({ offset: true }).optional(),
        beforeTime: z
            .union([z.number(), z.string().regex(/^\d+(?:\.\d+)?$/)])
            .pipe(z.coerce.number<string | number>().finite().nonnegative())
            .optional(),
        match: matchId.optional(),
        player: z.string().min(1).max(100).optional(),
        killer: z.string().min(1).max(100).optional(),
        victim: z.string().min(1).max(100).optional(),
        cause: z.string().min(1).max(200).optional(),
        kind: z
            .enum(["headshot", "teamKill", "suicide", "vehicle", "environment"])
            .optional(),
        minM: integer(0, 100_000).optional(),
    }),
    z.strictObject({ view: z.literal("catalog") }),
    z.strictObject({ view: z.literal("rotation") }),
    z.strictObject({ view: z.literal("health") }),
    z.strictObject({ view: z.literal("capabilities") }),
    z.strictObject({ view: z.literal("experiences"), map: map.optional() }),
    z.strictObject({ view: z.literal("alternators"), map }),
])
export type WarconQuery = z.infer<typeof warconQuerySchema>
export type WarconView = WarconQuery["view"]

export function parseWarconQuery(params: URLSearchParams): WarconQuery | null {
    if (
        params.toString().length > 1500 ||
        [...params.keys()].some((k) => params.getAll(k).length !== 1)
    )
        return null
    const { game, ...input } = Object.fromEntries(params)
    if (game !== "wardogs") return null
    const parsed = warconQuerySchema.safeParse(input)
    if (
        !parsed.success ||
        (parsed.data.view === "kills" &&
            parsed.data.beforeTime !== undefined &&
            !parsed.data.before)
    )
        return null
    return parsed.data
}

export function warconPath(serverId: string, query: WarconQuery): string {
    const base = `/api/servers/${encodeURIComponent(serverId)}`
    const { view, ...params } = query
    const search = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
    )
    switch (query.view) {
        case "live":
            return `/api/live?ids=${encodeURIComponent(serverId)}`
        case "match":
            return `${base}/matches/${query.matchId}`
        case "career":
            return `${base}/players/${query.steamId}/career`
        case "leaderboard":
            search.set("scope", "server")
            break
        case "kills":
            search.set("count", "1")
            break
    }
    const suffix = [
        "catalog",
        "rotation",
        "health",
        "capabilities",
        "experiences",
        "alternators",
    ].includes(view)
        ? `rcon/${view}`
        : view === "players"
          ? "players/seen"
          : view
    return `${base}/${suffix}${search.size ? `?${search}` : ""}`
}

/** The transport checks this independently of the caller. No arbitrary RCON reads. */
export function allowsWarconUrl(url: URL, serverId: string): boolean {
    const params = url.searchParams
    if ([...params.keys()].some((k) => params.getAll(k).length !== 1))
        return false
    if (url.pathname === "/api/servers") return params.size === 0
    if (url.pathname === "/api/live")
        return params.size === 1 && params.get("ids") === serverId
    const base = `/api/servers/${encodeURIComponent(serverId)}/`
    if (!url.pathname.startsWith(base)) return false
    const suffix = url.pathname.slice(base.length)
    const input: Record<string, unknown> = Object.fromEntries(params)
    if (suffix === "leaderboard" && input.scope === "server") delete input.scope
    if (suffix === "kills" && input.count === "1") delete input.count
    const match = suffix.match(/^matches\/([1-9]\d{0,14})$/)
    const career = suffix.match(/^players\/(7656119\d{10})\/career$/)
    if (match) {
        if (params.size) return false
        input.view = "match"
        input.matchId = match[1]
    } else if (career) {
        if (params.size) return false
        input.view = "career"
        input.steamId = career[1]
    } else
        input.view =
            suffix === "players/seen"
                ? "players"
                : suffix.startsWith("rcon/")
                  ? suffix.slice(5)
                  : suffix
    if (
        input.view === "live" ||
        (input.view === "match" && !match) ||
        (input.view === "career" && !career)
    )
        return false
    const parsed = warconQuerySchema.safeParse(input)
    return (
        parsed.success &&
        new URL(warconPath(serverId, parsed.data), url.origin).pathname ===
            url.pathname &&
        !(
            parsed.data.view === "kills" &&
            parsed.data.beforeTime !== undefined &&
            !parsed.data.before
        )
    )
}

export function warconCacheMs(query: WarconQuery) {
    return query.view === "live"
        ? 10_000
        : query.view === "kills"
          ? 15_000
          : ["catalog", "capabilities", "experiences", "alternators"].includes(
                  query.view
              )
            ? 300_000
            : 60_000
}
