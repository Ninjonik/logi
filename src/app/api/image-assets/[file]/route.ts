import { publicImageHandler } from "@/lib/api/image-public-route"
import { IMAGE_INPUT_TYPES } from "@/domain/assets/image-asset"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { fetchQuery } from "convex/nextjs"
import { z } from "zod"

export const runtime = "nodejs"
type Context = { params: Promise<{ file: string }> }
const resolved = z
    .object({ url: z.url(), contentType: z.enum(IMAGE_INPUT_TYPES) })
    .nullable()

const serve = publicImageHandler({
    resolve: async (publicId) =>
        resolved.parse(
            await fetchQuery(
                makeFunctionReference<"query">("imageAssets:resolvePublic"),
                { secret: getInternalAuthSecret(), publicId }
            )
        ),
    fetchStorage: (url) => fetch(url, { cache: "no-store" }),
})

export async function GET(_request: Request, context: Context) {
    return serve((await context.params).file)
}
