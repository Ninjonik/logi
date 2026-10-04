import type { APIButtonComponent, APIStringSelectComponent } from "discord.js"
import { buildReportPicker, buildReportEmbed } from "../player-reports"
import assert from "node:assert/strict"
import test from "node:test"
for (const count of [0, 1, 20, 21, 300])
    test(`report picker has unique Discord control IDs for ${count} observed players`, () => {
        const players = Array.from({ length: count }, (_, i) => ({
            name: `Synthetic ${i}`,
            playerId: null,
            team: null,
        }))
        const value = buildReportPicker("draft", {
            map: null,
            serverName: null,
            observedAt: null,
            players,
        })
        const components = value.components.flatMap<
            APIButtonComponent | APIStringSelectComponent
        >((r) => r.toJSON().components)
        const ids = components.map((c) =>
            "custom_id" in c ? c.custom_id : undefined
        )
        assert.equal(new Set(ids).size, ids.length)
        const select = components[0]
        assert.ok("options" in select)
        assert.ok(select.options.length <= 21)
        assert.equal(select.options.at(-1)?.value, "-1")
    })

test("report embeds bound escaped text after escaping and omit internal connection IDs", () => {
    const embed = buildReportEmbed(
        {
            marker: "report-synthetic",
            createdAt: Date.now(),
            contextJson: JSON.stringify({
                gameId: "hell_let_loose",
                connectionId: "internal-connection",
                serverName: "Synthetic",
                map: "Utah",
                observedAt: null,
                player: {
                    name: "Synthetic",
                    playerId: null,
                    team: null,
                    provenance: "manual_unverified",
                },
                reason: "*".repeat(1000),
                incident: "now",
                evidence: "https://example.com/" + "_".repeat(970),
            }),
        },
        "111111111111111111"
    ).toJSON()
    assert.ok(embed.fields?.every((field) => field.value.length <= 1024))
    assert.equal(JSON.stringify(embed).includes("internal-connection"), false)
})
