import {
    emojiMarkup,
    provisionApplicationEmoji,
    provisionEmoji,
} from "./provision-emoji"
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

function fakeApplication(initial: { id: string; name: string }[] = []) {
    const emoji = [...initial]
    const created: string[] = []
    let lists = 0
    return {
        emoji,
        created,
        lists: () => lists,
        ports: {
            list: async () => {
                lists++
                return emoji.map((e) => ({ ...e }))
            },
            create: async (asset: {
                key: string
                name: string
                image: string
            }) => {
                if (asset.key === "broken")
                    throw new Error("Discord rejected it")
                const next = {
                    id: String(100 + emoji.length),
                    name: asset.name,
                }
                emoji.push(next)
                created.push(asset.name)
                return next
            },
        },
    }
}
const set = [
    {
        key: "us",
        name: "logi_us_aaaa1111",
        image: "data:image/png;base64,AA==",
    },
    {
        key: "live",
        name: "logi_live_bbbb2222",
        image: "data:image/png;base64,AA==",
    },
    {
        key: "valkyra",
        name: "logi_valkyra_cccc3333",
        image: "data:image/webp;base64,AA==",
    },
]

test("the bot uploads only missing signs; a second run uploads nothing", async () => {
    const app = fakeApplication([
        { id: "7", name: "logi_valkyra_cccc3333" },
        { id: "8", name: "server_owned" },
    ])
    const first = await provisionApplicationEmoji(set, app.ports)
    assert.deepEqual(first.created, ["us", "live"])
    assert.deepEqual(first.failed, [])
    assert.deepEqual(first.emoji.valkyra, {
        id: "7",
        name: "logi_valkyra_cccc3333",
    })
    const second = await provisionApplicationEmoji(set, app.ports)
    assert.deepEqual(second.created, [])
    assert.deepEqual(second.emoji, first.emoji)
    assert.deepEqual(app.created, ["logi_us_aaaa1111", "logi_live_bbbb2222"])
    // Nothing else in the application was touched.
    assert.ok(app.emoji.some((e) => e.name === "server_owned"))
    assert.equal(app.lists(), 2)
})

test("one failed upload is reported and does not block the rest", async () => {
    const app = fakeApplication()
    const report = await provisionApplicationEmoji(
        [{ key: "broken", name: "logi_broken_00000000", image: "x" }, ...set],
        app.ports
    )
    assert.deepEqual(report.failed, ["broken"])
    assert.deepEqual(report.created, ["us", "live", "valkyra"])
    assert.equal(report.emoji.broken, undefined)
})

test("a duplicate left by a race resolves to the oldest emoji", async () => {
    const app = fakeApplication([
        { id: "1234567890123456790", name: "logi_us_aaaa1111" },
        { id: "1234567890123456789", name: "logi_us_aaaa1111" },
    ])
    const report = await provisionApplicationEmoji(set.slice(0, 1), app.ports)
    assert.equal(report.emoji.us?.id, "1234567890123456789")
    assert.equal(
        emojiMarkup(report.emoji.us!),
        "<:logi_us_aaaa1111:1234567890123456789>"
    )
})
