import type {
    NewSeedRun,
    SeedMessagePort,
    SeedPlayerCountPort,
    SeedPorts,
    SeedServerReading,
    SeedServerRef,
    SeedStore,
    StoredSeedPlan,
    StoredSeedRun,
} from "@/application/discord-seed/ports"
import {
    initialSeedPlanState,
    type SeedPlanSettings,
    type SeedPlanState,
} from "@/domain/discord-seed/plan"

import { FakeClock } from "./fake-clock"

const keyOf = (server: SeedServerRef) =>
    `${server.guildId}:${server.connectionId}`

/** In-memory seed persistence with the same scoping rules as the Convex adapter. */
export class InMemorySeedStore implements SeedStore {
    plans = new Map<string, StoredSeedPlan>()
    runs = new Map<string, StoredSeedRun>()
    timeZones = new Map<string, string>()
    paused = new Set<string>()
    private sequence = 0

    addPlan(
        server: SeedServerRef,
        settings: SeedPlanSettings,
        state: Partial<SeedPlanState> = {}
    ): StoredSeedPlan {
        const plan: StoredSeedPlan = {
            ...server,
            id: `plan-${++this.sequence}`,
            settings,
            state: { ...initialSeedPlanState(), ...state },
            revision: 1,
        }
        this.plans.set(keyOf(server), plan)
        return plan
    }

    pause(server: SeedServerRef) {
        this.paused.add(keyOf(server))
    }

    async plansToEvaluate() {
        return [...this.plans.values()].filter(
            (plan) => plan.settings.enabled || plan.state.activeRunId !== null
        )
    }

    async plan(server: SeedServerRef) {
        const plan = this.plans.get(keyOf(server))
        return plan ? structuredClone(plan) : null
    }

    async savePlanSettings(input: {
        server: SeedServerRef
        settings: SeedPlanSettings
        revision: number
        updatedBy: string
    }) {
        const existing = this.plans.get(keyOf(input.server))
        const plan: StoredSeedPlan = {
            ...input.server,
            id: existing?.id ?? `plan-${++this.sequence}`,
            settings: input.settings,
            state: existing?.state ?? initialSeedPlanState(),
            revision: input.revision,
        }
        this.plans.set(keyOf(input.server), plan)
        return structuredClone(plan)
    }

    async savePlanState(planId: string, state: SeedPlanState) {
        const plan = [...this.plans.values()].find((row) => row.id === planId)
        if (!plan) throw new Error("Missing plan")
        plan.state = structuredClone(state)
    }

    async run(id: string) {
        const run = this.runs.get(id)
        return run ? structuredClone(run) : null
    }

    async runByRequestKey(server: SeedServerRef, requestKey: string) {
        const run = [...this.runs.values()].find(
            (row) =>
                keyOf(row) === keyOf(server) && row.requestKey === requestKey
        )
        return run ? structuredClone(run) : null
    }

    async runsSince(server: SeedServerRef, since: number, limit: number) {
        return [...this.runs.values()]
            .filter(
                (run) => keyOf(run) === keyOf(server) && run.startedAt >= since
            )
            .sort((a, b) => b.startedAt - a.startedAt)
            .slice(0, limit)
            .map((run) => structuredClone(run))
    }

    async insertRun(run: NewSeedRun) {
        const id = `run-${++this.sequence}`
        this.runs.set(id, structuredClone({ ...run, id }))
        return id
    }

    async saveRun(run: StoredSeedRun) {
        if (!this.runs.has(run.id)) throw new Error("Missing run")
        this.runs.set(run.id, structuredClone(run))
    }

    async lastRolePingAt(guildId: string, roleId: string) {
        const times = [...this.plans.values()]
            .filter(
                (plan) =>
                    plan.guildId === guildId &&
                    plan.settings.seedRoleId === roleId &&
                    plan.state.lastPingAt !== null
            )
            .map((plan) => plan.state.lastPingAt!)
        return times.length ? Math.max(...times) : null
    }

    async timeZone(guildId: string) {
        return this.timeZones.get(guildId) ?? "UTC"
    }

    async isPaused(server: SeedServerRef) {
        return this.paused.has(keyOf(server))
    }
}

export class FakeSeedPlayerCounts implements SeedPlayerCountPort {
    readings = new Map<string, SeedServerReading | null>()

    set(server: SeedServerRef, reading: SeedServerReading | null) {
        this.readings.set(keyOf(server), reading)
    }

    async read(server: SeedServerRef) {
        return this.readings.get(keyOf(server)) ?? null
    }
}

export type RecordedSeedMessage =
    | { kind: "call"; runId: string; status: StoredSeedRun["status"] }
    | { kind: "control"; connectionId: string }
    | { kind: "intro"; guildId: string }

export class RecordingSeedMessages implements SeedMessagePort {
    requests: RecordedSeedMessage[] = []

    async callChanged(run: StoredSeedRun) {
        this.requests.push({ kind: "call", runId: run.id, status: run.status })
    }

    async controlChanged(server: SeedServerRef) {
        this.requests.push({
            kind: "control",
            connectionId: server.connectionId,
        })
    }

    async introChanged(guildId: string) {
        this.requests.push({ kind: "intro", guildId })
    }
}

/** Vlci #1 · Public of the design boards. */
export const SEED_TEST_SERVER: SeedServerRef = {
    guildId: "100000000000000000",
    connectionId: "gameDataConnections:vlci1",
}
export const SEED_TEST_CHANNEL = "111111111111111111"
export const SEED_TEST_CONTROL_CHANNEL = "222222222222222222"
export const SEED_TEST_ROLE = "333333333333333333"

/** The plan drawn on the P3 board: Po–Pá 17:00, automatically under 20 between 15:00 and 22:00. */
export function boardSeedSettings(
    overrides: Partial<SeedPlanSettings> = {}
): SeedPlanSettings {
    return {
        enabled: true,
        liveFrom: 40,
        startBelow: 20,
        schedule: {
            enabled: true,
            slots: [{ days: [1, 2, 3, 4, 5], time: "17:00" }],
        },
        auto: { enabled: true, below: 20, from: "15:00", to: "22:00" },
        seedChannelId: SEED_TEST_CHANNEL,
        controlChannelId: SEED_TEST_CONTROL_CHANNEL,
        seedRoleId: SEED_TEST_ROLE,
        roleSelfService: true,
        pingWindowMinutes: 240,
        cooldownMinutes: 120,
        maxDurationMinutes: 120,
        template: null,
        endAction: "edit",
        ...overrides,
    }
}

/** A fresh online reading taken `observedAt`. */
export function seedReading(
    players: number,
    observedAt: number,
    overrides: Partial<SeedServerReading> = {}
): SeedServerReading {
    return {
        name: "Vlci #1 · Public",
        gameId: "hell_let_loose",
        players,
        capacity: 100,
        map: "Foy",
        online: true,
        observedAt,
        fresh: true,
        ...overrides,
    }
}

export function createSeedTestPorts(now: Date) {
    const store = new InMemorySeedStore()
    const players = new FakeSeedPlayerCounts()
    const clock = new FakeClock(now)
    const messages = new RecordingSeedMessages()
    const ports: SeedPorts = { store, players, clock, messages }
    return { store, players, clock, messages, ports }
}
