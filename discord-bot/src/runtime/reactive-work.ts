export type WorkSignal = { key: string; dueAt: number }
type Watch = {
    onUpdate(callback: () => void): () => void
    localQueryResult(): WorkSignal | null | undefined
}

/** Watch durable queue heads; one timer, one active pass, and a slow read-only safety check. */
export function startReactiveWork(
    ports: {
        watch(): Watch
        read(): Promise<WorkSignal | null>
        run(): Promise<unknown>
        failed(error: unknown): void
    },
    safetyMs = 300_000
) {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let active: Promise<unknown> | undefined
    let reading: Promise<void> | undefined
    let pending = false
    let signal: WorkSignal | null | undefined
    let version = 0
    let failures = 0
    const report = (error: unknown) => {
        try {
            ports.failed(error)
        } catch {
            console.warn("[reactive-work] Worker failure reporter failed")
        }
    }
    const clear = () => {
        if (timer) clearTimeout(timer)
        timer = undefined
    }
    const later = (callback: () => void, delay: number) => {
        clear()
        timer = setTimeout(
            () => {
                timer = undefined
                if (!stopped) callback()
            },
            Math.min(2_147_483_647, Math.max(0, delay))
        )
        timer.unref()
    }
    const run = () => {
        if (stopped) return
        if (active) {
            pending = true
            return
        }
        pending = false
        active = Promise.resolve()
            .then(() => {
                if (!stopped) return ports.run()
            })
            .then(() => {
                failures = 0
            })
            .catch((error) => {
                pending = false
                report(error)
                failures++
                later(
                    () => {
                        void refresh()
                    },
                    Math.min(300_000, 15_000 * 2 ** Math.min(failures - 1, 5))
                )
            })
            .finally(() => {
                active = undefined
                if (!stopped && pending && signal && signal.dueAt <= Date.now())
                    run()
            })
    }
    const apply = (next: WorkSignal | null, force = false) => {
        if (stopped) return
        if (next && (!Number.isFinite(next.dueAt) || !next.key))
            throw new Error("Invalid work signal")
        if (
            !force &&
            next?.key === signal?.key &&
            next?.dueAt === signal?.dueAt &&
            signal !== undefined
        )
            return
        signal = next
        clear()
        pending = false
        if (!next) return
        if (next.dueAt <= Date.now()) run()
        else later(() => apply(next, true), next.dueAt - Date.now())
    }
    const refresh = () => {
        if (stopped || reading) return reading ?? Promise.resolve()
        const observedVersion = version
        reading = Promise.resolve()
            .then(() => (stopped ? undefined : ports.read()))
            .then((next) => {
                if (next !== undefined && observedVersion === version)
                    apply(next, true)
            })
            .catch((error) => {
                if (!stopped) report(error)
            })
            .finally(() => {
                reading = undefined
            })
        return reading
    }
    const watch = ports.watch()
    const update = () => {
        if (stopped) return
        try {
            const next = watch.localQueryResult()
            if (next !== undefined) {
                version++
                apply(next)
            }
        } catch (error) {
            report(error)
        }
    }
    const unsubscribe = watch.onUpdate(update)
    update()
    if (signal === undefined) void refresh()
    const safety = setInterval(() => {
        void refresh()
    }, safetyMs)
    safety.unref()
    const stop = async () => {
        stopped = true
        clear()
        clearInterval(safety)
        unsubscribe()
        await Promise.allSettled([active, reading])
    }
    return Object.assign(stop, { wake: refresh })
}
