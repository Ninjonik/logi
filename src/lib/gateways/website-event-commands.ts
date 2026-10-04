import { websiteEventCommandHandlers } from "../api/website-event-command-route"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { checkPublicApiRateLimit } from "../public-api"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "../env"

export const websiteEventHandlers = websiteEventCommandHandlers({
    rateLimit: async (bucket) => {
        const value = await checkPublicApiRateLimit(bucket, 60)
        return {
            allowed: value.allowed,
            retryAfterSeconds: Math.max(
                1,
                Math.ceil((value.resetAt - Date.now()) / 1000)
            ),
        }
    },
    execute: (input) =>
        fetchMutation(
            makeFunctionReference<"mutation">("websiteEventCommands:execute"),
            { secret: getInternalAuthSecret(), ...input }
        ),
    editor: (input) =>
        fetchQuery(
            makeFunctionReference<"query">("websiteEventCommands:readEditor"),
            { secret: getInternalAuthSecret(), ...input }
        ),
})
