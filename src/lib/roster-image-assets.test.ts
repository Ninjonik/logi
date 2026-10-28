import { loadRosterImageAsset } from "./roster-image-assets"
import assert from "node:assert/strict"
import test from "node:test"
import sharp from "sharp"

test("bundled role icons render inline without a localhost image fetch", async () => {
    const source = await loadRosterImageAsset(
        "http://localhost:3000/img/roles/icn_wdtank.png",
        "http://localhost:3000"
    )
    assert.ok(source)
    assert.ok(source.startsWith("data:image/png;base64,"))
    const metadata = await sharp(
        Buffer.from(source.split(",")[1], "base64")
    ).metadata()
    assert.equal(metadata.format, "png")
    assert.ok(metadata.width && metadata.width <= 128)
})

test("fallback is a decodable inline PNG", async () => {
    assert.ok(
        (
            await loadRosterImageAsset("/favicon.png", "https://logibot.tech")
        )?.startsWith("data:image/png;base64,")
    )
})

test("missing files and external non-Discord sources cannot break publication", async () => {
    assert.equal(
        await loadRosterImageAsset("/missing.png", "http://localhost:3000"),
        undefined
    )
    assert.equal(
        await loadRosterImageAsset(
            "http://127.0.0.1/private.png",
            "https://logibot.tech"
        ),
        undefined
    )
    assert.equal(
        await loadRosterImageAsset(
            "https://example.com/image.png",
            "https://logibot.tech"
        ),
        undefined
    )
    assert.equal(
        await loadRosterImageAsset(
            "/%2e%2e%2fpackage.json",
            "https://logibot.tech"
        ),
        undefined
    )
})
