type Work = { group: string; run: () => Promise<void>; queuedAt: number }

/** Bounded, keyed work admission. Durable callers retry rejected admission on their next poll. */
export class WorkQueue {
    private readonly pending = new Map<string, Work>()
    private readonly active = new Map<string, string>()
    private readonly waiters = new Set<() => void>()
    private stopped = false
    private lastGroup: string | undefined
    private readonly totals = {
        started: 0,
        completed: 0,
        failed: 0,
        coalesced: 0,
        rejected: 0,
        maxActive: 0,
        waitMs: 0,
        runMs: 0,
    }

    constructor(
        private readonly options: {
            concurrency: number
            capacity?: number
            now?: () => number
            onError?: (error: unknown) => void
        }
    ) {
        if (!Number.isInteger(options.concurrency) || options.concurrency < 1)
            throw new Error("Invalid work concurrency.")
        if (
            options.capacity !== undefined &&
            (!Number.isInteger(options.capacity) || options.capacity < 1)
        )
            throw new Error("Invalid work capacity.")
    }

    enqueue(key: string, run: () => Promise<void>, group = key): boolean {
        if (
            this.stopped ||
            (!this.pending.has(key) &&
                this.pending.size >= (this.options.capacity ?? 1024))
        ) {
            this.totals.rejected++
            return false
        }
        const previous = this.pending.get(key)
        if (previous || this.active.has(key)) this.totals.coalesced++
        this.pending.set(key, {
            group,
            run,
            queuedAt: previous?.queuedAt ?? this.now(),
        })
        this.pump()
        return true
    }

    private now() {
        return (this.options.now ?? Date.now)()
    }

    private pump() {
        while (!this.stopped && this.active.size < this.options.concurrency) {
            const eligible = [...this.pending].filter(
                ([key, work]) =>
                    !this.active.has(key) &&
                    ![...this.active.values()].includes(work.group)
            )
            const next =
                eligible.find(([, work]) => work.group !== this.lastGroup) ??
                eligible[0]
            if (!next) break
            const [key, work] = next
            this.pending.delete(key)
            this.active.set(key, work.group)
            this.lastGroup = work.group
            const started = this.now()
            this.totals.started++
            this.totals.waitMs += Math.max(0, started - work.queuedAt)
            this.totals.maxActive = Math.max(
                this.totals.maxActive,
                this.active.size
            )
            void Promise.resolve()
                .then(work.run)
                .then(
                    () => {
                        this.totals.completed++
                    },
                    (error) => {
                        this.totals.failed++
                        try {
                            this.options.onError?.(error)
                        } catch {
                            /* Reporting cannot strand ownership. */
                        }
                    }
                )
                .finally(() => {
                    this.totals.runMs += Math.max(0, this.now() - started)
                    this.active.delete(key)
                    this.pump()
                    if (
                        !this.active.size &&
                        (!this.pending.size || this.stopped)
                    ) {
                        for (const resolve of this.waiters) resolve()
                        this.waiters.clear()
                    }
                })
        }
    }

    snapshot() {
        return {
            ...this.totals,
            active: this.active.size,
            pending: this.pending.size,
            oldestWaitMs: this.pending.size
                ? Math.max(
                      0,
                      this.now() -
                          Math.min(
                              ...[...this.pending.values()].map(
                                  (work) => work.queuedAt
                              )
                          )
                  )
                : 0,
        }
    }

    drain(): Promise<void> {
        if (!this.active.size && (!this.pending.size || this.stopped))
            return Promise.resolve()
        return new Promise((resolve) => this.waiters.add(resolve))
    }

    stop(): Promise<void> {
        this.stopped = true
        this.pending.clear()
        return this.drain()
    }
}

/** Pull work lazily rather than creating one promise/REST request per input. */
export async function mapConcurrent<T, R>(
    values: readonly T[],
    concurrency: number,
    run: (value: T, index: number) => Promise<R>
): Promise<R[]> {
    if (!Number.isInteger(concurrency) || concurrency < 1)
        throw new Error("Invalid map concurrency.")
    const results: R[] = new Array(values.length)
    let index = 0
    let failure: { error: unknown } | undefined
    await Promise.all(
        Array.from(
            { length: Math.min(concurrency, values.length) },
            async () => {
                while (!failure && index < values.length) {
                    const current = index++
                    try {
                        results[current] = await run(values[current], current)
                    } catch (error) {
                        failure ??= { error }
                    }
                }
            }
        )
    )
    // All admitted operations settle before capacity can be reused by the caller.
    if (failure) throw failure.error
    return results
}
