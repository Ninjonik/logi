import {
    isSameOrigin,
    noStore,
    SUPERADMIN_JSON_LIMIT,
} from "@/lib/api/superadmin-route"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { readBoundedJson } from "@/lib/api/request-json"
import { makeFunctionReference } from "convex/server"
import { z } from "zod"

export const runtime = "nodejs"

const capability = z.object({
    maps: z.boolean(),
    stratmaps: z.boolean(),
    serverData: z.boolean(),
    playerStats: z.boolean(),
    matchResults: z.boolean(),
    competitions: z.boolean(),
})
const body = z.object({
    id: z.string(),
    name: z.string(),
    iconAssetId: z.string().nullable(),
    capabilities: capability,
    eventSelection: z.object({
        primaryLabel: z.string(),
        primaryOptions: z.array(z.string()),
        targetLabel: z.string().optional(),
        targetOptional: z.boolean(),
    }),
})

async function access() {
    const actor = await currentDashboardActor()
    return actor?.superadmin ? { secret: getInternalAuthSecret(), actor } : null
}

export async function GET() {
    const actor = await access()
    if (!actor) return noStore({ error: "forbidden" }, 403)
    return noStore(
        await fetchQuery(makeFunctionReference<"query">("gameCatalog:list"), {})
    )
}

export async function POST(request: Request) {
    if (!isSameOrigin(request, new URL(getSiteUrl()).origin))
        return noStore({ error: "forbidden" }, 403)
    const actor = await access()
    if (!actor) return noStore({ error: "forbidden" }, 403)
    const parsed = body.safeParse(
        await readBoundedJson(request, SUPERADMIN_JSON_LIMIT)
    )
    if (!parsed.success) return noStore({ error: "invalid_game" }, 400)
    return noStore(
        await fetchMutation(
            makeFunctionReference<"mutation">("gameCatalog:upsert"),
            { ...actor, ...parsed.data }
        )
    )
}
