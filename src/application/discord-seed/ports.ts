import type {
    SeedPlanSettings,
    SeedPlanState,
} from "@/domain/discord-seed/plan"
import type { SeedObservation, SeedRun } from "@/domain/discord-seed/run"
import type { SeedTriggerReading } from "@/domain/discord-seed/triggers"
import type { Clock } from "@/application/ports/clock"

/** One game server of a clan: the clan's Discord ID and its game-data connection. */
export type SeedServerRef = { guildId: string; connectionId: string }

/**
 * The latest provider reading of a server: the same collected snapshot the
 * server panels read, so a call, a panel and the dashboard show one number.
 */
export type SeedServerReading = {
    name: string | null
    gameId: "hell_let_loose" | "wardogs"
    players: number | null
    capacity: number | null
    map: string | null
    online: boolean | null
    observedAt: number | null
    /** Only a fresh reading may start, progress or end a seed. */
    fresh: boolean
}

export type SeedPlayerCountPort = {
    /** Null when the connection is not (or no longer) a server of this clan. */
    read(server: SeedServerRef): Promise<SeedServerReading | null>
}

export type StoredSeedPlan = SeedServerRef & {
    id: string
    settings: SeedPlanSettings
    state: SeedPlanState
    revision: number
}

export type StoredSeedRun = SeedRun &
    SeedServerRef & {
        id: string
        planId: string
        /** The seed channel at the start; the call never moves channels. */
        channelId: string
        /** Idempotency key of a manual start (a click or a request ID). */
        requestKey: string | null
        serverName: string | null
    }

export type NewSeedRun = Omit<StoredSeedRun, "id">

export type SeedStoreReader = {
    /** Plans that are on or still have a running seed. */
    plansToEvaluate(): Promise<StoredSeedPlan[]>
    plan(server: SeedServerRef): Promise<StoredSeedPlan | null>
    run(id: string): Promise<StoredSeedRun | null>
    runByRequestKey(
        server: SeedServerRef,
        requestKey: string
    ): Promise<StoredSeedRun | null>
    /** Runs started at or after `since`, newest first. */
    runsSince(
        server: SeedServerRef,
        since: number,
        limit: number
    ): Promise<StoredSeedRun[]>
    /** Latest ping of this role by any plan of the clan (the ping window is per role). */
    lastRolePingAt(guildId: string, roleId: string): Promise<number | null>
    /** The clan's IANA time zone for schedules and windows. */
    timeZone(guildId: string): Promise<string>
    /** Whether the server's panel is paused ("Pozastavit panel"). */
    isPaused(server: SeedServerRef): Promise<boolean>
}

export type SeedStore = SeedStoreReader & {
    /** Creates or replaces the settings; the runtime state is never touched here. */
    savePlanSettings(input: {
        server: SeedServerRef
        settings: SeedPlanSettings
        revision: number
        updatedBy: string
    }): Promise<StoredSeedPlan>
    savePlanState(planId: string, state: SeedPlanState): Promise<void>
    insertRun(run: NewSeedRun): Promise<string>
    saveRun(run: StoredSeedRun): Promise<void>
}

/**
 * Discord work the seed workflows ask for. Convex records each request
 * durably for the bot, which posts, edits or deletes the message; edits never
 * ping.
 */
export type SeedMessagePort = {
    /** Post, re-render, finalize or delete the run's call. */
    callChanged(run: StoredSeedRun): Promise<void>
    /** Re-render the server's "Ovládání serveru" message. */
    controlChanged(server: SeedServerRef): Promise<void>
    /** Post, update or remove the pinned intros of the clan's seed channels. */
    introChanged(guildId: string): Promise<void>
}

export type SeedPorts = {
    store: SeedStore
    players: SeedPlayerCountPort
    clock: Clock
    messages: SeedMessagePort
}

/** A reading the triggers may act on, or null without fresh provider data. */
export function triggerReading(
    reading: SeedServerReading | null
): SeedTriggerReading | null {
    if (!reading?.fresh) return null
    if (reading.online === false)
        return { players: reading.players ?? 0, online: false }
    return reading.players === null
        ? null
        : { players: reading.players, online: reading.online }
}

/** The observation a run records, or null without a fresh online count. */
export function runObservation(
    reading: SeedServerReading | null
): SeedObservation | null {
    if (
        !reading?.fresh ||
        reading.online === false ||
        reading.players === null ||
        reading.observedAt === null
    )
        return null
    return {
        players: reading.players,
        capacity: reading.capacity,
        map: reading.map,
        observedAt: reading.observedAt,
    }
}
