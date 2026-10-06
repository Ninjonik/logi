/**
 * "Našli jsme tě na serverech klanu?" (L6-29, L6-B06): the players of the
 * clan's retained server history whose in-game name matches the name from
 * window 1, with where and when they were last seen.
 */

export type HistoryPlayer = {
    platform: "steam" | "xbox" | "unknown"
    platformId: string
    name?: string | null
}

export type HistoryGame = {
    endedAt: string
    serverName: string | null
    players: readonly HistoryPlayer[]
}

export type PreviousPlayerPlatform =
    "steam" | "epic" | "xbox" | "playstation" | "other"

export type PreviousPlayer = {
    /** `platform:id`, the value of the select option. */
    key: string
    name: string
    platform: PreviousPlayerPlatform
    platformId: string
    lastSeenAt: string
    serverName: string | null
}

const EPIC_ID =
    /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
const STEAM_ID = /^7656119\d{10}$/

/** Lower case, without diacritics, spaces or punctuation: "Hráč 17" → "hrac17". */
export function normalizePlayerName(name: string) {
    return name
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, "")
}

function platformOf(player: HistoryPlayer): PreviousPlayerPlatform {
    if (player.platform === "steam" || STEAM_ID.test(player.platformId))
        return "steam"
    if (player.platform === "xbox") return "xbox"
    if (EPIC_ID.test(player.platformId)) return "epic"
    return "other"
}

/**
 * Up to `limit` candidates, exact name matches first, then the most recently
 * seen. A name shorter than three letters matches only exactly. `/link`'s
 * search ("Jméno ve hře nebo ID", L4-50) also finds a player by the exact
 * platform ID; the application looks up the in-game name of window 1.
 */
export function findPreviousPlayers(
    games: readonly HistoryGame[],
    nameOrId: string,
    limit = 3
): PreviousPlayer[] {
    const wanted = normalizePlayerName(nameOrId)
    if (!wanted) return []
    const wantedId = nameOrId.trim().toLowerCase()
    const found = new Map<string, PreviousPlayer & { exact: boolean }>()
    for (const game of games)
        for (const player of game.players) {
            const name = player.name?.trim()
            if (!name || !player.platformId.trim()) continue
            const normalized = normalizePlayerName(name)
            const exact =
                normalized === wanted ||
                player.platformId.trim().toLowerCase() === wantedId
            const partial =
                !exact &&
                wanted.length >= 3 &&
                normalized.length >= 3 &&
                (normalized.includes(wanted) || wanted.includes(normalized))
            if (!exact && !partial) continue
            const platform = platformOf(player)
            const key = `${platform}:${player.platformId.trim()}`
            const previous = found.get(key)
            if (previous && previous.lastSeenAt >= game.endedAt) continue
            found.set(key, {
                key,
                name,
                platform,
                platformId: player.platformId.trim(),
                lastSeenAt: game.endedAt,
                serverName: game.serverName,
                exact: exact || Boolean(previous?.exact),
            })
        }
    return [...found.values()]
        .sort(
            (a, b) =>
                Number(b.exact) - Number(a.exact) ||
                b.lastSeenAt.localeCompare(a.lastSeenAt)
        )
        .slice(0, limit)
        .map((player) => ({
            key: player.key,
            name: player.name,
            platform: player.platform,
            platformId: player.platformId,
            lastSeenAt: player.lastSeenAt,
            serverName: player.serverName,
        }))
}
