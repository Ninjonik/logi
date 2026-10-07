import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { unstable_cache } from "next/cache"
import { fetchQuery } from "convex/nextjs"

const getPublicOverviewStatsReference = makeFunctionReference<"query">(
    "publicStats:overview"
)

export const getPublicOverviewStats = unstable_cache(
    async () => {
        return await fetchQuery(getPublicOverviewStatsReference, {
            secret: getInternalAuthSecret(),
        })
    },
    ["public-overview-stats"],
    {
        revalidate: 300,
    }
)
