import {
    storeImageAsset,
    type ImageAssetStoragePorts,
    type StoreImageAssetResult,
} from "./store-image-asset"
import assert from "node:assert/strict"
import test from "node:test"

const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]).buffer
const asset = {
    id: "imageAssets:1",
    kind: "team-logo" as const,
    contentType: "image/png" as const,
    width: 512,
    height: 512,
    bytes: 11,
    url: "https://logi.test/api/image-assets/" + "a".repeat(32) + ".png",
    createdAt: "2026-10-04T12:00:00.000Z",
}

function fakes(
    record: (stored: {
        storageId: string
        bytes: number
        sha256: string
    }) => Promise<StoreImageAssetResult>,
    remove: (storageId: string) => Promise<void> = async () => undefined
) {
    const files = new Map<string, ArrayBuffer>()
    const calls: string[] = []
    const ports: ImageAssetStoragePorts<string> = {
        digest: async () => "c".repeat(64),
        store: async (bytes, contentType) => {
            const id = `storage:${files.size + 1}`
            files.set(id, bytes)
            calls.push(`store ${contentType}`)
            return id
        },
        record: async (stored) => {
            calls.push(`record ${stored.storageId}`)
            return await record(stored)
        },
        remove: async (storageId) => {
            calls.push(`remove ${storageId}`)
            await remove(storageId)
            files.delete(storageId)
        },
    }
    return { files, calls, ports }
}
const input = {
    kind: "team-logo" as const,
    contentType: "image/png" as const,
    bytes: png,
}

test("a recorded upload keeps its blob; size and digest come from the stored bytes", async () => {
    let seen: unknown
    const { files, calls, ports } = fakes(async (stored) => {
        seen = stored
        return { ok: true, asset }
    })
    assert.deepEqual(await storeImageAsset(input, ports), { ok: true, asset })
    assert.deepEqual(seen, {
        storageId: "storage:1",
        bytes: 11,
        sha256: "c".repeat(64),
    })
    assert.deepEqual(calls, ["store image/png", "record storage:1"])
    assert.deepEqual([...files.keys()], ["storage:1"])
})

test("a returned record error removes exactly the stored blob", async () => {
    const { files, calls, ports } = fakes(async () => ({
        error: "invalid_asset",
    }))
    files.set("storage:other", new ArrayBuffer(1))
    assert.deepEqual(await storeImageAsset(input, ports), {
        error: "invalid_asset",
    })
    assert.deepEqual(calls, [
        "store image/png",
        "record storage:2",
        "remove storage:2",
    ])
    assert.deepEqual([...files.keys()], ["storage:other"])
})

test("a thrown record error removes the blob and throws a clean error", async () => {
    const { files, calls, ports } = fakes(async () => {
        throw new Error("Forbidden. internal detail")
    })
    await assert.rejects(storeImageAsset(input, ports), {
        message: "Image asset could not be recorded.",
    })
    assert.deepEqual(calls.at(-1), "remove storage:1")
    assert.equal(files.size, 0)
})

test("a failed removal still reports a clean error", async () => {
    const { calls, ports } = fakes(
        async () => ({ error: "invalid_asset" }),
        async () => {
            throw new Error("storage detail")
        }
    )
    await assert.rejects(storeImageAsset(input, ports), {
        message: "Image asset could not be recorded.",
    })
    assert.equal(calls.at(-1), "remove storage:1")
})

test("bytes that are not the kind's normalized output are never stored", async () => {
    const { calls, ports } = fakes(async () => ({ ok: true, asset }))
    for (const rejected of [
        { ...input, contentType: "image/webp" as const },
        { ...input, bytes: new Uint8Array([0xff, 0xd8, 0xff, 0]).buffer },
        { ...input, bytes: new ArrayBuffer(0) },
        { ...input, bytes: new ArrayBuffer(2 * 1024 * 1024 + 1) },
    ])
        assert.deepEqual(await storeImageAsset(rejected, ports), {
            error: "invalid_asset",
        })
    assert.deepEqual(calls, [])
})
