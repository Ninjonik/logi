/** Weekly match series are extended two weeks ahead on this cadence. */
export const RECURRENCE_INTERVAL_MS = 15 * 60_000

/**
 * The gate of the recurrence pass. `eventRecurrence:generateDue` reads every
 * weekly series and its upcoming occurrences, so the fallback worker runs it
 * once at start and then at most every 15 minutes, never on each of its
 * one-minute reconcile ticks (ARCHITECTURE.md, "Convex hot paths").
 */
export function createRecurrenceGate(intervalMs = RECURRENCE_INTERVAL_MS) {
    let lastPassAt: number | null = null
    return {
        /** Claims the pass when one is due now; the caller then runs it. */
        claim(now: number) {
            if (lastPassAt !== null && now - lastPassAt < intervalMs)
                return false
            lastPassAt = now
            return true
        },
    }
}
