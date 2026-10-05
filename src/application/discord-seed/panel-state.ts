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
        call: callMessageId
            ? { channelId: run.channelId, messageId: callMessageId }
            : null,
    }
}

/**
 * The panel's progress from its own fresh player count. The call reads the
 * same collected snapshot, so both show the same number (P5-16).
 */
export function seedPanelProgress(
    state: Pick<SeedPanelState, "liveFrom">,
    players: number | null
): SeedProgress {
    return seedProgress(players, state.liveFrom)
}
