import {
    IMAGE_MAX_INPUT_BYTES,
    imagePublicIdSchema,
    type ImageInputType,
} from "@/domain/assets/image-asset"

export type PanelAssetPorts = {
    /** Live asset by public ID (storage URL and recorded type), or null. */
    resolve(
        publicId: string
    ): Promise<{ url: string; contentType: ImageInputType } | null>
    fetchStorage(url: string): Promise<Response>
}

/**
 * Bytes of a workspace image asset for the panel renderer: only a 32-hex
 * public ID resolved by persistence is ever fetched, and at most the upload
 * bound is read, so the renderer cannot be pointed at an arbitrary URL.
 */
export function createPanelAssetLoader(ports: PanelAssetPorts) {
    return async (publicId: string): Promise<Uint8Array | null> => {
        if (!imagePublicIdSchema.safeParse(publicId).success) return null
        try {
            const record = await ports.resolve(publicId)
            if (!record) return null
            const upstream = await ports.fetchStorage(record.url)
            const declared = upstream.headers.get("content-length")
            if (
                !upstream.ok ||
                !upstream.body ||
                (declared &&
                    /^\d+$/.test(declared) &&
                    Number(declared) > IMAGE_MAX_INPUT_BYTES)
            )
                return null
            const reader = upstream.body.getReader()
            const chunks: Uint8Array[] = []
            let total = 0
            while (true) {
                const chunk = await reader.read()
                if (chunk.done) break
                total += chunk.value.byteLength
                if (total > IMAGE_MAX_INPUT_BYTES) {
                    await reader.cancel()
                    return null
                }
                chunks.push(chunk.value)
            }
            const bytes = new Uint8Array(total)
            let offset = 0
            for (const chunk of chunks) {
                bytes.set(chunk, offset)
                offset += chunk.byteLength
            }
            return bytes
        } catch {
            return null
        }
    }
}
