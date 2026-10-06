import {
    imageAssetFileName,
    canAttachImageAsset,
    cleanupDue,
    IMAGE_MAX_INPUT_BYTES,
    IMAGE_OUTPUT,
    imageAssetPath,
    isStorableNormalizedImage,
    parseImageAssetFile,
    sniffImageType,
    validateImageSource,
} from "./image-asset"
import assert from "node:assert/strict"
import test from "node:test"

const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0,
])
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])
const webp = new Uint8Array([
    ...Buffer.from("RIFF"),
    0,
    0,
    0,
    0,
    ...Buffer.from("WEBP"),
    ...Buffer.from("VP8 "),
])
const decoded = { width: 1024, height: 768, pages: 1, format: "png" }

test("magic numbers decide the type; declared types must agree", () => {
    assert.equal(sniffImageType(png), "image/png")
    assert.equal(sniffImageType(jpeg), "image/jpeg")
    assert.equal(sniffImageType(webp), "image/webp")
    assert.equal(sniffImageType(Buffer.from("<svg/>")), null)
    assert.equal(
        validateImageSource({
            declaredType: "image/png; charset=binary",
            bytes: png.length,
            sniffed: "image/png",
            decoded,
        }),
        null
    )
    assert.equal(
        validateImageSource({
            declaredType: "image/jpeg",
            bytes: 10,
            sniffed: "image/png",
            decoded,
        }),
        "type_mismatch"
    )
    assert.equal(
        validateImageSource({
            declaredType: "image/svg+xml",
            bytes: 10,
            sniffed: null,
            decoded: null,
        }),
        "unsupported_type"
    )
    assert.equal(
        validateImageSource({
            declaredType: "image/png",
            bytes: 10,
            sniffed: "image/png",
            decoded: { ...decoded, format: "gif" },
        }),
        "type_mismatch"
    )
})

test("size, dimension and animation bounds are enforced", () => {
    assert.equal(
        validateImageSource({
            declaredType: "image/png",
            bytes: 2 * 1024 * 1024 + 1,
            sniffed: "image/png",
            decoded,
        }),
        "too_large"
    )
    assert.equal(
        validateImageSource({
            declaredType: "image/png",
            bytes: 10,
            sniffed: "image/png",
            decoded: { ...decoded, width: 4097 },
        }),
        "bad_dimensions"
    )
    assert.equal(
        validateImageSource({
            declaredType: "image/png",
            bytes: 10,
            sniffed: "image/png",
            decoded: { ...decoded, width: undefined },
        }),
        "bad_dimensions"
    )
    assert.equal(
        validateImageSource({
            declaredType: "image/webp",
            bytes: 10,
            sniffed: "image/webp",
            decoded: { ...decoded, format: "webp", pages: 3 },
        }),
        "animated"
    )
    assert.equal(
        validateImageSource({
            declaredType: "image/png",
            bytes: 10,
            sniffed: "image/png",
            decoded: null,
        }),
        "undecodable"
    )
})

test("a map image must be at least 160 × 160; other kinds keep their bounds", () => {
    const source = {
        declaredType: "image/png",
        bytes: 10,
        sniffed: "image/png" as const,
    }
    const sized = (width: number, height: number) => ({
        ...decoded,
        width,
        height,
    })
    assert.equal(
        validateImageSource({
            ...source,
            decoded: sized(159, 400),
            kind: "panel-map",
        }),
        "bad_dimensions"
    )
    assert.equal(
        validateImageSource({
            ...source,
            decoded: sized(160, 160),
            kind: "panel-map",
        }),
        null
    )
    assert.equal(
        validateImageSource({
            ...source,
            decoded: sized(100, 100),
            kind: "panel-banner",
        }),
        null
    )
    assert.deepEqual(IMAGE_OUTPUT["panel-map"], {
        width: 1200,
        height: 1200,
        format: "webp",
    })
})

test("attachment needs the owning workspace, matching kind and a live asset; cleanup spares referenced assets", () => {
    const asset = {
        guildId: "guild",
        kind: "team-logo" as const,
        state: "ready" as const,
    }
    assert.equal(
        canAttachImageAsset(asset, { guildId: "guild", kind: "team-logo" }),
        true
    )
    assert.equal(
        canAttachImageAsset(asset, { guildId: "other", kind: "team-logo" }),
        false
    )
    assert.equal(
        canAttachImageAsset(asset, { guildId: "guild", kind: "panel-banner" }),
        false
    )
    assert.equal(
        canAttachImageAsset(
            { ...asset, state: "deleting" },
            { guildId: "guild", kind: "team-logo" }
        ),
        false
    )
    assert.equal(
        canAttachImageAsset(null, { guildId: "guild", kind: "team-logo" }),
        false
    )
    const now = Date.parse("2026-10-04T12:00:00.000Z")
    const old = {
        state: "ready" as const,
        createdAt: "2026-10-03T11:59:00.000Z",
    }
    assert.equal(cleanupDue(old, false, now), true)
    assert.equal(cleanupDue(old, true, now), false)
    assert.equal(
        cleanupDue(
            { ...old, createdAt: "2026-10-03T12:01:00.000Z" },
            false,
            now
        ),
        false
    )
})

test("public paths are immutable and strictly parsed", () => {
    const id = "0123456789abcdef0123456789abcdef"
    assert.equal(imageAssetPath(id, "image/png"), `/api/image-assets/${id}.png`)
    assert.deepEqual(parseImageAssetFile(`${id}.webp`), {
        publicId: id,
        extension: "webp",
    })
    assert.equal(parseImageAssetFile(`${id}.svg`), null)
    assert.equal(parseImageAssetFile(`../${id}.png`), null)
})

test("only the kind's normalized format within the byte bound is storable", () => {
    assert.equal(
        isStorableNormalizedImage({
            kind: "team-logo",
            contentType: "image/png",
            bytes: png,
        }),
        true
    )
    assert.equal(
        isStorableNormalizedImage({
            kind: "panel-banner",
            contentType: "image/webp",
            bytes: webp,
        }),
        true
    )
    // A logo is always published as PNG; a declared type must match the bytes.
    assert.equal(
        isStorableNormalizedImage({
            kind: "team-logo",
            contentType: "image/webp",
            bytes: webp,
        }),
        false
    )
    assert.equal(
        isStorableNormalizedImage({
            kind: "team-logo",
            contentType: "image/png",
            bytes: jpeg,
        }),
        false
    )
    assert.equal(
        isStorableNormalizedImage({
            kind: "team-logo",
            contentType: "image/png",
            bytes: new Uint8Array(),
        }),
        false
    )
    const oversized = new Uint8Array(IMAGE_MAX_INPUT_BYTES + 1)
    oversized.set(png)
    assert.equal(
        isStorableNormalizedImage({
            kind: "team-logo",
            contentType: "image/png",
            bytes: oversized,
        }),
        false
    )
})

test("an upload keeps only a clean display name (P8-08)", () => {
    assert.equal(imageAssetFileName("vlci-public.png"), "vlci-public.png")
    assert.equal(imageAssetFileName("C:\\fotky\\vlci.png"), "vlci.png")
    assert.equal(imageAssetFileName("../../x/banner\u0000.png"), "banner.png")
    assert.equal(imageAssetFileName("  "), null)
    assert.equal(imageAssetFileName(null), null)
    assert.equal(imageAssetFileName("a".repeat(300))?.length, 100)
})
