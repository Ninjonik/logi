/**
 * The 10-segment progress bar towards the live threshold (P5-B07), shared by
 * the call, the server panel in seed mode and the dashboard preview, so all
 * three show the same number:
 *   12 / 40 → ▰▰▰▱▱▱▱▱▱▱   31 / 40 → ▰▰▰▰▰▰▰▰▱▱
 */
export const SEED_PROGRESS_SEGMENTS = 10
export const SEED_PROGRESS_FILLED = "▰"
export const SEED_PROGRESS_EMPTY = "▱"

/**
 * `starting` and `close` select the call's body text ("Připoj se a pomoz
 * nastartovat server." / "Už jen 9 hráčů do živé hry."); `live` is reached.
 */
export type SeedProgressStage = "starting" | "close" | "live"

export type SeedProgress = {
    players: number | null
    liveFrom: number
    filled: number
    bar: string
    /** Players still missing to the live threshold, or null without a reading. */
    missing: number | null
    stage: SeedProgressStage
}

export function seedProgress(
    players: number | null,
    liveFrom: number
): SeedProgress {
    if (!Number.isInteger(liveFrom) || liveFrom < 1)
        throw new RangeError("The live threshold must be a positive integer.")
    if (players !== null && (!Number.isInteger(players) || players < 0))
        throw new RangeError("A player count must be a whole number.")
    const count = players
    const reached = count !== null && count >= liveFrom
    // Rounded to the nearest segment; a full bar is kept for a live server.
    const filled =
        count === null
            ? 0
            : reached
              ? SEED_PROGRESS_SEGMENTS
              : Math.min(
                    SEED_PROGRESS_SEGMENTS - 1,
                    Math.round((count / liveFrom) * SEED_PROGRESS_SEGMENTS)
                )
    const missing = count === null ? null : Math.max(0, liveFrom - count)
    return {
        players: count,
        liveFrom,
        filled,
        bar:
            SEED_PROGRESS_FILLED.repeat(filled) +
            SEED_PROGRESS_EMPTY.repeat(SEED_PROGRESS_SEGMENTS - filled),
        missing,
        stage: reached
            ? "live"
            : missing !== null && missing <= Math.ceil(liveFrom / 4)
              ? "close"
              : "starting",
    }
}
