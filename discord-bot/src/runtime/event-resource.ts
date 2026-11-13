import {
    createEventResource,
    type EventResourceStore,
    ResourceCreateRejected,
} from "../../../src/application/discord-publications/create-event-resource"
import { makeFunctionReference } from "convex/server"
import { env } from "../environment"
import { convex } from "../convex"

export type EventResourceScope = {
    guildId: string
    eventId: string
    key: string
}
export async function boundEventResources(
    guildId: string,
    eventId: string
): Promise<Array<{ key: string; resourceId: string | null; state: string }>> {
    return convex.query(
        makeFunctionReference<"query">("discordEventResources:inspect"),
        { secret: env.internalSecret, guildId, eventId }
    )
}
export function eventResourceStore(
    scope: EventResourceScope
): EventResourceStore {
    const { guildId, eventId, key } = scope
    const call = (name: string, args: object = {}) =>
        convex.mutation(
            makeFunctionReference<"mutation">(`discordEventResources:${name}`),
            {
                secret: env.internalSecret,
                guildId,
                eventId,
                key,
                ...args,
            }
        )
    return {
        claim: async () => {
            const result = await call("claim")
            if (result.blocked)
                throw new Error(
                    "Event resource creation uncertain; operator reconciliation required"
                )
            if (result.rejected)
                throw new ResourceCreateRejected(
                    new Error("Squad category creation was previously rejected")
                )
            return result
        },
        begin: (claim) => call("begin", claim),
        finish: (claim, resourceId) => call("finish", { ...claim, resourceId }),
        fail: (claim, rejected) => call("fail", { ...claim, rejected }),
    }
}

export async function provisionEventResource<T extends { id: string }>(
    input: EventResourceScope & {
        find(id: string): Promise<T | null>
        create(): Promise<T>
    }
) {
    return createEventResource(eventResourceStore(input), {
        find: input.find,
        create: input.create,
        // Only a definitive rejection proves no resource was created.
        rejected: (error) =>
            typeof error === "object" &&
            error !== null &&
            "status" in error &&
            typeof error.status === "number" &&
            [400, 401, 403, 404, 405, 413, 429].includes(error.status),
    })
}
