import { seedProgress, type SeedProgress } from "@/domain/discord-seed/progress"
import { isSeedRunActive } from "@/domain/discord-seed/run"

import type { StoredSeedRun } from "./ports"

/**
 * What a server panel needs for its seed mode (P5-15..19, P5-B05): the chip
 * "Seedujeme", the progress towards the live threshold, "Seed běží od 17:40"
 * and the "Otevřít výzvu" link. The panels workstream reads it through
 * {@link SeedPanelStatePort}; panels never start or stop seeds.
 */
export type SeedPanelState = {
    connectionId: string
    runId: string
    startedAt: number
    liveFrom: number
    /**
     * The run's latest player count, the number the call shows. The panel's
     * seed bar and count read it too, so both show one number (P5-16); null
     * before the run has a reading.
     */
    players: number | null
    /** The call to link to; null until the bot has posted it. */
    call: { channelId: string; messageId: string } | null
}

export type SeedPanelStatePort = {
    /** Running seeds of one clan, one per server at most. */
    activeSeeds(guildId: string): Promise<SeedPanelState[]>
}

export function toSeedPanelState(
    run: StoredSeedRun,
    callMessageId: string | null
): SeedPanelState | null {
    if (!isSeedRunActive(run)) return null
    return {
        connectionId: run.connectionId,
        runId: run.id,
        startedAt: run.startedAt,
        liveFrom: run.liveFrom,
        players: run.players.latest,
        call: callMessageId
            ? { channelId: run.channelId, messageId: callMessageId }
            : null,
    }
}

/**
 * The player count a server panel shows while its server seeds: the run's
 * latest reading, which the call shows too (P5-16). The panel's own live
 * count stands in only until the run has its first reading.
 */
export function seedPanelPlayers(
    state: Pick<SeedPanelState, "players">,
    own: number | null
): number | null {
    return state.players ?? own
}

/** The panel's seed bar, from the same count as the call (P5-16). */
export function seedPanelProgress(
    state: Pick<SeedPanelState, "liveFrom" | "players">,
    own: number | null
): SeedProgress {
    return seedProgress(seedPanelPlayers(state, own), state.liveFrom)
}
