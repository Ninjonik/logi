"use node"

import {
    runWebhookDelivery,
    drainWebhookDeliveries,
    type ClaimedWebhookDelivery,
} from "../src/infrastructure/webhooks/delivery-runner"
import { makeFunctionReference } from "convex/server"

import { internalAction } from "./_generated/server"

const claimDueDelivery = makeFunctionReference<"mutation">(
    "webhookQueue:claimDueDelivery"
)
const finishDelivery = makeFunctionReference<"mutation">(
    "webhookQueue:finishDelivery"
)
export const deliverDue = internalAction({
    args: {},
    handler: async (ctx): Promise<{ delivered: number; processed: number }> => {
        const fence = (await ctx.runMutation(
            makeFunctionReference<"mutation">("webhookQueue:beginDrain"),
            {}
        )) as number | null
        if (fence === null) return { delivered: 0, processed: 0 }
        try {
            return await drainWebhookDeliveries({
                claim: async () =>
                    (await ctx.runMutation(claimDueDelivery, {
                        drainFence: fence,
                    })) as ClaimedWebhookDelivery | null,
                deliver: (delivery) =>
                    runWebhookDelivery(delivery, {
                        fetch,
                        finish: async (result) => {
                            await ctx.runMutation(finishDelivery, {
                                ...result,
                                deliveryId: result.deliveryId as never,
                            })
                        },
                    }),
            })
        } finally {
            await ctx.runMutation(
                makeFunctionReference<"mutation">("webhookQueue:endDrain"),
                { fence }
            )
        }
    },
})
