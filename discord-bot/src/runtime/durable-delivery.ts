import { makeFunctionReference } from "convex/server"
import { env } from "../environment"
import { convex } from "../convex"
import { logWarn } from "../log"

export type DeliveryOwner = {
    kind: "reminder" | "roster" | "dispatch"
    id: string
    token: string
}
export class UnattemptedDelivery extends Error {}
export type EffectState = "sent" | "refused" | "uncertain"
export function confirmedDmRefusal(error: unknown) {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        [50007, 10013, 10007].includes(Number(error.code))
    )
}

export class DurableDelivery {
    constructor(
        readonly owner: DeliveryOwner,
        private readonly call = async (
            name: string,
            args: Record<string, unknown>
        ): Promise<unknown> =>
            convex.mutation(
                makeFunctionReference<"mutation">(`discordDelivery:${name}`),
                { secret: env.internalSecret, owner, ...args }
            )
    ) {}

    async prepare(phase: string, recipientIds: string[]) {
        return new Set(
            (await this.call("plan", { phase, recipientIds })) as string[]
        )
    }

    async effect(
        phase: string,
        key: string,
        execute: () => Promise<boolean | void>
    ): Promise<EffectState> {
        const prior = (await this.call("begin", { phase, key })) as
            EffectState | "execute"
        if (prior !== "execute") return prior
        let state: EffectState
        try {
            state = (await execute()) === false ? "refused" : "sent"
        } catch (error) {
            if (error instanceof UnattemptedDelivery) {
                await this.call("reset", { phase, key })
                throw error
            }
            state =
                key.startsWith("dm:") && confirmedDmRefusal(error)
                    ? "refused"
                    : "uncertain"
            if (state === "uncertain")
                logWarn("delivery", "External send outcome is uncertain", {
                    kind: this.owner.kind,
                    requestId: this.owner.id,
                    key,
                })
        }
        // A failed receipt write leaves 'started', which is uncertain on resume.
        // Never treat failure to persist a receipt as permission to resend.
        await this.call("finish", { phase, key, state })
        return state
    }
}
