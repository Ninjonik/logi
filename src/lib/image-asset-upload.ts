import {
    IMAGE_INPUT_TYPES,
    IMAGE_MAX_INPUT_BYTES,
    type ImageAssetKind,
} from "@/domain/assets/image-asset"
import {
    imageAssetDtoSchema,
    type ImageAssetDto,
} from "@/domain/assets/image-asset.schema"
import { z } from "zod"

/** Every error code of `POST /api/servers/{serverId}/image-assets`. */
export const IMAGE_UPLOAD_ERRORS = [
    "invalid_kind",
    "unsupported_type",
    "type_mismatch",
    "bad_dimensions",
    "animated",
    "undecodable",
    "invalid_asset",
    "forbidden",
    "too_large",
    "upload_limited",
    "unavailable",
] as const
export type ImageUploadError = (typeof IMAGE_UPLOAD_ERRORS)[number]
export type ImageUploadResult =
    | { ok: true; asset: ImageAssetDto }
    | { ok: false; error: ImageUploadError; retryAfterMs: number | null }

const successSchema = z.object({ asset: imageAssetDtoSchema })
const failureSchema = z.object({
    error: z.enum(IMAGE_UPLOAD_ERRORS),
    retryAfterMs: z.number().nonnegative().optional(),
})

/** Rejects files the upload route would refuse before any bytes are sent. */
export function precheckImageFile(file: {
    size: number
    type: string
}): ImageUploadError | null {
    if (!(IMAGE_INPUT_TYPES as readonly string[]).includes(file.type))
        return "unsupported_type"
    if (file.size <= 0 || file.size > IMAGE_MAX_INPUT_BYTES) return "too_large"
    return null
}

/** Maps an upload response to the asset or one documented error code. */
export function readImageUploadResponse(
    status: number,
    body: unknown,
    retryAfterHeader: string | null
): ImageUploadResult {
    if (status === 200) {
        const parsed = successSchema.safeParse(body)
        return parsed.success
            ? { ok: true, asset: parsed.data.asset }
            : { ok: false, error: "unavailable", retryAfterMs: null }
    }
    const parsed = failureSchema.safeParse(body)
    const error: ImageUploadError = parsed.success
        ? parsed.data.error
        : status === 403
          ? "forbidden"
          : status === 413
            ? "too_large"
            : status === 429
              ? "upload_limited"
              : "unavailable"
    const header = Number(retryAfterHeader)
    const retryAfterMs =
        error !== "upload_limited"
            ? null
            : parsed.success && parsed.data.retryAfterMs !== undefined
              ? parsed.data.retryAfterMs
              : Number.isFinite(header) && header >= 0
                ? header * 1000
                : null
    return { ok: false, error, retryAfterMs }
}

/**
 * Fills a localized upload message's `{seconds}` placeholder with the route's
 * retry hint, rounded up to at least one second; other messages pass unchanged.
 */
export function formatImageUploadMessage(
    message: string,
    retryAfterMs: number | null
): string {
    return message.replace(
        "{seconds}",
        String(Math.max(1, Math.ceil((retryAfterMs ?? 0) / 1000)))
    )
}

/** Same-origin upload of the raw file bytes; the response's asset ID is what settings store. */
export async function uploadImageAsset(
    serverId: string,
    kind: ImageAssetKind,
    file: Blob,
    fetcher: typeof fetch = fetch
): Promise<ImageUploadResult> {
    const rejected = precheckImageFile(file)
    if (rejected) return { ok: false, error: rejected, retryAfterMs: null }
    try {
        const response = await fetcher(
            `/api/servers/${encodeURIComponent(serverId)}/image-assets?kind=${kind}${
                "name" in file && typeof file.name === "string" && file.name
                    ? `&name=${encodeURIComponent(file.name.slice(0, 200))}`
                    : ""
            }`,
            {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            }
        )
        const body: unknown = await response.json().catch(() => null)
        return readImageUploadResponse(
            response.status,
            body,
            response.headers.get("Retry-After")
        )
    } catch {
        return { ok: false, error: "unavailable", retryAfterMs: null }
    }
}

const listSchema = z.object({ assets: z.array(imageAssetDtoSchema) })
export type ImageAssetListResult =
    { ok: true; assets: ImageAssetDto[] } | { ok: false }

/** Same-origin list of this workspace's ready uploads of one kind, newest first. */
export async function listImageAssets(
    serverId: string,
    kind: ImageAssetKind,
    fetcher: typeof fetch = fetch
): Promise<ImageAssetListResult> {
    try {
        const response = await fetcher(
            `/api/servers/${encodeURIComponent(serverId)}/image-assets?kind=${kind}`
        )
        const parsed = listSchema.safeParse(
            await response.json().catch(() => null)
        )
        if (!response.ok || !parsed.success) return { ok: false }
        return {
            ok: true,
            assets: parsed.data.assets
                .filter((asset) => asset.kind === kind)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        }
    } catch {
        return { ok: false }
    }
}
