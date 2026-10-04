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

export type FetchedMember = {
    discordUserId: string
    roleIds: string[]
    isAdmin: boolean
    hasDashboardAccess: boolean
}
export async function reconcileMembershipSnapshot(ports: {
    begin(): Promise<{ id: string } | null>
    fetchComplete(): Promise<FetchedMember[] | null>
    batch(
        runId: string,
        batch: number,
        expectedCount: number,
        members: FetchedMember[]
    ): Promise<unknown>
    finish(runId: string): Promise<{ isDone: boolean }>
}) {
    const run = await ports.begin()
    if (!run) return false
    const members = await ports.fetchComplete()
    if (!members) return false
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
    return true
}
