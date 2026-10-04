import type { DashboardActor } from "../../../../../../convex/dashboardActor"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs"
import { imageAssetDtoSchema } from "@/domain/assets/image-asset"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { imageAssetHandlers } from "@/lib/api/image-upload"
import { readBoundedBytes } from "@/lib/api/request-bytes"
import { makeFunctionReference } from "convex/server"
import { randomBytes } from "node:crypto"
import { z } from "zod"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string }> }
type Access = { secret: string; guildId: string; actor: DashboardActor }
const reserveResult = z.union([
    z.object({ ok: z.literal(true) }),
    z.object({
        error: z.literal("upload_limited"),
        retryAfterMs: z.number().nonnegative(),
    }),
])
const storeResult = z.union([
    z.object({ ok: z.literal(true), asset: imageAssetDtoSchema }),
    z.object({ error: z.string() }),
])
const listResult = z.object({ assets: z.array(imageAssetDtoSchema) })

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
    // Convex stores and records the bytes together and deletes the file again
    // when recording fails, so no stored upload is left without a record.
    store: async (access, asset, bytes) =>
        storeResult.parse(
            await fetchAction(
                makeFunctionReference<"action">("imageAssets:storeNormalized"),
                {
                    ...access,
                    asset,
                    bytes: bytes.buffer.slice(
                        bytes.byteOffset,
                        bytes.byteOffset + bytes.byteLength
                    ),
                }
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
