import { provisionEmoji } from "./provision-emoji"
import assert from "node:assert/strict"
import test from "node:test"
test("provisioning reuses hashed application assets and leaves unrelated emoji alone", async () => {
    const existing = [{ id: "other", name: "community" }]
    let creates = 0
    const ports = {
        list: async () => existing,
        create: async (asset: { name: string; image: string }) => {
            const emoji = { id: String(++creates), name: asset.name }
            existing.push(emoji)
            return emoji
        },
    }
    const assets = [
        {
            name: "logi_valkyra_digest",
            image: "data:image/webp;base64,cHVibGlj",
        },
    ]
    assert.deepEqual(
        await provisionEmoji(assets, ports),
        await provisionEmoji(assets, ports)
    )
    assert.equal(creates, 1)
    assert.equal(existing[0].name, "community")
})
