/** Serialize only persistence work. Slow Discord fetches stay outside this queue. */
export class GuildMembershipIngress {
    private readonly pending = new Map<string, Promise<void>>()
    run<T>(guildId: string, work: () => Promise<T>): Promise<T> {
        const result = (this.pending.get(guildId) ?? Promise.resolve()).then(
            work
        )
        const tail = result.then(
            () => {},
            () => {}
        )
        this.pending.set(guildId, tail)
        void tail.then(() => {
            if (this.pending.get(guildId) === tail) this.pending.delete(guildId)
        })
        return result
    }
}

/** Least time between two full reconciliations of a guild nothing invalidated. */
export const FULL_RECONCILIATION_GAP_MS = 6 * 60 * 60_000
/** Wait after a member fetch that failed or came back incomplete. */
export const FETCH_RETRY_MS = 15 * 60_000

/**
 * When the bot reconciles a guild's members in full. Each run writes one
 * observation per member, so it runs at most every six hours while nothing
 * invalidated the guild, at once after an invalidation or a change of the
 * dashboard manager role (which decides `hasDashboardAccess`), and never
 * sooner than fifteen minutes after a fetch that failed, whatever happened
 * meanwhile: Discord did not answer, so asking again at once is no better.
 */
export class MembershipReconciliationSchedule {
    private readonly completed = new Map<
        string,
        { at: number; dashboardRoleId: string }
    >()
    private readonly retryAt = new Map<string, number>()
    constructor(private readonly now: () => number = Date.now) {}
    due(guildId: string, dashboardRoleId = "") {
        if ((this.retryAt.get(guildId) ?? 0) > this.now()) return false
        const last = this.completed.get(guildId)
        return (
            !last ||
            last.dashboardRoleId !== dashboardRoleId ||
            this.now() - last.at >= FULL_RECONCILIATION_GAP_MS
        )
    }
    complete(guildId: string, dashboardRoleId = "") {
        this.completed.set(guildId, { at: this.now(), dashboardRoleId })
        this.retryAt.delete(guildId)
    }
    fetchFailed(guildId: string) {
        this.retryAt.set(guildId, this.now() + FETCH_RETRY_MS)
    }
    invalidate(guildId: string) {
        this.completed.delete(guildId)
    }
}

export type FetchedMember = {
    discordUserId: string
    roleIds: string[]
    isAdmin: boolean
    hasDashboardAccess: boolean
}
/**
 * `complete`: every member stored and absence swept. `incomplete`: Discord
 * gave no complete member list, nothing was written. `superseded`: a newer
 * epoch replaced the run (an invalidation during it); the invalidation asks
 * for a new run, so this is not an error.
 */
export type ReconciliationOutcome = "complete" | "incomplete" | "superseded"

/**
 * One full reconciliation. The start (epoch and revision) is read before the
 * fetch, and the run is inserted only once the fetch proved complete, so a
 * failed or partial fetch writes nothing. `superseded` tells a refusal by a
 * newer epoch apart from a real failure, which is rethrown.
 */
export async function reconcileMembershipSnapshot<Start>(ports: {
    start(): Promise<Start | null>
    /** Every member of the guild, or null when Discord did not give them all. */
    fetchComplete(): Promise<FetchedMember[] | null>
    begin(start: Start): Promise<{ id: string } | null>
    batch(
        runId: string,
        batch: number,
        expectedCount: number,
        members: FetchedMember[]
    ): Promise<unknown>
    finish(runId: string): Promise<{ isDone: boolean }>
    superseded(error: unknown): boolean
}): Promise<ReconciliationOutcome> {
    try {
        const start = await ports.start()
        if (!start) return "superseded"
        const members = await ports.fetchComplete()
        if (!members) return "incomplete"
        const run = await ports.begin(start)
        if (!run) return "superseded"
        const count = Math.max(1, Math.ceil(members.length / 100))
        for (let batch = 0; batch < count; batch++)
            await ports.batch(
                run.id,
                batch,
                members.length,
                members.slice(batch * 100, (batch + 1) * 100)
            )
        while (!(await ports.finish(run.id)).isDone) {
            /* durable bounded pages */
        }
        return "complete"
    } catch (error) {
        if (ports.superseded(error)) return "superseded"
        throw error
    }
}
