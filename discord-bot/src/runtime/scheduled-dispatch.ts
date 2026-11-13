import { makeFunctionReference } from "convex/server"
import { DurableDelivery } from "./durable-delivery"
import { withRequestLease } from "./request-lease"
import { startOwnedInterval } from "./task-owner"
import { convex, references } from "../convex"
import { env } from "../environment"
import { logWarn } from "../log"

export type ScheduledDispatch = {
    id: string
    claimToken: string
    eventId: string
    guildId: string
    kind: string
    dueAt: string
    changedEventIds: string[]
    scoreEventIds: string[]
}
export function startScheduledDispatch(
    process: (
        row: ScheduledDispatch,
        delivery: DurableDelivery
    ) => Promise<void>
) {
    const call = (name: string, args: Record<string, unknown> = {}) =>
        convex.mutation(
            makeFunctionReference<"mutation">(
                `discordScheduledDispatch:${name}`
            ),
            { secret: env.internalSecret, ...args }
        )
    let stopped = false
    const stop = startOwnedInterval(
        async () => {
            for (let i = 0; i < 25 && !stopped; i++) {
                const row = (await call("claim")) as ScheduledDispatch | null
                if (!row) break
                const owner = {
                    kind: "dispatch" as const,
                    id: row.id,
                    token: row.claimToken,
                }
                try {
                    await withRequestLease(
                        "dispatch",
                        row,
                        async (assertLease) => {
                            for (const eventId of row.scoreEventIds) {
                                await assertLease()
                                await convex.mutation(
                                    references.applyEventScore,
                                    { secret: env.internalSecret, eventId }
                                )
                            }
                            await process(row, new DurableDelivery(owner))
                            await assertLease()
                            await call("acknowledge", { owner })
                        }
                    )
                } catch (error) {
                    logWarn(
                        "scheduled-dispatch",
                        "Dispatch retained for retry",
                        { dispatchId: row.id, error }
                    )
                    await call("retry", { owner }).catch((retryError) =>
                        logWarn(
                            "scheduled-dispatch",
                            "Retry scheduling failed; leased dispatch remains recoverable",
                            { dispatchId: row.id, error: retryError }
                        )
                    )
                }
            }
        },
        15_000,
        (error) =>
            logWarn("scheduled-dispatch", "Dispatch poll failed", { error })
    )
    return () => {
        stopped = true
        return stop()
    }
}
