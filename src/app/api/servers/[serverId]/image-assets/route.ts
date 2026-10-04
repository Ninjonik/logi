import type { DashboardActor } from "../../../../../../convex/dashboardActor"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { imageAssetDtoSchema } from "@/domain/assets/image-asset"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { imageAssetHandlers } from "@/lib/api/image-upload"
import { readBoundedBytes } from "@/lib/api/request-bytes"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"
import { randomBytes } from "node:crypto"
import { z } from "zod"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string }> }
type Access = { secret: string; guildId: string; actor: DashboardActor }
const reserveResult = z.union([
    z.object({ ok: z.literal(true), uploadUrl: z.url() }),
    z.object({
        error: z.literal("upload_limited"),
        retryAfterMs: z.number().nonnegative(),
    }),
])
const createResult = z.union([
    z.object({ ok: z.literal(true), asset: imageAssetDtoSchema }),
    z.object({ error: z.string() }),
])
const listResult = z.object({ assets: z.array(imageAssetDtoSchema) })
const storageReceipt = z.object({ storageId: z.string().min(1) })

const handlers = imageAssetHandlers<Access>({
    authorize: async (serverId) => {
        const server = await getServerContextUncached(serverId),
            actor = await currentDashboardActor()
        return server?.canAdmin && actor
            ? {
                  secret: getInternalAuthSecret(),
                  guildId: server.server.discordId,
                  actor,
              }
            : null
    },
    reserve: async (access, kind) =>
        reserveResult.parse(
            await fetchMutation(
                makeFunctionReference<"mutation">("imageAssets:reserveUpload"),
                { ...access, kind }
            )
        ),
    readBody: readBoundedBytes,
    upload: async (uploadUrl, bytes, contentType) => {
        const response = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": contentType },
            body: bytes,
        })
        if (!response.ok) throw new Error("Storage upload failed.")
        return storageReceipt.parse(await response.json()).storageId
    },
    create: async (access, asset) =>
        createResult.parse(
            await fetchMutation(
                makeFunctionReference<"mutation">("imageAssets:create"),
                { ...access, asset }
            )
        ),
    list: async (access, kind) =>
        listResult.parse(
            await fetchQuery(
                makeFunctionReference<"query">("imageAssets:list"),
                { ...access, kind }
            )
        ),
    randomId: () => randomBytes(16).toString("hex"),
    siteUrl: getSiteUrl,
})

export async function GET(request: Request, context: Context) {
    return handlers.GET(request, (await context.params).serverId)
}

export async function POST(request: Request, context: Context) {
    return handlers.POST(request, (await context.params).serverId)
}
