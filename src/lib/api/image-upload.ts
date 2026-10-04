import {
    IMAGE_MAX_INPUT_BYTES,
    imageAssetKindSchema,
    imageAssetPath,
    sniffImageType,
    validateImageSource,
    type ImageAssetDto,
    type ImageAssetKind,
    type ImageInputType,
} from "@/domain/assets/image-asset"
import { inspectImage, normalizeImage } from "./image-normalization"

export type ReserveUploadResult =
    | { ok: true; uploadUrl: string }
    | { error: "upload_limited"; retryAfterMs: number }
/** The normalized record handed to persistence after the bytes are stored. */
export type StoredImageAsset = {
    kind: ImageAssetKind
    publicId: string
    storageId: string
    contentType: ImageInputType
    width: number
    height: number
    bytes: number
    sha256: string
    publicUrl: string
}
export type CreateImageAssetResult =
    { ok: true; asset: ImageAssetDto } | { error: string }
export type ImageAssetPorts<Access> = {
    /** Admin access to the workspace behind this dashboard server, or null. */
    authorize(serverId: string): Promise<Access | null>
    /** Counts the attempt and reserves an upload URL before any body is read. */
    reserve(access: Access, kind: ImageAssetKind): Promise<ReserveUploadResult>
    readBody(request: Request, maxBytes: number): Promise<Uint8Array | null>
    /** Stores the normalized bytes at the reserved URL; resolves to the storage ID. */
    upload(
        uploadUrl: string,
        bytes: Uint8Array<ArrayBuffer>,
        contentType: ImageInputType
    ): Promise<string>
    create(
        access: Access,
        asset: StoredImageAsset
    ): Promise<CreateImageAssetResult>
    list(
        access: Access,
        kind: ImageAssetKind
    ): Promise<{ assets: ImageAssetDto[] }>
    /** 32 lowercase hex characters from a cryptographic source. */
    randomId(): string
    /** Public site origin; a trailing slash is tolerated. */
    siteUrl(): string
}

const json = (
    body: unknown,
    status = 200,
    headers: Record<string, string> = {}
) =>
    Response.json(body, {
        status,
        headers: { "Cache-Control": "no-store", ...headers },
    })
const kindOf = (request: Request) =>
    imageAssetKindSchema.safeParse(
        new URL(request.url).searchParams.get("kind")
    )

/**
 * Dashboard image upload and listing. Order matters on POST: the attempt is
 * counted and the upload URL reserved before a single body byte is read, the
 * declared type is checked before decoding, and only the normalized output is
 * ever stored or published.
 */
export function imageAssetHandlers<Access>(ports: ImageAssetPorts<Access>) {
    return {
        GET: async (request: Request, serverId: string) => {
            const access = await ports.authorize(serverId)
            if (!access) return json({ error: "forbidden" }, 403)
            const kind = kindOf(request)
            if (!kind.success) return json({ error: "invalid_kind" }, 400)
            try {
                return json(await ports.list(access, kind.data))
            } catch {
                return json({ error: "unavailable" }, 503)
            }
        },
        POST: async (request: Request, serverId: string) => {
            if (request.headers.get("origin") !== new URL(request.url).origin)
                return json({ error: "forbidden" }, 403)
            const access = await ports.authorize(serverId)
            if (!access) return json({ error: "forbidden" }, 403)
            const kind = kindOf(request)
            if (!kind.success) return json({ error: "invalid_kind" }, 400)
            let reserved: ReserveUploadResult
            try {
                reserved = await ports.reserve(access, kind.data)
            } catch {
                return json({ error: "unavailable" }, 503)
            }
            if ("error" in reserved)
                return json(
                    {
                        error: "upload_limited",
                        retryAfterMs: reserved.retryAfterMs,
                    },
                    429,
                    {
                        "Retry-After": String(
                            Math.max(1, Math.ceil(reserved.retryAfterMs / 1000))
                        ),
                    }
                )
            const bytes = await ports.readBody(request, IMAGE_MAX_INPUT_BYTES)
            if (!bytes) return json({ error: "too_large" }, 413)
            const source = {
                declaredType: request.headers.get("content-type"),
                bytes: bytes.byteLength,
                sniffed: sniffImageType(bytes),
            }
            // Type and size checks run before the decoder ever sees the bytes.
            const early = validateImageSource({ ...source, decoded: null })
            if (early && early !== "undecodable")
                return json({ error: early }, 400)
            const invalid = validateImageSource({
                ...source,
                decoded: await inspectImage(bytes),
            })
            if (invalid) return json({ error: invalid }, 400)
            let normalized: Awaited<ReturnType<typeof normalizeImage>>
            try {
                normalized = await normalizeImage(bytes, kind.data)
            } catch {
                return json({ error: "undecodable" }, 400)
            }
            try {
                const storageId = await ports.upload(
                    reserved.uploadUrl,
                    normalized.bytes,
                    normalized.contentType
                )
                const publicId = ports.randomId()
                const created = await ports.create(access, {
                    kind: kind.data,
                    publicId,
                    storageId,
                    contentType: normalized.contentType,
                    width: normalized.width,
                    height: normalized.height,
                    bytes: normalized.bytes.byteLength,
                    sha256: normalized.sha256,
                    publicUrl: `${ports.siteUrl().replace(/\/+$/, "")}${imageAssetPath(publicId, normalized.contentType)}`,
                })
                return "error" in created
                    ? json({ error: created.error }, 400)
                    : json({ asset: created.asset })
            } catch {
                return json({ error: "unavailable" }, 503)
            }
        },
    }
}
