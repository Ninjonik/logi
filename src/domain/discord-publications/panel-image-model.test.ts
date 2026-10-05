import {
    formatPanelNumber,
    hllLeaderNation,
    panelBannerImageAlt,
    panelImageRequestHash,
    panelImageRequestSchema,
    panelImageText,
    panelScoreImageAlt,
    panelScoreImageSchema,
} from "./panel-image-model"
import { czechFrom, panelImageCopy, panelStateText } from "./panel-image-copy"
import { hllSample, wardogsSample } from "./panel-image-samples"
import assert from "node:assert/strict"
import test from "node:test"

test("the board samples validate and their alt text matches the board", () => {
    assert.equal(panelScoreImageSchema.safeParse(hllSample).success, true)
    assert.equal(panelScoreImageSchema.safeParse(wardogsSample).success, true)
    assert.equal(
        panelScoreImageAlt(hllSample),
        "Obrázek skóre: Vlci #1 · Public, Foy, Warfare, Den, živě, zbývá 47 minut, 78 ze 100 hráčů a fronta 3, Spojenci 3 : 2 Osa, nejvíc zabití Rex_CZ 31, Hans_88 28, Bizon 27."
    )
    assert.equal(
        panelScoreImageAlt(wardogsSample),
        "Obrázek skóre: Vlci WD, Zestafona, živě, 17 z 98 hráčů, Valkyra 23, Manticore 12, Lonestar 7 bodů."
    )
    assert.equal(
        panelScoreImageAlt({ ...hllSample, language: "en" }),
        "Score image: Vlci #1 · Public, Foy, Warfare, Day, live, 47 minutes left, 78 of 100 players and queue 3, Allies 3 : 2 Axis, most kills Rex_CZ 31, Hans_88 28, Bizon 27."
    )
})

test("optional facts are left out of the alt text when the server does not report them", () => {
    const quiet = {
        ...hllSample,
        lighting: null,
        timeLeftSeconds: null,
        nextMap: null,
        mode: null,
        players: { count: 78, capacity: 100, queue: null },
        leaders: [],
        allies: { nation: "allies" as const, score: null },
        axis: { nation: "axis" as const, score: null },
    }
    assert.equal(panelScoreImageSchema.safeParse(quiet).success, true)
    assert.equal(
        panelScoreImageAlt(quiet),
        "Obrázek skóre: Vlci #1 · Public, Foy, živě, 78 ze 100 hráčů."
    )
})

test("the model rejects secrets, provider URLs, control characters and wrong nations", () => {
    const invalid = (value: unknown) =>
        assert.equal(panelScoreImageSchema.safeParse(value).success, false)
    invalid({ ...hllSample, password: "hunter2" })
    invalid({ ...hllSample, serverName: "Vlci\u0000" })
    invalid({ ...hllSample, serverName: " padded " })
    invalid({ ...hllSample, background: { kind: "url", url: "https://evil" } })
    invalid({
        ...hllSample,
        background: {
            kind: "builtin",
            game: "hell_let_loose",
            mapKey: "../etc",
        },
    })
    invalid({
        ...hllSample,
        background: { kind: "asset", publicId: "x", crop: "center" },
    })
    invalid({ ...hllSample, timeZone: "Mars/Olympus" })
    invalid({ ...hllSample, accentColor: "orange" })
    invalid({ ...hllSample, allies: { nation: "ger", score: 3 } })
    invalid({
        ...hllSample,
        leaders: [...hllSample.leaders, hllSample.leaders[0]],
    })
    invalid({ ...wardogsSample, joinCode: "WD 7F3K <@1>" })
    invalid({
        ...wardogsSample,
        factions: [
            { faction: "valkyra", points: 1 },
            { faction: "valkyra", points: 2 },
        ],
    })
    invalid({ ...hllSample, game: "wardogs" })
    assert.equal(
        panelImageRequestSchema.safeParse({ kind: "score", model: hllSample })
            .success,
        true
    )
    assert.equal(
        panelImageRequestSchema.safeParse({ kind: "other", model: hllSample })
            .success,
        false
    )
})

test("provider text is cleaned for the model", () => {
    assert.equal(panelImageText("  Rex\u0000_CZ\n "), "Rex _CZ")
    assert.equal(panelImageText(""), null)
    assert.equal(panelImageText(null), null)
    assert.equal(panelImageText("x".repeat(80), 32)?.length, 32)
})

test("the request hash ignores the time stamp but not the content", () => {
    const request = { kind: "score" as const, model: hllSample }
    assert.equal(
        panelImageRequestHash(request),
        panelImageRequestHash({
            ...request,
            model: { ...hllSample, renderedAt: "2026-10-05T18:42:12.000Z" },
        })
    )
    assert.notEqual(
        panelImageRequestHash(request),
        panelImageRequestHash({
            ...request,
            model: { ...hllSample, allies: { nation: "us", score: 4 } },
        })
    )
})

test("leaders carry their side's nation; numbers are grouped in the clan language", () => {
    assert.equal(hllLeaderNation(hllSample, "axis"), "ger")
    assert.equal(hllLeaderNation(hllSample, null), null)
    assert.equal(formatPanelNumber(3655, "cs"), "3 655")
    assert.equal(formatPanelNumber(3655, "en"), "3,655")
    assert.equal(
        panelBannerImageAlt({
            version: 1,
            language: "cs",
            accentColor: "#e8a33d",
            clanTag: "VLK",
            clanName: "Vlci",
            subtitle: "Server #1 · Public · Hell Let Loose",
            background: null,
        }),
        "Banner serveru Vlci · Server #1 · Public · Hell Let Loose"
    )
})

test("Czech uses 'ze' before numbers spoken with s/z/š/č or a cluster", () => {
    assert.equal(czechFrom(100), "ze")
    assert.equal(czechFrom(98), "z")
    assert.equal(czechFrom(64), "ze")
    assert.equal(czechFrom(50), "z")
    assert.equal(czechFrom(40), "ze")
    assert.equal(czechFrom(7), "ze")
    assert.equal(czechFrom(8), "z")
})

test("all image languages define the same copy", () => {
    const keys = (value: object): string[] =>
        Object.entries(value).flatMap(([key, v]) =>
            v && typeof v === "object"
                ? keys(v).map((k) => `${key}.${k}`)
                : [key]
        )
    const cs = keys(panelImageCopy("cs")).sort()
    assert.deepEqual(keys(panelImageCopy("en")).sort(), cs)
    assert.deepEqual(keys(panelImageCopy("de")).sort(), cs)
    assert.equal(panelImageCopy("cs").players(78, 100), "78 / 100 hráčů")
    assert.equal(panelImageCopy("cs").timeLeft(47), "zbývá 47 min")
    assert.equal(
        panelImageCopy("cs").gauge(78, 100, { queue: 3 }),
        "78 / 100 · fronta 3"
    )
    assert.equal(
        panelImageCopy("cs").gauge(12, 100, { seedTarget: 40 }),
        "12 / 100 · seed do 40"
    )
    assert.equal(panelImageCopy("cs").gauge(9, 98, { queue: 0 }), "9 / 98")
    assert.equal(
        panelImageCopy("de").gauge(9, 98, { queue: 2 }),
        "9 / 98 · Warteschlange 2"
    )
    assert.equal(panelImageCopy("cs").joinCode("WD-7F3K"), "join kód WD-7F3K")
    assert.equal(
        panelImageCopy("cs").topCashNow("Hráč 1", "3 655"),
        "nejvíc peněz teď: Hráč 1 · 3 655"
    )
})

test("a status icon always comes with its word", () => {
    assert.equal(
        panelStateText("live", "cs", "<:logi_live_1:2>"),
        "<:logi_live_1:2> Živě"
    )
    assert.equal(panelStateText("seeding", "cs"), "Seedujeme")
    assert.equal(panelStateText("empty", "en", null), "Empty")
    assert.equal(panelStateText("offline", "de"), "Nicht erreichbar")
})
