import {
    hllSample,
    wardogsSample,
} from "@/domain/discord-publications/panel-image-samples"
import { createPanelImageRenderer } from "./render"
import assert from "node:assert/strict"
import test from "node:test"
import path from "node:path"
import sharp from "sharp"

const publicDir = path.resolve(import.meta.dirname, "../../../public")

test("style A renders real 1200 × 400 PNGs for Hell Let Loose and Wardogs", async () => {
    const requested: string[] = []
    const renderer = createPanelImageRenderer({
        publicDir,
        loadAsset: async (id) => {
            requested.push(id)
            return null
        },
    })
    for (const model of [hllSample, wardogsSample]) {
        const png = await renderer.render({ kind: "score", model })
        const meta = await sharp(png).metadata()
        assert.equal(meta.format, "png")
        assert.equal(meta.width, 1200)
        assert.equal(meta.height, 400)
        assert.ok(png.byteLength < 1024 * 1024, `${png.byteLength} bytes`)
    }
    // Built-in art is read from the package, never through the asset port.
    assert.deepEqual(requested, [])
})

test("a banner background comes from the asset port; a missing asset still renders", async () => {
    const banner = await sharp({
        create: {
            width: 600,
            height: 200,
            channels: 3,
            background: { r: 200, g: 40, b: 40 },
        },
    })
        .webp()
        .toBuffer()
    const asked: string[] = []
    const renderer = createPanelImageRenderer({
        publicDir,
        loadAsset: async (id) => {
            asked.push(id)
            return id === "a".repeat(32) ? new Uint8Array(banner) : null
        },
    })
    const model = {
        version: 1 as const,
        language: "cs" as const,
        accentColor: "#e8a33d",
        clanTag: "VLK",
        clanName: "Vlci",
        subtitle: "Server #1 · Public · Hell Let Loose",
        background: {
            kind: "asset" as const,
            publicId: "a".repeat(32),
            crop: "top" as const,
        },
    }
    const png = await renderer.render({ kind: "banner", model })
    const { dominant } = await sharp(png).stats()
    // The red banner shows through the top of the image.
    assert.ok(dominant.r > dominant.b, JSON.stringify(dominant))
    const missing = await renderer.render({
        kind: "banner",
        model: {
            ...model,
            background: { ...model.background, publicId: "b".repeat(32) },
        },
    })
    assert.equal((await sharp(missing).metadata()).width, 1200)
    assert.deepEqual(asked, ["a".repeat(32), "b".repeat(32)])
})
