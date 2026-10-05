import {
    imageAssetHandlers,
    type ImageAssetPorts,
    type NormalizedImageUpload,
} from "./image-upload"
import { sniffImageType } from "@/domain/assets/image-asset"
import { readBoundedBytes } from "./request-bytes"
import assert from "node:assert/strict"
import test from "node:test"
import sharp from "sharp"

const origin = "https://logi.test"
const route = (kind?: string) =>
    `http://127.0.0.1:3000/api/servers/server-1/image-assets${kind ? `?kind=${kind}` : ""}`
const pngBytes = async () =>
    new Uint8Array(
        await sharp({
            create: {
                width: 1000,
                height: 600,
                channels: 4,
                background: { r: 10, g: 20, b: 30, alpha: 1 },
            },
        })
            .png()
            .toBuffer()
    )
const upload = (
    body: Uint8Array<ArrayBuffer>,
    contentType: string,
    init: { kind?: string; origin?: string | null } = {}
) =>
    new Request(route(init.kind ?? "team-logo"), {
        method: "POST",
        headers: {
            "content-type": contentType,
            ...(init.origin === null ? {} : { origin: init.origin ?? origin }),
        },
        body,
    })

function fakePorts(overrides: Partial<ImageAssetPorts<string>> = {}) {
    const calls = {
        reserve: 0,
        read: 0,
        store: 0,
        stored: [] as {
            asset: NormalizedImageUpload
            bytes: Uint8Array
        }[],
    }
    const ports: ImageAssetPorts<string> = {
        authorize: async (serverId) =>
            serverId === "server-1" ? "guild-1" : null,
        reserve: async () => {
            calls.reserve++
            return { ok: true }
        },
        readBody: async (request, maxBytes) => {
            calls.read++
            return readBoundedBytes(request, maxBytes)
        },
        store: async (access, asset, bytes) => {
            calls.store++
            assert.equal(access, "guild-1")
            calls.stored.push({ asset, bytes })
            return {
                ok: true,
                asset: {
                    id: "asset-1",
                    kind: asset.kind,
                    contentType: asset.contentType,
                    width: asset.width,
                    height: asset.height,
                    bytes: bytes.byteLength,
                    url: asset.publicUrl,
                    createdAt: "2026-10-04T00:00:00.000Z",
                },
            }
        },
        list: async () => ({ assets: [] }),
        randomId: () => "a".repeat(32),
        siteUrl: () => origin,
        ...overrides,
    }
    return { calls, handlers: imageAssetHandlers(ports) }
}

test("uploads are same-origin, admin-only and need a supported kind", async () => {
    const { calls, handlers } = fakePorts()
    const png = await pngBytes()
    for (const request of [
        upload(png, "image/png", { origin: null }),
        upload(png, "image/png", { origin: "https://evil.test" }),
    ]) {
        const response = await handlers.POST(request, "server-1")
        assert.equal(response.status, 403)
        assert.equal(response.headers.get("cache-control"), "no-store")
    }
    assert.equal(
        (await handlers.POST(upload(png, "image/png"), "server-2")).status,
        403
    )
    for (const kind of ["", "svg", "team-logo%20"]) {
        const response = await handlers.POST(
            upload(png, "image/png", { kind }),
            "server-1"
        )
        assert.equal(response.status, 400)
        assert.deepEqual(await response.json(), { error: "invalid_kind" })
    }
    assert.equal(calls.reserve, 0)
    assert.equal(calls.read, 0)
})

test("a limited attempt answers before any body byte is read", async () => {
    const { calls, handlers } = fakePorts({
        reserve: async () => ({
            error: "upload_limited",
            retryAfterMs: 61_500,
        }),
    })
    const response = await handlers.POST(
        upload(await pngBytes(), "image/png"),
        "server-1"
    )
    assert.equal(response.status, 429)
    assert.equal(response.headers.get("retry-after"), "62")
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.deepEqual(await response.json(), {
        error: "upload_limited",
        retryAfterMs: 61_500,
    })
    assert.equal(calls.read, 0)
    assert.equal(calls.store, 0)
})

test("oversized bodies stop at 413 and never reach storage", async () => {
    const { calls, handlers } = fakePorts({ readBody: async () => null })
    const response = await handlers.POST(
        upload(await pngBytes(), "image/png"),
        "server-1"
    )
    assert.equal(response.status, 413)
    assert.deepEqual(await response.json(), { error: "too_large" })
    assert.equal(calls.reserve, 1)
    assert.equal(calls.store, 0)
})

test("the declared type must match the bytes and the decoder", async () => {
    const { calls, handlers } = fakePorts()
    const png = await pngBytes()
    const cases: [Uint8Array<ArrayBuffer>, string, string][] = [
        [png, "image/jpeg", "type_mismatch"],
        [png, "text/plain", "unsupported_type"],
        [new TextEncoder().encode("<svg/>"), "image/png", "unsupported_type"],
        [
            new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]),
            "image/png",
            "undecodable",
        ],
    ]
    for (const [bytes, contentType, error] of cases) {
        const response = await handlers.POST(
            upload(bytes, contentType),
            "server-1"
        )
        assert.equal(response.status, 400)
        assert.deepEqual(await response.json(), { error })
    }
    assert.equal(calls.store, 0)
})

test("animated and oversized-dimension sources are rejected before storage", async () => {
    const { calls, handlers } = fakePorts()
    const frames = await Promise.all(
        [10, 200].map((r) =>
            sharp({
                create: {
                    width: 20,
                    height: 20,
                    channels: 4,
                    background: { r, g: 0, b: 0, alpha: 1 },
                },
            })
                .png()
                .toBuffer()
        )
    )
    const animated = new Uint8Array(
        await sharp(frames, { join: { animated: true } })
            .webp()
            .toBuffer()
    )
    const wide = new Uint8Array(
        await sharp({
            create: {
                width: 5000,
                height: 10,
                channels: 3,
                background: { r: 0, g: 0, b: 0 },
            },
        })
            .png()
            .toBuffer()
    )
    // Over the 4096x4096 pixel budget: still reported as a dimension problem.
    const large = new Uint8Array(
        await sharp({
            create: {
                width: 5000,
                height: 4000,
                channels: 3,
                background: { r: 0, g: 0, b: 0 },
            },
        })
            .png()
            .toBuffer()
    )
    for (const [bytes, contentType, error] of [
        [animated, "image/webp", "animated"],
        [wide, "image/png", "bad_dimensions"],
        [large, "image/png", "bad_dimensions"],
    ] as const) {
        const response = await handlers.POST(
            upload(bytes, contentType, { kind: "panel-banner" }),
            "server-1"
        )
        assert.equal(response.status, 400)
        assert.deepEqual(await response.json(), { error })
    }
    assert.equal(calls.store, 0)
})

test("a valid logo behind a proxy is normalized, stored and returned with the public origin", async () => {
    const { calls, handlers } = fakePorts({ siteUrl: () => `${origin}/` })
    const response = await handlers.POST(
        upload(await pngBytes(), "image/png; charset=binary"),
        "server-1"
    )
    assert.equal(response.status, 200)
    const body = (await response.json()) as { asset: { url: string } }
    assert.equal(
        body.asset.url,
        `${origin}/api/image-assets/${"a".repeat(32)}.png`
    )
    assert.equal(calls.store, 1)
    const [stored] = calls.stored
    assert.ok(stored)
    assert.equal(sniffImageType(stored.bytes), "image/png")
    assert.equal(stored.bytes.byteOffset, 0)
    assert.equal(stored.bytes.byteLength, stored.bytes.buffer.byteLength)
    assert.deepEqual(Object.keys(stored.asset).sort(), [
        "contentType",
        "height",
        "kind",
        "publicId",
        "publicUrl",
        "width",
    ])
    assert.equal(stored.asset.kind, "team-logo")
    assert.equal(stored.asset.publicId, "a".repeat(32))
    assert.equal(stored.asset.contentType, "image/png")
    assert.equal(stored.asset.width, 512)
    assert.ok(stored.asset.height <= 512)
    assert.equal(stored.asset.publicUrl, body.asset.url)
})

test("a map image must be at least 160 × 160 and is stored as WebP within 1200 × 1200", async () => {
    const square = async (size: number) =>
        new Uint8Array(
            await sharp({
                create: {
                    width: size,
                    height: size,
                    channels: 3,
                    background: { r: 90, g: 80, b: 60 },
                },
            })
                .png()
                .toBuffer()
        )
    const small = fakePorts()
    const refused = await small.handlers.POST(
        upload(await square(120), "image/png", { kind: "panel-map" }),
        "server-1"
    )
    assert.equal(refused.status, 400)
    assert.deepEqual(await refused.json(), { error: "bad_dimensions" })
    assert.equal(small.calls.store, 0)
    const { calls, handlers } = fakePorts()
    const response = await handlers.POST(
        upload(await square(1600), "image/png", { kind: "panel-map" }),
        "server-1"
    )
    assert.equal(response.status, 200)
    const [stored] = calls.stored
    assert.equal(stored?.asset.kind, "panel-map")
    assert.equal(stored?.asset.contentType, "image/webp")
    assert.equal(stored?.asset.width, 1200)
    assert.equal(stored?.asset.height, 1200)
})

test("storage and persistence failures map to unavailable", async () => {
    const png = await pngBytes()
    const persistence = fakePorts({
        store: async () => {
            throw new Error("convex down")
        },
    })
    const failed = await persistence.handlers.POST(
        upload(png, "image/png"),
        "server-1"
    )
    assert.equal(failed.status, 503)
    assert.deepEqual(await failed.json(), { error: "unavailable" })
    // Convex already removed the stored file when it rejects the record.
    const rejected = fakePorts({
        store: async () => ({ error: "invalid_asset" }),
    })
    const response = await rejected.handlers.POST(
        upload(png, "image/png"),
        "server-1"
    )
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: "invalid_asset" })
    const reservation = fakePorts({
        reserve: async () => {
            throw new Error("convex down")
        },
    })
    assert.equal(
        (await reservation.handlers.POST(upload(png, "image/png"), "server-1"))
            .status,
        503
    )
    assert.equal(reservation.calls.read, 0)
    assert.equal(reservation.calls.store, 0)
})

test("listing is admin-only, kind-scoped and reports outages", async () => {
    const asset = {
        id: "asset-1",
        kind: "panel-banner" as const,
        contentType: "image/webp" as const,
        width: 1920,
        height: 1080,
        bytes: 1000,
        url: `${origin}/api/image-assets/${"b".repeat(32)}.webp`,
        createdAt: "2026-10-04T00:00:00.000Z",
    }
    const { handlers } = fakePorts({
        list: async (access, kind) => {
            assert.equal(access, "guild-1")
            assert.equal(kind, "panel-banner")
            return { assets: [asset] }
        },
    })
    assert.equal(
        (await handlers.GET(new Request(route("panel-banner")), "server-2"))
            .status,
        403
    )
    assert.equal(
        (await handlers.GET(new Request(route()), "server-1")).status,
        400
    )
    const response = await handlers.GET(
        new Request(route("panel-banner")),
        "server-1"
    )
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.deepEqual(await response.json(), { assets: [asset] })
    const outage = fakePorts({
        list: async () => {
            throw new Error("convex down")
        },
    })
    assert.equal(
        (
            await outage.handlers.GET(
                new Request(route("panel-banner")),
                "server-1"
            )
        ).status,
        503
    )
})
