/** Own actual promises: stopping intake never pretends active effects have ended. */
export class TaskOwner {
    private accepting = true
    private readonly active = new Set<Promise<unknown>>()

    get stopped() {
        return !this.accepting
    }

    run<T>(work: () => Promise<T>): Promise<T | undefined> {
        if (!this.accepting) return Promise.resolve(undefined)
        const task = Promise.resolve().then(work)
        this.active.add(task)
        void task.then(
            () => this.active.delete(task),
            () => this.active.delete(task)
        )
        return task
    }

    async stop() {
        this.accepting = false
        await Promise.allSettled([...this.active])
    }
}

export function startOwnedInterval(
    pass: () => Promise<unknown>,
    intervalMs: number,
    failed: (error: unknown) => void,
    immediate = true
) {
    const owner = new TaskOwner()
    let running: Promise<unknown> | undefined
    const tick = () => {
        if (owner.stopped || running) return
        running = owner
            .run(pass)
            .catch((error) => {
                try {
                    failed(error)
                } catch {
                    /* diagnostics cannot escape timers */
                }
            })
            .finally(() => {
                running = undefined
            })
    }
    const timer = setInterval(tick, intervalMs)
    timer.unref()
    if (immediate) tick()
    return () => {
        clearInterval(timer)
        return owner.stop()
    }
}
