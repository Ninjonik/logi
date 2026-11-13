import { TaskOwner } from "./task-owner"

export type StopService = () => void | Promise<unknown>

/** Register cleanup before awaiting startup, and stop late-starting services too. */
export class BotLifecycle {
    private closing = false
    private shutdown?: Promise<void>
    private readonly starting = new Set<Promise<unknown>>()
    private readonly stops = new Set<StopService>()
    private readonly tasks = new TaskOwner()

    constructor(
        private readonly failed: (name: string, error: unknown) => void
    ) {}
    get stopped() {
        return this.closing
    }

    run(work: () => Promise<unknown>) {
        return this.tasks
            .run(work)
            .catch((error) => this.failed("gateway task", error))
    }

    start(
        name: string,
        start: () => StopService | Promise<StopService | void> | void,
        cleanup?: StopService
    ) {
        if (this.closing) return Promise.resolve()
        if (cleanup) this.stops.add(cleanup)
        const task = Promise.resolve()
            .then(() => (this.closing ? undefined : start()))
            .then(async (stop) => {
                if (!stop) return
                if (this.closing) await stop()
                else this.stops.add(stop)
            })
            .catch((error) => {
                this.failed(name, error)
                if (this.closing) throw error
            })
        this.starting.add(task)
        void task.then(
            () => this.starting.delete(task),
            () => this.starting.delete(task)
        )
        return task
    }

    stop(close: () => Promise<void>) {
        return (this.shutdown ??= this.finish(close))
    }

    private async finish(close: () => Promise<void>) {
        this.closing = true
        const gatewayDrain = this.tasks.stop()
        // Stop every producer immediately; do not wait for one drain before
        // stopping the next producer. Client closure follows all owned work.
        const drains = [...this.stops].map(async (stop) => {
            await stop()
        })
        const results = await Promise.allSettled([
            ...drains,
            ...this.starting,
            gatewayDrain,
        ])
        if (results.some((result) => result.status === "rejected")) {
            throw new Error(
                "A service could not drain; clients remain open until forced shutdown."
            )
        }
        await close()
    }
}
