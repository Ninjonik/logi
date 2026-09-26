"use node"

import {
    runWebhookDelivery,
    type ClaimedWebhookDelivery,
} from "../src/infrastructure/webhooks/delivery-runner"
import { makeFunctionReference } from "convex/server"

import { internalAction } from "./_generated/server"

const claimDueDelivery = makeFunctionReference<"mutation">(
    "webhooks:claimDueDelivery"
)
const finishDelivery = makeFunctionReference<"mutation">(
    "webhooks:finishDelivery"
)
export const deliverDue = internalAction({
    args: {},
    handler: async (ctx): Promise<{ delivered: boolean }> => {
        const delivery = (await ctx.runMutation(claimDueDelivery, {})) as
            (ClaimedWebhookDelivery & { attempt: number }) | null
        if (!delivery) return { delivered: false }
        return await runWebhookDelivery(delivery, {
            fetch,
            finish: async (result) =>
                await ctx.runMutation(finishDelivery, {
                    ...result,
                    deliveryId: result.deliveryId as never,
                }),
        })
    },
})
