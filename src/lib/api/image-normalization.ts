import {
    IMAGE_MAX_SOURCE_DIMENSION,
    IMAGE_OUTPUT,
    IMAGE_OUTPUT_TYPES,
    type DecodedImage,
    type ImageAssetKind,
    type ImageInputType,
} from "@/domain/assets/image-asset"
import { createHash } from "node:crypto"
import sharp from "sharp"

// Server-only: decodes untrusted bytes with sharp inside the Node runtime.
const inputOptions = {
    animated: false,
    limitInputPixels: IMAGE_MAX_SOURCE_DIMENSION * IMAGE_MAX_SOURCE_DIMENSION,
} as const

/** Header-level facts for the domain validator; null when the bytes do not decode. */
export async function inspectImage(
    bytes: Uint8Array
): Promise<DecodedImage | null> {
    try {
        const metadata = await sharp(bytes, inputOptions).metadata()
        return {
            width: metadata.width,
            height: metadata.height,
            pages: metadata.pages,
            format: metadata.format,
        }
    } catch {
        return null
    }
}

export type NormalizedImage = {
    /** Backed by its own ArrayBuffer so it can be sent as a fetch body directly. */
    bytes: Uint8Array<ArrayBuffer>
    contentType: ImageInputType
    width: number
    height: number
    sha256: string
}

/**
 * Re-encodes a validated source into the only published form for its kind:
 * EXIF orientation applied, fitted inside the kind's bounds without enlarging,
 * metadata stripped (sharp drops it unless `withMetadata` is requested).
 */
export async function normalizeImage(
    bytes: Uint8Array,
    kind: ImageAssetKind
): Promise<NormalizedImage> {
    const output = IMAGE_OUTPUT[kind]
    const pipeline = sharp(bytes, inputOptions).rotate().resize({
        width: output.width,
        height: output.height,
        fit: "inside",
        withoutEnlargement: true,
    })
    const encoded = output.format === "png" ? pipeline.png() : pipeline.webp()
    const { data, info } = await encoded.toBuffer({ resolveWithObject: true })
    return {
        bytes: new Uint8Array(data),
        contentType: IMAGE_OUTPUT_TYPES[output.format],
        width: info.width,
        height: info.height,
        sha256: createHash("sha256").update(data).digest("hex"),
    }
}
