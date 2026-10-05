import { readFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import assert from "node:assert/strict"
import test from "node:test"
import sharp from "sharp"

import {
    applicationEmojiAssets,
    builtInMapImage,
    factionAssets,
} from "./assets"

test("the bot uploads 19 fixed signs as small square application emoji", async () => {
    const assets = await applicationEmojiAssets()
    assert.equal(assets.length, 19)
    assert.equal(assets.filter((a) => a.group === "faction").length, 12)
    assert.equal(assets.filter((a) => a.group === "status").length, 7)
    assert.equal(new Set(assets.map((a) => a.name)).size, 19)
    for (const asset of assets) {
        assert.match(asset.name, /^logi_[a-z_]+_[0-9a-f]{8}$/)
        assert.ok(asset.name.length <= 32)
        const [header, base64] = asset.image.split(",")
        const bytes = Buffer.from(base64!, "base64")
        assert.ok(bytes.byteLength <= 256 * 1024, asset.key)
        if (header === "data:image/png;base64") {
            const meta = await sharp(bytes).metadata()
            assert.deepEqual([meta.width, meta.height], [128, 128], asset.key)
        } else assert.equal(header, "data:image/webp;base64", asset.key)
    }
    // Same input, same names: a restart finds the already uploaded emoji.
    assert.deepEqual(
        (await applicationEmojiAssets()).map((a) => a.name),
        assets.map((a) => a.name)
    )
})

test("the Wardogs faction emoji keep the names the operator script uploaded", async () => {
    const factions = await factionAssets()
    assert.deepEqual(
        factions.map((f) => f.faction),
        ["valkyra", "manticore", "lonestar"]
    )
    for (const faction of factions) {
        const bytes = await readFile(
            new URL(
                `../../../public/stratmap/icons/wardogs/${faction.faction}.webp`,
                import.meta.url
            )
        )
        const digest = createHash("sha256")
            .update(bytes)
            .digest("hex")
            .slice(0, 8)
        assert.equal(faction.name, `logi_${faction.faction}_${digest}`)
    }
})

test("built-in map art is attached as a small, versioned copy with alt text", async () => {
    // Kursk's packaged art is above the old 8 MiB attachment cap.
    const thumb = await builtInMapImage(
        "hell_let_loose",
        "kursk",
        "thumb",
        "cs"
    )
    assert.ok(thumb)
    assert.match(thumb.name, /^mapa-kursk-thumb-[0-9a-f]{6}\.webp$/)
    assert.equal(thumb.description, "Mapa Kursk")
    assert.ok(thumb.bytes.byteLength < 200 * 1024)
    const meta = await sharp(thumb.bytes).metadata()
    assert.deepEqual([meta.width, meta.height], [320, 320])
    const banner = await builtInMapImage("wardogs", "zestafona", "banner", "en")
    assert.equal(banner?.description, "Map Zestafona")
    assert.deepEqual(
        [
            (await sharp(banner!.bytes).metadata()).width,
            (await sharp(banner!.bytes).metadata()).height,
        ],
        [1200, 400]
    )
    assert.equal(
        await builtInMapImage("hell_let_loose", "../secrets", "thumb"),
        null
    )
    assert.equal(await builtInMapImage("wardogs", "foy", "thumb"), null)
})
