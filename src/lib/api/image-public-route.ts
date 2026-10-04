import {
    parseImageAssetFile,
    type ImageInputType,
} from "@/domain/assets/image-asset"

export type PublicImagePorts = {
    /** The stored file and its recorded content type, or null when unknown or not live. */
    resolve(
        publicId: string
    ): Promise<{ url: string; contentType: ImageInputType } | null>
    fetchStorage(url: string): Promise<Response>
}
const extensionFor: Record<ImageInputType, string> = {
    "image/png": "png",
    "image/webp": "webp",
    "image/jpeg": "jpg",
}
const notFound = () =>
    Response.json(
        { error: "not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
    )

/**
 * Serves one immutable public image. The response type always comes from the
 * record, never from the storage response, and the file extension must agree
 * with it so a URL can never present one format as another.
 */
export function publicImageHandler(ports: PublicImagePorts) {
    return async (file: string): Promise<Response> => {
        const parsed = parseImageAssetFile(file)
        if (!parsed) return notFound()
        try {
            const record = await ports.resolve(parsed.publicId)
            if (
                !record ||
                extensionFor[record.contentType] !== parsed.extension
            )
                return notFound()
            const upstream = await ports.fetchStorage(record.url)
            if (!upstream.ok || !upstream.body) return notFound()
            const headers = new Headers({
                "Content-Type": record.contentType,
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "public, max-age=31536000, immutable",
                "Content-Disposition": "inline",
            })
            const length = upstream.headers.get("content-length")
            if (
                length &&
                /^\d+$/.test(length) &&
                !upstream.headers.get("content-encoding")
            )
                headers.set("Content-Length", length)
            return new Response(upstream.body, { status: 200, headers })
        } catch {
            return notFound()
        }
    }
}
