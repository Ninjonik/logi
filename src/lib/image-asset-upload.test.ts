import {
    formatImageUploadMessage,
    listImageAssets,
    precheckImageFile,
    readImageUploadResponse,
    uploadImageAsset,
} from "./image-asset-upload"
import assert from "node:assert/strict"
import test from "node:test"

const asset = {
    id: "imageAssets:1",
    kind: "panel-banner",
    contentType: "image/webp",
    width: 1920,
    height: 1080,
    bytes: 4096,
    url: "https://logi.test/api/image-assets/0123456789abcdef0123456789abcdef.webp",
    createdAt: "2026-10-04T00:00:00.000Z",
}

test("uploads the raw file with its MIME type to the scoped asset route", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = []
    const file = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" })
    const result = await uploadImageAsset(
        "server/1",
        "panel-banner",
        file,
        async (url, init) => {
            calls.push({ url: String(url), init })
            return Response.json({ asset })
        }
    )
    assert.deepEqual(result, { ok: true, asset })
    assert.equal(
        calls[0]!.url,
        "/api/servers/server%2F1/image-assets?kind=panel-banner"
    )
    assert.equal(calls[0]!.init?.method, "POST")
    assert.deepEqual(calls[0]!.init?.headers, { "Content-Type": "image/png" })
    assert.equal(calls[0]!.init?.body, file)
})

test("unsupported or oversized files are refused before any request", async () => {
    let called = false
    const fetcher = async () => {
        called = true
        return Response.json({ asset })
    }
    assert.deepEqual(
        await uploadImageAsset(
            "s",
            "panel-banner",
            new Blob(["gif"], { type: "image/gif" }),
            fetcher
        ),
        { ok: false, error: "unsupported_type", retryAfterMs: null }
    )
    assert.equal(
        precheckImageFile({ size: 2 * 1024 * 1024 + 1, type: "image/webp" }),
        "too_large"
    )
    assert.equal(
        precheckImageFile({ size: 0, type: "image/webp" }),
        "too_large"
    )
    assert.equal(
        precheckImageFile({ size: 2 * 1024 * 1024, type: "image/jpeg" }),
        null
    )
    assert.equal(called, false)
})

test("each documented failure maps to its code, with the rate-limit delay", () => {
    for (const error of [
        "invalid_kind",
        "unsupported_type",
        "type_mismatch",
        "bad_dimensions",
        "animated",
        "undecodable",
        "invalid_asset",
    ])
        assert.deepEqual(readImageUploadResponse(400, { error }, null), {
            ok: false,
            error,
            retryAfterMs: null,
        })
    assert.equal(
        readImageUploadResponse(403, { error: "forbidden" }, null).ok,
        false
    )
    assert.deepEqual(
        readImageUploadResponse(413, { error: "too_large" }, null),
        {
            ok: false,
            error: "too_large",
            retryAfterMs: null,
        }
    )
    assert.deepEqual(
        readImageUploadResponse(
            429,
            { error: "upload_limited", retryAfterMs: 42_000 },
            "42"
        ),
        { ok: false, error: "upload_limited", retryAfterMs: 42_000 }
    )
    assert.deepEqual(readImageUploadResponse(429, "Too Many", "30"), {
        ok: false,
        error: "upload_limited",
        retryAfterMs: 30_000,
    })
    assert.deepEqual(readImageUploadResponse(503, null, null), {
        ok: false,
        error: "unavailable",
        retryAfterMs: null,
    })
    // An unexpected success body is never trusted as an asset.
    assert.deepEqual(readImageUploadResponse(200, { asset: { id: 1 } }, null), {
        ok: false,
        error: "unavailable",
        retryAfterMs: null,
    })
})

test("a network failure is reported as unavailable", async () => {
    assert.deepEqual(
        await uploadImageAsset(
            "s",
            "panel-banner",
            new Blob(["x"], { type: "image/webp" }),
            async () => {
                throw new Error("offline")
            }
        ),
        { ok: false, error: "unavailable", retryAfterMs: null }
    )
})

test("lists this workspace's uploads of one kind, newest first", async () => {
    const urls: string[] = []
    const older = {
        ...asset,
        id: "imageAssets:0",
        createdAt: "2026-10-01T00:00:00.000Z",
    }
    const logo = { ...asset, id: "imageAssets:2", kind: "team-logo" }
    const result = await listImageAssets(
        "server/1",
        "panel-banner",
        async (url) => {
            urls.push(String(url))
            return Response.json({ assets: [older, asset, logo] })
        }
    )
    assert.deepEqual(result, { ok: true, assets: [asset, older] })
    assert.deepEqual(urls, [
        "/api/servers/server%2F1/image-assets?kind=panel-banner",
    ])
})

test("a refused, malformed or failed listing offers no assets", async () => {
    for (const fetcher of [
        async () => Response.json({ error: "forbidden" }, { status: 403 }),
        async () => Response.json({ error: "unavailable" }, { status: 503 }),
        async () => Response.json({ assets: [{ id: 1 }] }),
        async () => new Response("not json"),
        async () => {
            throw new Error("offline")
        },
    ])
        assert.deepEqual(await listImageAssets("s", "panel-banner", fetcher), {
            ok: false,
        })
})

test("upload messages show the retry wait in whole seconds, at least one", () => {
    const limited = "Too many uploads. Retry in {seconds} s."
    assert.equal(
        formatImageUploadMessage(limited, 41_200),
        "Too many uploads. Retry in 42 s."
    )
    assert.equal(
        formatImageUploadMessage(limited, 0),
        "Too many uploads. Retry in 1 s."
    )
    assert.equal(
        formatImageUploadMessage(limited, null),
        "Too many uploads. Retry in 1 s."
    )
    assert.equal(
        formatImageUploadMessage("The image exceeds 2 MiB.", 5000),
        "The image exceeds 2 MiB."
    )
})
