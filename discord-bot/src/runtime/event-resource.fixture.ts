import {
    invoke,
    testContext,
} from "../../../src/infrastructure/convex/testing/database"
import * as resources from "../../../convex/discordEventResources"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import type { TestContext } from "node:test"
import { env } from "../environment"

/** Real journal handlers with isolated persistence; no Discord or backend traffic. */
export function resourceFixture(t: TestContext) {
    const ctx = testContext()
    const originalQuery = ConvexReactClient.prototype.query
    t.mock.method(
        ConvexReactClient.prototype,
        "query",
        async function (
            this: ConvexReactClient,
            reference: Parameters<typeof getFunctionName>[0],
            args: Record<string, unknown>
        ) {
            if (getFunctionName(reference) !== "discordEventResources:inspect")
                return originalQuery.call(this, reference, args)
            if (!(await ctx.db.get(String(args.eventId))))
                ctx.db.seed("events", {
                    _id: String(args.eventId),
                    guildId: args.guildId,
                    status: "starting",
                })
            return invoke(resources.inspect, ctx, args)
        }
    )
    const original = ConvexReactClient.prototype.mutation
    t.mock.method(
        ConvexReactClient.prototype,
        "mutation",
        async function (
            this: ConvexReactClient,
            reference: Parameters<typeof getFunctionName>[0],
            args: Record<string, unknown>
        ) {
            const name = getFunctionName(reference)
            if (!name.startsWith("discordEventResources:"))
                return original.call(this, reference, args)
            if (!(await ctx.db.get(String(args.eventId))))
                ctx.db.seed("events", {
                    _id: String(args.eventId),
                    guildId: args.guildId,
                    status: "starting",
                })
            const params = { ...args, secret: env.internalSecret }
            switch (name) {
                case "discordEventResources:claim":
                    return invoke(resources.claim, ctx, params)
                case "discordEventResources:begin":
                    return invoke(resources.begin, ctx, params)
                case "discordEventResources:finish":
                    return invoke(resources.finish, ctx, params)
                case "discordEventResources:fail":
                    return invoke(resources.fail, ctx, params)
                default:
                    throw new Error(`Unexpected resource mutation ${name}`)
            }
        }
    )
    return ctx
}
