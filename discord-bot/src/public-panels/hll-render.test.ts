import { panelPresentationSchema } from "../../../src/domain/discord-publications/panel-presentation"
import { hllLiveFixture } from "../../../src/infrastructure/testing/hll-live"
import { renderHllPanel, renderHllPlayers } from "./hll-render"
import assert from "node:assert/strict"
import test from "node:test"
const panel = {
    id: "panel",
    revision: 1,
    enabled: true,
    showLeaders: false,
    showPlayers: false,
}
test("HLL public player names require opt-in and public output excludes identifiers", () => {
    const data = hllLiveFixture()
    assert.equal(
        JSON.stringify(renderHllPanel(panel, data)).includes(
            "Synthetic Allied"
        ),
        false
    )
    const view = JSON.stringify(
        renderHllPanel(
            { ...panel, showLeaders: true, showPlayers: true },
            data,
            "attachment://map.webp"
        )
    )
    assert.match(view, /Synthetic Allied/)
    assert.match(view, /TOP 3/)
    assert.match(view, /51m 0s/)
    assert.doesNotMatch(view, /76561198|cash|playerId/)
    assert.match(view, /Players · private details/)
})
test("HLL private details preserve missing metrics and cannot mention or leak player IDs", () => {
    const data = hllLiveFixture()
    data.players[0].name = "@everyone <script>"
    const view = JSON.stringify(renderHllPlayers(panel, data, 999))
    assert.match(view, /Support —/)
    assert.match(view, /page 1\/1/)
    assert.doesNotMatch(view, /@everyone|<script>|76561198|cash/)
})

const parsed = (value: unknown) =>
    JSON.parse(JSON.stringify(value)) as {
        components: {
            accent_color: number
            components: { type: number; content?: string }[]
        }[]
    }
const allTexts = (value: unknown) => {
    const found: string[] = []
    const walk = (node: unknown) => {
        if (!node || typeof node !== "object") return
        if ("type" in node && node.type === 10 && "content" in node)
            found.push(String(node.content))
        Object.values(node).forEach(walk)
    }
    walk(JSON.parse(JSON.stringify(value)))
    return found
}
test("HLL legacy panels render exactly like the defaulted appearance and show no team emoji", () => {
    const data = hllLiveFixture()
    const full = { ...panel, showLeaders: true, showPlayers: true }
    const legacy = renderHllPanel(full, data, "attachment://map.webp")
    assert.equal(
        JSON.stringify(
            renderHllPanel(
                { ...full, presentation: panelPresentationSchema.parse({}) },
                data,
                "attachment://map.webp"
            )
        ),
        JSON.stringify(legacy)
    )
    assert.equal(parsed(legacy).components[0].accent_color, 0x77b255)
    assert.match(allTexts(legacy).join("\n"), /\n\*\*Allies · 3\*\*/)
    assert.equal(
        JSON.stringify(
            renderHllPlayers(
                { ...panel, presentation: panelPresentationSchema.parse({}) },
                data,
                0
            )
        ),
        JSON.stringify(renderHllPlayers(panel, data, 0))
    )
})
test("HLL appearance applies team emoji, accent, banner and layout toggles", () => {
    const data = hllLiveFixture()
    const presentation = panelPresentationSchema.parse({
        accentColor: "#123456",
        bannerAssetId: "imageAssets:1",
        bannerUrl:
            "https://logi.example/api/image-assets/0123456789abcdef0123456789abcdef.webp",
        factionEmoji: { allies: "🇺🇸", axis: "<:axis:123456789012345678>" },
    })
    const view = renderHllPanel(
        { ...panel, showLeaders: true, presentation },
        data,
        "attachment://map.webp"
    )
    const box = parsed(view).components[0]
    assert.equal(box.accent_color, 0x123456)
    assert.equal(box.components[0].type, 12)
    assert.ok(!JSON.stringify(view).includes("attachment://"))
    const text = allTexts(view).join("\n")
    assert.match(text, /🇺🇸 \*\*Allies · 3\*\*/)
    assert.match(text, /<:axis:123456789012345678> \*\*Axis · 2\*\*/)
    assert.match(text, /kills · 🇺🇸 Allies/)
    assert.equal(
        JSON.parse(
            JSON.stringify(
                renderHllPlayers({ ...panel, presentation }, data, 0)
            )
        ).embeds[0].color,
        0x123456
    )
    const compact = renderHllPanel(
        {
            ...panel,
            presentation: panelPresentationSchema.parse({
                layout: {
                    compact: true,
                    showPlayerCount: false,
                    showMap: false,
                },
            }),
        },
        data,
        "attachment://map.webp"
    )
    const [header, scores] = allTexts(compact)
    assert.equal(
        header,
        "**HELL LET LOOSE · PR158 TEST · HLL synthetic**\n-# fresh · current round · ⏱ **51m 0s** remaining"
    )
    assert.match(scores, /\*\*Allies · 3\*\* {2}· {2}\*\*Axis · 2\*\*/)
    assert.ok(!JSON.stringify(compact).includes("attachment://"))
    assert.ok(
        !parsed(compact).components[0].components.some((c) => c.type === 14)
    )
    const hidden = allTexts(
        renderHllPanel(
            {
                ...panel,
                presentation: panelPresentationSchema.parse({
                    layout: { showScoreboard: false },
                }),
            },
            data
        )
    ).join("\n")
    assert.ok(!hidden.includes("TEAM SCORE"))
    assert.match(hidden, /👥 \*\*2 \/ 100\*\* players/)
})
