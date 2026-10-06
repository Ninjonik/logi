import { MessageFlags } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

import {
    buildReportPicker,
    buildReportThreadMessage,
    reportFailureOf,
    reportModal,
    reportThreadTitle,
} from "../player-reports"
import { reportSubmissionSchema } from "../../../src/domain/player-reports/report"

type Json = Record<string, unknown>
const json = (value: unknown): Json =>
    JSON.parse(
        JSON.stringify(value, (_key, item) =>
            item && typeof item === "object" && "toJSON" in item
                ? (item as { toJSON(): unknown }).toJSON()
                : item
        )
    ) as Json

/** Every node of a component tree, depth first. */
function nodes(value: unknown): Json[] {
    if (!value || typeof value !== "object") return []
    if (Array.isArray(value)) return value.flatMap(nodes)
    const record = value as Json
    return [record, ...nodes(record.components), ...nodes(record.accessory)]
}

const texts = (value: unknown) =>
    nodes(value)
        .map((node) => node.content)
        .filter((content): content is string => typeof content === "string")

for (const count of [0, 1, 20, 21, 300])
    test(`the report picker keeps unique control IDs for ${count} observed players`, () => {
        const players = Array.from({ length: count }, (_, i) => ({
            name: `Synthetic ${i}`,
            playerId: null,
            team: i % 2 ? "axis" : "allies",
        }))
        const payload = json(
            buildReportPicker("draft", {
                map: null,
                serverName: "Vlci #1",
                observedAt: null,
                players,
            })
        )
        assert.equal(payload.flags, MessageFlags.IsComponentsV2)
        const all = nodes(payload.components)
        const ids = all
            .map((node) => node.custom_id)
            .filter((id): id is string => typeof id === "string")
        assert.equal(new Set(ids).size, ids.length)
        const select = all.find((node) => Array.isArray(node.options))
        assert.ok(select)
        const options = select.options as Array<{ value: string }>
        assert.ok(options.length <= 21)
        assert.equal(options.at(-1)?.value, "-1")
        assert.equal(
            ids.some((id) => id.startsWith("report:page:draft:")),
            count > 20
        )
    })

test("the picker is private copy in the clan language with sides", () => {
    const payload = json(
        buildReportPicker(
            "draft",
            {
                map: "Foy",
                serverName: "Vlci #1",
                observedAt: "2026-10-05T18:00:00.000Z",
                players: [{ name: "Hans_88", playerId: null, team: "axis" }],
            },
            0,
            "cs"
        )
    )
    const all = texts(payload.components).join("\n")
    assert.match(all, /Koho chceš nahlásit\?/)
    const select = nodes(payload.components).find((node) =>
        Array.isArray(node.options)
    )
    const first = (select?.options as Array<Json>)[0]
    assert.equal(first?.label, "Hans_88")
    assert.match(String(first?.description), /Osa/)
})

test("later picker pages keep their absolute player indices", () => {
    const players = Array.from({ length: 45 }, (_, i) => ({
        name: `Player ${i}`,
        playerId: null,
        team: null,
    }))
    const payload = json(
        buildReportPicker(
            "draft",
            { map: null, serverName: null, observedAt: null, players },
            2
        )
    )
    const select = nodes(payload.components).find((node) =>
        Array.isArray(node.options)
    )
    const values = (select?.options as Array<{ value: string }>).map(
        (option) => option.value
    )
    assert.deepEqual(values, ["40", "41", "42", "43", "44", "-1"])
})

test("the report form names the player and stays within Discord's title limit", () => {
    const modal = reportModal("draft", 3, "x".repeat(80), "cs").toJSON()
    assert.equal(modal.custom_id, "report:submit:draft:3")
    assert.ok(modal.title.length <= 45)
    const fields = modal.components.flatMap((row) =>
        "components" in row ? row.components : []
    )
    assert.deepEqual(
        fields.map((field) => ("custom_id" in field ? field.custom_id : "")),
        ["reason", "incident", "evidence"]
    )
    const other = reportModal("draft", -1, null, "cs").toJSON()
    const otherFields = other.components.flatMap((row) =>
        "components" in row ? row.components : []
    )
    assert.equal(
        "custom_id" in otherFields[0]! ? otherFields[0].custom_id : "",
        "player"
    )
})

const claim = {
    marker: "report-synthetic",
    createdAt: Date.parse("2026-10-05T18:00:00.000Z"),
    reportNumber: 17,
    contextJson: JSON.stringify({
        gameId: "hell_let_loose",
        connectionId: "internal-connection",
        serverName: "Synthetic",
        map: "Utah",
        observedAt: "2026-10-05T17:58:00.000Z",
        player: {
            name: "Hans_88",
            playerId: "76561190000000000",
            team: "axis",
            provenance: "observed",
        },
        reason: "*".repeat(1000),
        incident: "now",
        evidence: "https://example.com/" + "_".repeat(970),
    }),
}

test("the thread card pings the staff roles once and hides internal IDs", () => {
    const message = json(
        buildReportThreadMessage(claim, "111111111111111111", {
            language: "cs",
            staffRoleIds: ["222222222222222222"],
            serverTitle: "Vlci #1",
        })
    )
    assert.equal(message.flags, MessageFlags.IsComponentsV2)
    assert.deepEqual(message.allowedMentions, {
        parse: [],
        roles: ["222222222222222222"],
    })
    const all = texts(message.components)
    assert.equal(all[0], "<@&222222222222222222>")
    const body = all.join("\n")
    assert.match(body, /Hans\\_88 · Osa/)
    assert.match(body, /<@111111111111111111>/)
    // Discord renders the observation time; it is not escaped as text.
    assert.match(body, /<t:\d+:f>/)
    assert.doesNotMatch(body, /\\<t:/)
    assert.equal(JSON.stringify(message).includes("internal-connection"), false)
    // The card carries the invisible marker for recovering an uncertain send.
    const card = (message.components as Json[])[1]
    assert.equal(typeof card?.id, "number")
    for (const text of all) assert.ok(text.length <= 4000)
})

test("the thread is named Hlášení #N · player; older reports keep their marker", () => {
    assert.equal(reportThreadTitle(claim, "cs"), "Hlášení #17 · Hans_88")
    assert.equal(
        reportThreadTitle({ ...claim, reportNumber: null }, "cs"),
        "report-synthetic"
    )
})

test("each report failure maps to its own sentence key", () => {
    assert.equal(
        reportFailureOf(new Error("Three reports are already open.")),
        "limit"
    )
    assert.equal(reportFailureOf(new Error("Wait one minute.")), "wait")
    assert.equal(
        reportFailureOf(new Error("Report panel changed; reopen.")),
        "expired"
    )
    const invalid = reportSubmissionSchema.safeParse({
        choice: 0,
        reason: "short",
    })
    assert.equal(invalid.success, false)
    assert.equal(reportFailureOf(invalid.error), "reason")
    assert.equal(reportFailureOf(new Error("internal detail")), "unavailable")
})

test("the picker carries the clan's own colour (L3-58)", () => {
    const payload = json(
        buildReportPicker(
            "draft",
            { map: null, serverName: "Vlci #1", observedAt: null, players: [] },
            0,
            "cs",
            { accentColor: "#4F9DE0" }
        )
    )
    const [container] = payload.components as Json[]
    assert.equal(container?.accent_color, 0x4f9de0)
})
