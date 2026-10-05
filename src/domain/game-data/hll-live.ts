import { z } from "zod"

const text = z.string().min(1).max(200)
const metric = z.number().finite().nonnegative().nullable()
const count = z.number().int().nonnegative().safe()
const age = z.enum(["fresh", "stale", "unavailable"])
export const hllLiveSchema = z.strictObject({
    fetchedAt: z.iso.datetime(),
    statusAt: z.iso.datetime().nullable(),
    playersAt: z.iso.datetime().nullable(),
    statusFreshness: age,
    playersFreshness: age,
    refreshAfterSeconds: z.number().int().min(15).max(86400),
    status: z
        .strictObject({
            serverName: text,
            map: text.nullable(),
            layerId: text.nullable(),
            mode: text.nullable(),
            roundStartedAt: z.iso.datetime().nullable(),
            playerCount: count,
            maxPlayers: count,
            scores: z
                .array(
                    z.strictObject({
                        team: z.enum(["allies", "axis"]),
                        score: count,
                    })
                )
                .max(2),
            timeRemainingSeconds: metric,
            /**
             * Optional CRCON facts (P4-02, P4-B03): shown only when the
             * server reports them; older cached reads have none.
             */
            environment: text.nullable().optional(),
            queueCount: count.nullable().optional(),
            nextMap: z
                .strictObject({
                    name: text,
                    layerId: text.nullable(),
                    mode: text.nullable(),
                    environment: text.nullable(),
                })
                .nullable()
                .optional(),
        })
        .nullable(),
    players: z
        .array(
            z.strictObject({
                playerId: text.nullable(),
                name: text,
                team: z.enum(["allies", "axis"]).nullable(),
                kills: metric,
                deaths: metric,
                combat: metric,
                offense: metric,
                defense: metric,
                support: metric,
            })
        )
        .max(300),
    warnings: z
        .array(
            z.enum([
                "status_unavailable",
                "players_unavailable",
                "round_unconfirmed",
                "round_changed",
                "stale_players",
            ])
        )
        .max(5),
})
export type HllLive = z.infer<typeof hllLiveSchema>
export const hllLiveEnvelopeSchema = z.strictObject({
    connectionId: text,
    gameId: z.literal("hell_let_loose"),
    provider: z.literal("hll_crcon"),
    data: hllLiveSchema,
})
export type HllLiveEnvelope = z.infer<typeof hllLiveEnvelopeSchema>

/** Cache reads age the original observations; failures can never become fresh again. */
export function ageHllLive(value: HllLive, now: number): HllLive {
    const ageOf = (at: string | null, original: HllLive["statusFreshness"]) => {
        if (!at || original === "unavailable") return "unavailable" as const
        const elapsed = now - Date.parse(at)
        return original === "fresh" && elapsed >= -5000 && elapsed <= 60_000
            ? ("fresh" as const)
            : ("stale" as const)
    }
    return {
        ...value,
        statusFreshness: ageOf(value.statusAt, value.statusFreshness),
        playersFreshness: ageOf(value.playersAt, value.playersFreshness),
    }
}

export function hllLeaders(
    players: HllLive["players"],
    team?: "allies" | "axis"
) {
    return players
        .filter((p) => p.kills !== null && (!team || p.team === team))
        .slice()
        .sort((a, b) => b.kills! - a.kills! || a.name.localeCompare(b.name))
        .slice(0, 3)
}

const maps: Record<string, string> = {
    carentan: "carentan",
    driel: "driel",
    elalamein: "el-alamein",
    elsenbornridge: "elsenborn-ridge",
    foy: "foy",
    hill400: "hill-400",
    hurtgenforest: "hurtgen-forest",
    hurtgen: "hurtgen-forest",
    kharkov: "kharkov",
    kursk: "kursk",
    mortain: "mortain",
    omahabeach: "omaha-beach",
    purpleheartlane: "purple-heart-lane",
    remagen: "remagen",
    stalingrad: "stalingrad",
    stmariedumont: "st-marie-du-mont",
    saintemariedumont: "st-marie-du-mont",
    stmereeglise: "st-mere-eglise",
    saintemereeglise: "st-mere-eglise",
    utahbeach: "utah-beach",
    smolensk: "smolensk",
    tobruk: "tobruk",
    junobeach: "juno-beach",
}
export function hllMapArtwork(value: string | null | undefined) {
    if (!value || value.length > 200 || /[\\/]/.test(value))
        return "/img/games/hll.jpg"
    const key = value
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/(?:[ _-](?:warfare|offensive|skirmish)).*$/, "")
        .replace(/[^a-z0-9]/g, "")
    return maps[key] ? `/maps/${maps[key]}.webp` : "/img/games/hll.jpg"
}
