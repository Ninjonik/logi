import { makeFunctionReference } from "convex/server"
import { startOwnedInterval } from "./task-owner"
import { env } from "../environment"
import { convex } from "../convex"

export async function withRequestLease<T>(
    kind: "reminder" | "roster" | "dispatch",
    request: { id: string; claimToken?: string },
    execute: (assertLease: () => Promise<void>) => Promise<T>,
    heartbeat = () =>
        convex.mutation(
            makeFunctionReference<"mutation">(
                "discordRequestRecovery:heartbeat"
            ),
            {
                secret: env.internalSecret,
                kind,
                requestId: request.id,
                claimToken: request.claimToken,
            }
        ) as Promise<boolean>
): Promise<T> {
    // Fail closed against an old backend; do not send under an unfenced claim.
    if (!request.claimToken)
        throw new Error("Request lease requires the updated backend")
    let lost = false
    const assertLease = async () => {
        if (lost) throw new Error("Request delivery lease was lost")
        try {
            if (!(await heartbeat()))
                throw new Error("Request delivery lease was lost")
        } catch (error) {
            lost = true
            throw error
        }
    }
    await assertLease()
    const stop = startOwnedInterval(
        assertLease,
        30_000,
        () => {
            lost = true
        },
        false
    )
    try {
        return await execute(assertLease)
    } finally {
        await stop()
    }
}

export function startRequestRecovery() {
    return startOwnedInterval(
        async () => {
            await convex.mutation(
                makeFunctionReference<"mutation">(
                    "discordRequestRecovery:expire"
                ),
                { secret: env.internalSecret }
            )
        },
        60_000,
        (error) =>
            console.warn("[request-recovery] Recovery pass failed", error)
    )
}
