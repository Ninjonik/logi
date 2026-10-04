import {
    isStorableNormalizedImage,
    type ImageAssetDto,
    type ImageAssetKind,
    type ImageInputType,
} from "../../domain/assets/image-asset"

export type StoreImageAssetResult =
    { ok: true; asset: ImageAssetDto } | { error: "invalid_asset" }

/** Storage and persistence for one normalized image; `StorageId` stays opaque here. */
export type ImageAssetStoragePorts<StorageId> = {
    /** Lowercase hex SHA-256 of exactly the bytes that will be stored. */
    digest(bytes: ArrayBuffer): Promise<string>
    store(bytes: ArrayBuffer, contentType: ImageInputType): Promise<StorageId>
    /** Re-authorizes the actor and records the asset in its own transaction. */
    record(stored: {
        storageId: StorageId
        bytes: number
        sha256: string
    }): Promise<StoreImageAssetResult>
    remove(storageId: StorageId): Promise<void>
}

const recordFailed = () => new Error("Image asset could not be recorded.")

/**
 * Stores normalized bytes and records them, so a file never outlives a failed
 * record: when recording returns an error or throws, exactly the blob stored
 * here is removed before a clean error is returned or thrown. Byte size and
 * digest are derived from the stored bytes, never taken from the caller.
 */
export async function storeImageAsset<StorageId>(
    input: {
        kind: ImageAssetKind
        contentType: ImageInputType
        bytes: ArrayBuffer
    },
    ports: ImageAssetStoragePorts<StorageId>
): Promise<StoreImageAssetResult> {
    const view = new Uint8Array(input.bytes)
    if (
        !isStorableNormalizedImage({
            kind: input.kind,
            contentType: input.contentType,
            bytes: view,
        })
    )
        return { error: "invalid_asset" }
    const sha256 = await ports.digest(input.bytes)
    const storageId = await ports.store(input.bytes, input.contentType)
    let recorded: StoreImageAssetResult | null
    try {
        recorded = await ports.record({
            storageId,
            bytes: view.byteLength,
            sha256,
        })
    } catch {
        recorded = null
    }
    if (recorded && "ok" in recorded) return recorded
    try {
        await ports.remove(storageId)
    } catch {
        throw recordFailed()
    }
    if (!recorded) throw recordFailed()
    return { error: "invalid_asset" }
}
