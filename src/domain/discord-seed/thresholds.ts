import type { SeedThresholds } from "./plan"

/**
 * Live/not-live with hysteresis (owner decision 40/20): a server becomes live
 * at `liveFrom` players and stops being live only when it drops below
 * `startBelow`. In between it keeps its previous phase, so a live server at 36
 * players still reads "Živě" (P5-27).
 */
export type SeedServerPhase = "live" | "not_live"

export function nextSeedServerPhase(
    previous: SeedServerPhase | null,
    players: number,
    thresholds: SeedThresholds
): SeedServerPhase {
    if (players >= thresholds.liveFrom) return "live"
    if (players < thresholds.startBelow) return "not_live"
    return previous ?? "not_live"
}

/** A running seed ends at the live threshold. */
export function reachesLive(players: number, thresholds: SeedThresholds) {
    return players >= thresholds.liveFrom
}

/** Scheduled and automatic seeds start only below this threshold. */
export function isBelowStart(players: number, thresholds: SeedThresholds) {
    return players < thresholds.startBelow
}

/**
 * The status chips of the dashboard and the control message:
 * - `unknown`: no fresh reading ("Bez dat");
 * - `offline`: the provider reports the server offline;
 * - `live`: live by hysteresis ("Živě");
 * - `below_start`: under the start threshold ("Pod hranicí startu" / "Prázdný");
 * - `filling`: between the thresholds and not live yet.
 */
export type SeedServerStatus =
    "unknown" | "offline" | "live" | "below_start" | "filling"

export function seedServerStatus(
    input: {
        phase: SeedServerPhase | null
        players: number | null
        online: boolean | null
        fresh: boolean
    },
    thresholds: SeedThresholds
): SeedServerStatus {
    if (!input.fresh) return "unknown"
    if (input.online === false) return "offline"
    if (input.players === null) return "unknown"
    const phase = nextSeedServerPhase(input.phase, input.players, thresholds)
    if (phase === "live") return "live"
    return isBelowStart(input.players, thresholds) ? "below_start" : "filling"
}
