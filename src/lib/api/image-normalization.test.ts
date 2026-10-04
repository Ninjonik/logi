import {
    IMAGE_OUTPUT,
    sniffImageType,
    validateImageSource,
} from "@/domain/assets/image-asset"
import { inspectImage, normalizeImage } from "./image-normalization"
import assert from "node:assert/strict"
import test from "node:test"
import sharp from "sharp"

const solid = (width: number, height: number) =>
    sharp({
        create: {
            width,
            height,
            channels: 4,
            background: { r: 200, g: 40, b: 40, alpha: 1 },
        },
    })

test("inspection reports decoder facts and rejects undecodable bytes", async () => {
    const png = new Uint8Array(await solid(1000, 600).png().toBuffer())
    const decoded = await inspectImage(png)
    assert.ok(decoded)
    assert.equal(decoded.width, 1000)
    assert.equal(decoded.height, 600)
    assert.equal(decoded.format, "png")
    assert.ok(decoded.pages === undefined || decoded.pages === 1)
    const webp = new Uint8Array(await solid(30, 20).webp().toBuffer())
    assert.equal((await inspectImage(webp))?.format, "webp")
    const jpeg = new Uint8Array(await solid(30, 20).jpeg().toBuffer())
    assert.equal((await inspectImage(jpeg))?.format, "jpeg")
    assert.equal(await inspectImage(Buffer.from("<svg/>")), null)
    assert.equal(
        validateImageSource({
            declaredType: "image/png",
            bytes: png.length,
            sniffed: sniffImageType(png),
            decoded,
        }),
        null
    )
    assert.equal(
        validateImageSource({
            declaredType: "image/jpeg",
            bytes: png.length,
            sniffed: sniffImageType(png),
            decoded,
        }),
        "type_mismatch"
    )
})

test("logos fit inside 512 squared as PNG without enlarging small sources", async () => {
    const png = new Uint8Array(await solid(1000, 600).png().toBuffer())
    const logo = await normalizeImage(png, "team-logo")
    assert.equal(logo.contentType, "image/png")
    assert.equal(sniffImageType(logo.bytes), "image/png")
    assert.ok(logo.width <= IMAGE_OUTPUT["team-logo"].width)
    assert.ok(logo.height <= IMAGE_OUTPUT["team-logo"].height)
    assert.equal(logo.width, 512)
    assert.match(logo.sha256, /^[a-f0-9]{64}$/)
    const output = await sharp(logo.bytes).metadata()
    assert.equal(output.width, logo.width)
    assert.equal(output.height, logo.height)
    const small = await normalizeImage(
        new Uint8Array(await solid(100, 80).jpeg().toBuffer()),
        "team-logo"
    )
    assert.equal(small.width, 100)
    assert.equal(small.height, 80)
    assert.equal(small.contentType, "image/png")
})

test("banners fit inside 1920x1080 as WebP and EXIF orientation is applied then dropped", async () => {
    const webp = new Uint8Array(await solid(2500, 1200).webp().toBuffer())
    const banner = await normalizeImage(webp, "panel-banner")
    assert.equal(banner.contentType, "image/webp")
    assert.equal(sniffImageType(banner.bytes), "image/webp")
    assert.ok(banner.width <= IMAGE_OUTPUT["panel-banner"].width)
    assert.ok(banner.height <= IMAGE_OUTPUT["panel-banner"].height)
    assert.equal(banner.width, 1920)
    const rotated = new Uint8Array(
        await solid(300, 100).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    )
    assert.equal((await sharp(rotated).metadata()).orientation, 6)
    const upright = await normalizeImage(rotated, "team-logo")
    assert.equal(upright.width, 100)
    assert.equal(upright.height, 300)
    const metadata = await sharp(upright.bytes).metadata()
    assert.equal(metadata.orientation, undefined)
    assert.equal(metadata.exif, undefined)
})

test("animated sources report their frames and pixel bombs never decode", async () => {
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
    const decoded = await inspectImage(animated)
    assert.equal(decoded?.pages, 2)
    assert.equal(
        validateImageSource({
            declaredType: "image/webp",
            bytes: animated.length,
            sniffed: sniffImageType(animated),
            decoded,
        }),
        "animated"
    )
    const bomb = new Uint8Array(await solid(4097, 4097).png().toBuffer())
    assert.equal(await inspectImage(bomb), null)
    await assert.rejects(normalizeImage(bomb, "panel-banner"))
})
