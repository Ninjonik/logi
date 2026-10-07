/**
 * A seed plan belongs to one game server of a clan (P3 "Plán seedu"). Owner
 * decisions: live from 40 players, a seed starts under 20, at least 2 h between
 * seed starts, at most one Seed role ping per 4 h, and a maximum duration.
 * Every value is editable.
 *
 * The Zod schema and `parseSeedPlanSettings` live in `plan.schema.ts`, so the
 * seed tick and the bot's seed reads never load Zod.
 */

export const SEED_DEFAULTS = {
    liveFrom: 40,
    startBelow: 20,
    autoBelow: 20,
    autoFrom: "15:00",
    autoTo: "22:00",
    scheduleDays: [1, 2, 3, 4, 5],
    scheduleTime: "17:00",
    pingWindowMinutes: 4 * 60,
    cooldownMinutes: 2 * 60,
    maxDurationMinutes: 2 * 60,
} as const

export const SEED_LIMITS = {
    liveFrom: { min: 2, max: 250 },
    startBelow: { min: 1, max: 249 },
    pingWindowMinutes: { min: 60, max: 7 * 24 * 60 },
    cooldownMinutes: { min: 30, max: 24 * 60 },
    maxDurationMinutes: { min: 15, max: 12 * 60 },
    scheduleSlots: 7,
} as const

export type SeedEndAction = "edit" | "delete"

/** One weekly slot: the chosen weekdays (0 = Sunday … 6 = Saturday) at one local time. */
export type SeedScheduleSlot = { days: number[]; time: string }

export type SeedPlanSettings = {
    enabled: boolean
    /** The server is live from this many players; a running seed ends there. */
    liveFrom: number
    /** Scheduled and automatic seeds start only below this many players. */
    startBelow: number
    schedule: { enabled: boolean; slots: SeedScheduleSlot[] }
    /** Start when the server drops below `below` players between `from` and `to` (local time). */
    auto: { enabled: boolean; below: number; from: string; to: string }
    seedChannelId: string | null
    /** The private admin channel with one "Ovládání serveru" message per server. */
    controlChannelId: string | null
    seedRoleId: string | null
    /** Players toggle the Seed role themselves with "Zvát mě na seed". */
    roleSelfService: boolean
    /** At most one Seed role ping in this window; a seed inside it runs without a ping. */
    pingWindowMinutes: number
    /** Minimum time between two seed starts on this server. */
    cooldownMinutes: number
    /** A seed ends after this long even below the live threshold. */
    maxDurationMinutes: number
    /** Admin call text; null uses the clan-language default. */
    template: string | null
    /** At the live threshold: edit the call to "Server je živý" or delete it. */
    endAction: SeedEndAction
}

export function defaultSeedPlanSettings(): SeedPlanSettings {
    return {
        enabled: false,
        liveFrom: SEED_DEFAULTS.liveFrom,
        startBelow: SEED_DEFAULTS.startBelow,
        schedule: {
            enabled: false,
            slots: [
                {
                    days: [...SEED_DEFAULTS.scheduleDays],
                    time: SEED_DEFAULTS.scheduleTime,
                },
            ],
        },
        auto: {
            enabled: false,
            below: SEED_DEFAULTS.autoBelow,
            from: SEED_DEFAULTS.autoFrom,
            to: SEED_DEFAULTS.autoTo,
        },
        seedChannelId: null,
        controlChannelId: null,
        seedRoleId: null,
        roleSelfService: true,
        pingWindowMinutes: SEED_DEFAULTS.pingWindowMinutes,
        cooldownMinutes: SEED_DEFAULTS.cooldownMinutes,
        maxDurationMinutes: SEED_DEFAULTS.maxDurationMinutes,
        template: null,
        endAction: "edit",
    }
}

/** Runtime memory of a plan, written only by the seed workflows. */
export type SeedPlanState = {
    /** Hysteresis memory: live from `liveFrom`, not live again only below `startBelow`. */
    phase: "live" | "not_live" | null
    lastStartedAt: number | null
    lastPingAt: number | null
    /** Last time a fresh reading showed at least `liveFrom` players. */
    lastLiveAt: number | null
    lastAutoStartAt: number | null
    /** The last schedule occurrence that was decided (started or skipped). */
    consumedOccurrence: string | null
    activeRunId: string | null
}

export function initialSeedPlanState(): SeedPlanState {
    return {
        phase: null,
        lastStartedAt: null,
        lastPingAt: null,
        lastLiveAt: null,
        lastAutoStartAt: null,
        consumedOccurrence: null,
        activeRunId: null,
    }
}

export type SeedPlanIssueCode =
    | "invalid"
    | "start_below_not_under_live"
    | "auto_below_above_start"
    | "auto_window_empty"
    | "schedule_without_slots"
    | "duplicate_day"
    | "duplicate_slot"
    | "seed_channel_required"
    | "control_channel_same_as_seed"
    | "unknown_placeholder"
    | "live_above_capacity"

export type SeedPlanIssue = { path: string; code: SeedPlanIssueCode }
export type SeedPlanParse =
    | { ok: true; plan: SeedPlanSettings }
    | { ok: false; issues: SeedPlanIssue[] }

/**
 * A server can never reach a live threshold above its capacity; checked when
 * the capacity is known from the provider.
 */
export function seedPlanCapacityIssues(
    plan: Pick<SeedPlanSettings, "liveFrom">,
    capacity: number | null
): SeedPlanIssue[] {
    return capacity !== null && plan.liveFrom > capacity
        ? [{ path: "liveFrom", code: "live_above_capacity" }]
        : []
}

/** The thresholds a running seed keeps, read from the plan at start. */
export type SeedThresholds = Pick<SeedPlanSettings, "liveFrom" | "startBelow">
