import {
    hllLiveSchema,
    ageHllLive,
    type HllLive,
} from "../../domain/game-data/hll-live"
import {
    ProviderError,
    type ProviderHttp,
} from "../../domain/game-data/contracts"
import { crconResult } from "./hll-crcon"
import { z } from "zod"

const text = z.string().min(1).max(200)
const count = z.number().int().nonnegative().safe()
const number = z
    .number()
    .finite()
    .nonnegative()
    .nullish()
    .transform((v) => v ?? null)
const mapSchema = z.object({
    id: text.optional(),
    pretty_name: text,
    game_mode: text.optional(),
    /** CRCON 10+: "day", "night", "dusk", …; absent on older servers. */
    environment: text.nullish(),
})
const infoSchema = z.object({
    name: z.object({ name: text }),
    current_map: z
        .object({
            start: z.number().finite().nullish(),
            map: mapSchema.nullable(),
        })
        .nullable(),
    next_map: z.object({ map: mapSchema.nullable() }).nullish().catch(null),
    player_count: count,
    max_player_count: count,
    /** Only some CRCON builds report the join queue; never guessed. */
    queue_count: count.nullish().catch(null),
    score: z.object({ allied: count, axis: count }).nullable(),
    time_remaining: number,
})
const playerSchema = z.object({
    player: text,
    player_id: text.nullish(),
    status: z.string().max(30).nullish(),
    team: z.string().max(30).nullish(),
    kills: number,
    deaths: number,
    combat: number,
    offense: number,
    defense: number,
    support: number,
})
const statsSchema = z.object({
    snapshot_timestamp: z.number().finite().positive(),
    refresh_interval_sec: z.number().finite().min(1).max(86400),
    // Rows include players who left during the match; only online rows are kept.
    stats: z.array(playerSchema).max(2000),
})
function timestamp(seconds: number | null | undefined, now: number) {
    return seconds && seconds > 0 && seconds * 1000 <= now + 5000
        ? new Date(seconds * 1000).toISOString()
        : null
}
function status(body: unknown, now: number): NonNullable<HllLive["status"]> {
    const data = infoSchema.parse(crconResult(body))
    return {
        serverName: data.name.name,
        map: data.current_map?.map?.pretty_name ?? null,
        layerId: data.current_map?.map?.id ?? null,
        mode: data.current_map?.map?.game_mode ?? null,
        roundStartedAt: timestamp(data.current_map?.start, now),
        playerCount: data.player_count,
        maxPlayers: data.max_player_count,
        scores: data.score
            ? [
                  { team: "allies", score: data.score.allied },
                  { team: "axis", score: data.score.axis },
              ]
            : [],
        timeRemainingSeconds: data.time_remaining,
        environment: data.current_map?.map?.environment ?? null,
        queueCount: data.queue_count ?? null,
        nextMap: data.next_map?.map
            ? {
                  name: data.next_map.map.pretty_name,
                  layerId: data.next_map.map.id ?? null,
                  mode: data.next_map.map.game_mode ?? null,
                  environment: data.next_map.map.environment ?? null,
              }
            : null,
    }
}
const delay = (error: unknown) =>
    Math.min(
        86400,
        Math.max(
            30,
            Math.ceil(
                error instanceof ProviderError
                    ? (error.retryAfterMs ?? 30_000) / 1000
                    : 30
            )
        )
    )
export async function readHllLive(
    http: ProviderHttp,
    now: () => number,
    previous?: HllLive
): Promise<HllLive> {
    const result: HllLive = {
        fetchedAt: new Date(now()).toISOString(),
        statusAt: null,
        playersAt: null,
        status: null,
        players: [],
        statusFreshness: "unavailable",
        playersFreshness: "unavailable",
        refreshAfterSeconds: 15,
        warnings: [],
    }
    try {
        result.status = status(
            (await http.get("/api/get_public_info")).body,
            now()
        )
        result.statusAt = new Date(now()).toISOString()
        result.statusFreshness = "fresh"
    } catch (error) {
        if (previous?.status) {
            result.status = previous.status
            result.statusAt = previous.statusAt
            result.statusFreshness = "stale"
        }
        result.refreshAfterSeconds = delay(error)
        result.warnings = ["status_unavailable", "players_unavailable"]
        return hllLiveSchema.parse(result)
    }
    try {
        const data = statsSchema.parse(
            crconResult((await http.get("/api/get_live_game_stats")).body)
        )
        result.refreshAfterSeconds = Math.max(
            15,
            Math.ceil(data.refresh_interval_sec)
        )
        // Bracket statistics with status reads to fence a round change during the request.
        const after = status(
            (await http.get("/api/get_public_info")).body,
            now()
        )
        const before = result.status
        result.status = after
        result.statusAt = new Date(now()).toISOString()
        const observed = timestamp(data.snapshot_timestamp, now())
        if (
            !after.roundStartedAt ||
            !before.roundStartedAt ||
            !before.layerId ||
            !after.layerId
        ) {
            result.warnings.push("round_unconfirmed")
        } else if (
            before.roundStartedAt !== after.roundStartedAt ||
            before.layerId !== after.layerId ||
            before.map !== after.map
        ) {
            result.warnings.push("round_changed")
        } else if (
            !observed ||
            Date.parse(observed) < Date.parse(after.roundStartedAt)
        ) {
            result.warnings.push("round_unconfirmed")
        } else {
            result.playersAt = observed
            result.playersFreshness = "fresh"
            result.players = data.stats
                .filter((p) => p.status === "online")
                .slice(0, 300)
                .map((p) => ({
                    playerId: p.player_id ?? null,
                    name: p.player,
                    team:
                        p.team === "allies" || p.team === "allied"
                            ? "allies"
                            : p.team === "axis"
                              ? "axis"
                              : null,
                    kills: p.kills,
                    deaths: p.deaths,
                    combat: p.combat,
                    offense: p.offense,
                    defense: p.defense,
                    support: p.support,
                }))
        }
    } catch (error) {
        result.refreshAfterSeconds = Math.max(
            result.refreshAfterSeconds,
            delay(error)
        )
        result.warnings.push("players_unavailable")
    }
    const aged = ageHllLive(result, now())
    if (aged.playersFreshness === "stale") aged.warnings.push("stale_players")
    return hllLiveSchema.parse(aged)
}
