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
/** Pixel decoding is capped so a small file cannot expand into a huge raster. */
const decodeOptions = {
    animated: false,
    limitInputPixels: IMAGE_MAX_SOURCE_DIMENSION * IMAGE_MAX_SOURCE_DIMENSION,
} as const
/**
 * A header read decodes no pixels, so it runs without the cap: an oversized
 * source reports its real dimensions and the domain answers `bad_dimensions`.
 */
const headerOptions = { animated: false, limitInputPixels: false } as const

/**
 * libvips reports no frame count for an animated PNG, so the animation control
 * chunk is read directly: an `acTL` before the first `IDAT` declares the frames.
 */
function apngFrameCount(bytes: Uint8Array): number | undefined {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    for (let offset = 8; offset + 8 <= bytes.byteLength;) {
        const length = view.getUint32(offset)
        const type = String.fromCharCode(
            ...bytes.subarray(offset + 4, offset + 8)
        )
        if (type === "IDAT") return undefined
        if (type === "acTL" && length >= 8 && offset + 16 <= bytes.byteLength)
            return view.getUint32(offset + 8)
        offset += 12 + length
    }
    return undefined
}

/** Header-level facts for the domain validator; null when the bytes do not decode. */
export async function inspectImage(
    bytes: Uint8Array
): Promise<DecodedImage | null> {
    try {
        const metadata = await sharp(bytes, headerOptions).metadata()
        return {
            width: metadata.width,
            height: metadata.height,
            pages:
                metadata.format === "png"
                    ? (apngFrameCount(bytes) ?? metadata.pages)
                    : metadata.pages,
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
    const pipeline = sharp(bytes, decodeOptions).rotate().resize({
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
