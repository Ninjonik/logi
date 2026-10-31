import { imageAssetDtoSchema } from "@/domain/assets/image-asset.schema"
import { fetchQuery, fetchMutation, fetchAction } from "convex/nextjs"
import type { DashboardActor } from "../../../convex/dashboardActor"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { imageAssetHandlers } from "@/lib/api/image-upload"
import { readBoundedBytes } from "@/lib/api/request-bytes"
import { currentDashboardActor } from "./dashboard-actor"
import { makeFunctionReference } from "convex/server"
import { randomBytes } from "node:crypto"
import { z } from "zod"
import "server-only"

type Access = { secret: string; actor: DashboardActor; guildId: string }
const reserveResult = z.union([
    z.object({ ok: z.literal(true) }),
    z.object({ error: z.literal("upload_limited"), retryAfterMs: z.number() }),
])
const storeResult = z.union([
    z.object({ ok: z.literal(true), asset: imageAssetDtoSchema }),
    z.object({ error: z.string() }),
])

/** Uses the same normalization, upload limits and storage lifecycle as workspace images. */
export const teamImageHandlers = imageAssetHandlers<Access>({
    authorize: async (teamId) => {
        const actor = await currentDashboardActor()
        if (!actor) return null
        const access = { secret: getInternalAuthSecret(), actor }
        try {
            await fetchQuery(
                makeFunctionReference<"query">("leaguePortal:profileAccess"),
                { ...access, teamId }
            )
            return { ...access, guildId: `team:${teamId}` }
        } catch {
            return null
        }
    },
    reserve: async (access, kind) =>
        reserveResult.parse(
            await fetchMutation(
                makeFunctionReference<"mutation">("imageAssets:reserveUpload"),
                { ...access, kind }
            )
        ),
    readBody: readBoundedBytes,
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
        z
            .object({ assets: z.array(imageAssetDtoSchema) })
            .parse(
                await fetchQuery(
                    makeFunctionReference<"query">("imageAssets:list"),
                    { ...access, kind }
                )
            ),
    randomId: () => randomBytes(16).toString("hex"),
    siteUrl: getSiteUrl,
})
