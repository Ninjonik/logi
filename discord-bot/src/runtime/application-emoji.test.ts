import { createApplicationEmojiService } from "./application-emoji"
import type { PanelEmojiAsset } from "../public-panels/assets"
import { factionEmojiFromMarkup } from "./faction-emoji"
import assert from "node:assert/strict"
import test from "node:test"

const assets: PanelEmojiAsset[] = [
    {
        key: "allies",
        group: "faction",
        name: "logi_allies_11111111",
        image: "data:image/png;base64,AA==",
    },
    {
        key: "valkyra",
        group: "faction",
        name: "logi_valkyra_22222222",
        image: "data:image/webp;base64,AA==",
    },
    {
        key: "live",
        group: "status",
        name: "logi_live_33333333",
        image: "data:image/png;base64,AA==",
    },
]

function fake() {
    let now = 1_000_000
    const installed = [
        { id: "100000000000000001", name: "logi_valkyra_22222222" },
    ]
    const calls = { list: 0, create: [] as string[], reports: [] as unknown[] }
    let failCreate = false
    const service = createApplicationEmojiService({
        assets: async () => assets,
        list: async () => {
            calls.list++
            return installed.map((e) => ({ ...e }))
        },
        create: async (asset) => {
            if (failCreate) throw new Error("rate limited")
            const emoji = {
                id: `2000000000000000${10 + installed.length}`,
                name: asset.name,
            }
            installed.push(emoji)
            calls.create.push(asset.name)
            return emoji
        },
        report: async (report) => {
            calls.reports.push(report)
        },
        applicationId: () => "123456789012345678",
        now: () => now,
    })
    return {
        service,
        calls,
        advance: (ms: number) => (now += ms),
        failCreate: (value: boolean) => (failCreate = value),
    }
}

test("provisioning uploads the missing signs once and reports what is installed", async () => {
    const { service, calls } = fake()
    const markup = await service.emoji()
    assert.equal(markup.valkyra, "<:logi_valkyra_22222222:100000000000000001>")
    assert.match(markup.allies ?? "", /^<:logi_allies_11111111:\d+>$/)
    assert.deepEqual(calls.create, [
        "logi_allies_11111111",
        "logi_live_33333333",
    ])
    assert.deepEqual(calls.reports, [
        {
            applicationId: "123456789012345678",
            ready: ["allies", "valkyra", "live"],
            failed: [],
            checkedAt: 1_000_000,
        },
    ])
    // Fresh within the hour: no Discord call at all.
    await service.emoji()
    assert.equal(calls.list, 1)
})

test("an hour later it re-checks without uploading again", async () => {
    const { service, calls, advance } = fake()
    await service.emoji()
    advance(60 * 60 * 1000)
    await service.emoji()
    assert.equal(calls.list, 2)
    assert.equal(calls.create.length, 2)
})

test("failed uploads are reported; concurrent callers share one run", async () => {
    const { service, calls, failCreate } = fake()
    failCreate(true)
    const [a, b] = await Promise.all([service.emoji(), service.emoji()])
    assert.deepEqual(a, b)
    assert.equal(calls.list, 1)
    assert.deepEqual((calls.reports[0] as { failed: string[] }).failed, [
        "allies",
        "live",
    ])
    assert.deepEqual(Object.keys(a), ["valkyra"])
})

test("event messages get the generic side signs and the Wardogs icons", () => {
    assert.deepEqual(
        factionEmojiFromMarkup({
            allies: "<:a:1>",
            axis: "<:b:2>",
            us: "<:c:3>",
            valkyra: "<:d:4>",
            live: "<:e:5>",
        }),
        { allies: "<:a:1>", axis: "<:b:2>", valkyra: "<:d:4>" }
    )
})
