/**
 * Runs history steps for one cron tick: at most `limit` steps, `pause`
 * between two of them, and stops at the first step that found nothing due
 * (`false`). Returns the number of steps that ran.
 */
export async function runHistorySteps(
    step: () => Promise<boolean>,
    options: { limit: number; pause: () => Promise<void> }
): Promise<number> {
    let processed = 0
    while (processed < options.limit) {
        if (processed) await options.pause()
        if (!(await step())) break
        processed++
    }
    return processed
}
