import path from "node:path"

import { createPanelAssetLoader } from "@/lib/panel-image/asset-source"
import { createPanelImageRenderer } from "@/lib/panel-image/render"
import { createRosterImageCache } from "@/lib/roster-image-cache"
import { panelImageHandler } from "@/lib/api/panel-image-route"
import { IMAGE_INPUT_TYPES } from "@/domain/assets/image-asset"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { fetchQuery } from "convex/nextjs"
import { z } from "zod"

export const runtime = "nodejs"

const resolved = z
    .object({ url: z.url(), contentType: z.enum(IMAGE_INPUT_TYPES) })
    .nullable()
const renderer = createPanelImageRenderer({
    publicDir: path.join(process.cwd(), "public"),
    loadAsset: createPanelAssetLoader({
        resolve: async (publicId) =>
            resolved.parse(
                await fetchQuery(
                    makeFunctionReference<"query">("imageAssets:resolvePublic"),
                    { secret: getInternalAuthSecret(), publicId }
                )
            ),
        fetchStorage: (url) => fetch(url, { cache: "no-store" }),
    }),
})
const handle = panelImageHandler({
    secret: getInternalAuthSecret,
    render: (request) => renderer.render(request),
    // Panels × versions within the bot's 60 s cadence; identical content is reused.
    cache: createRosterImageCache(48),
})

/** Bot-only: renders a validated panel image model (style A score, style B banner). */
export async function POST(request: Request) {
    return handle(request)
}
