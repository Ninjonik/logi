import { parseMatchHtml } from "./parse-match"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { load } from "cheerio"
import test from "node:test"
const source = "https://wardogsleague.net/matches/cmuqt8ep605e1lf018w2nlywu"
const html = readFileSync(
    new URL("./fixtures/scheduled.html", import.meta.url),
    "utf8"
)
test("impossible calendar dates are missing data, never rolled into another day", () => {
    const changed = html
        .split("2026-10-10T18:30:00.000Z")
        .join("2026-02-30T18:30:00.000Z")
    assert.equal(parseMatchHtml(changed, source).scheduledAt, null)
})
test("captured scheduled fixture binds three detailed teams to their own factions", () => {
    const data = parseMatchHtml(html, source)
    assert.equal(data.fixtureNumber, 38)
    assert.equal(data.type, "Friendly")
    assert.equal(data.status, "Scheduled")
    assert.deepEqual(
        data.teams?.map((t) => [
            t.code,
            t.name,
            t.faction,
            t.displayedMemberCount,
            t.nations,
        ]),
        [
            ["VLK", "Valkyria", "Valkyra", 48, ["CZE", "SVK"]],
            ["ROG", "Team Rogue", "Manticore", 53, ["FRA"]],
            [
                "BAMC",
                "Batallón de Asalto, Maniobra y Combate",
                "Lonestar",
                123,
                ["ESP"],
            ],
        ]
    )
    assert.equal(data.scheduledAt, "2026-10-10T18:30:00.000Z")
    assert.equal(data.mapVote?.closesAt, "2026-10-03T10:19:33.154Z")
    assert.equal(data.mapVote?.status, "Open")
    assert.deepEqual(
        data.mapVote?.ballots?.map((b) => [b.teamCode, b.value]),
        [
            ["VLK", "Not voted"],
            ["ROG", "Not voted"],
            ["BAMC", "Not voted"],
        ]
    )
    assert.deepEqual(data.map, {
        name: "Zestafona",
        zone: "SmallFactory",
        lighting: "DayLateGrayFog",
    })
    assert.deepEqual(data.hosting, { mode: "Self-hosted", teamCode: "VLK" })
    assert.equal(data.moderator, "Awaiting")
    assert.equal(data.rules?.summary, "0 of 3 picked")
    assert.equal(data.rules?.choices?.[2].teamCode, "BAMC")
    assert.equal(data.rules?.choices?.[2].value, "Not picked yet")
    assert.equal(data.readyCheck, "Not started")
    assert.equal(
        data.progress?.find((s) => s.label === "Rules agreed")?.state,
        "current"
    )
    assert.equal(data.progress?.[0].state, "done")
    assert.equal(data.request?.number, 65)
    assert.equal(data.results, null)
    assert.equal(data.scoringRule, "1st 3 · 2nd 2 · 3rd 1")
    assert.deepEqual(data.warnings, ["results_not_supported"])
})
test("section and card order do not affect identity or time selection", () => {
    const $ = load(html)
    const lineup = $('section[aria-labelledby="lineup-title"]')
    lineup
        .find("ul > li")
        .toArray()
        .reverse()
        .forEach((el) => lineup.find("ul").append(el))
    $("main").prepend($('section[aria-labelledby="vote-title"]'))
    const data = parseMatchHtml($.html(), source)
    assert.equal(data.teams?.find((t) => t.code === "VLK")?.faction, "Valkyra")
    assert.equal(
        data.teams?.find((t) => t.code === "BAMC")?.faction,
        "Lonestar"
    )
    assert.equal(data.scheduledAt, "2026-10-10T18:30:00.000Z")
})
test("missing optional sections yield null and warnings, never guessed zeros", () => {
    const $ = load(html)
    $('section, ol[aria-label="Match progress"]').remove()
    const data = parseMatchHtml($.html(), source)
    for (const field of [
        "teams",
        "map",
        "hosting",
        "mapVote",
        "rules",
        "progress",
        "readyCheck",
    ] as const)
        assert.equal(data[field], null)
    assert.ok(data.warnings.includes("missing_lineup"))
    assert.ok(data.warnings.includes("missing_briefing"))
    assert.equal(data.scheduledAt, "2026-10-10T18:30:00.000Z")
})
test("invalid or conflicting match times never use vote time or relative labels", () => {
    const $ = load(html)
    $("header time").attr("datetime", "2026-10-11T18:30:00.000Z")
    const data = parseMatchHtml($.html(), source)
    assert.equal(data.scheduledAt, null)
    assert.ok(data.warnings.includes("conflicting_match_time"))
    $('header time, section[aria-labelledby="brief-title"] time').attr(
        "datetime",
        "in 8d"
    )
    assert.equal(parseMatchHtml($.html(), source).scheduledAt, null)
})
test("ignore scripts, login UI and private hosting details; unsupported states have no results", () => {
    const changed = html
        .replace("Scheduled", "Completed")
        .replace(
            "</main>",
            '<script>throw new Error("executed")</script><dialog><h1>Fake</h1></dialog></main>'
        )
        .replace(
            '<section id="where"',
            '<section data-secret="ignored" id="where"'
        )
        .replace(
            "Ask your team leader for the details.",
            "Password: secret-value Join ID: private-join"
        )
    const data = parseMatchHtml(changed, source)
    assert.equal(data.status, "Completed")
    assert.equal(data.results, null)
    assert.ok(data.warnings.includes("unverified_match_state"))
    assert.doesNotMatch(
        JSON.stringify(data),
        /secret-value|private-join|executed|Fake/
    )
})
test("unrecognized pages and ambiguous duplicate detailed teams fail parsing", () => {
    assert.throws(() => parseMatchHtml("<main><h1>Sign in</h1></main>", source))
    const $ = load(html)
    const card = $('section[aria-labelledby="lineup-title"] ul li').first()
    card.after(card.clone())
    assert.throws(() => parseMatchHtml($.html(), source))
})
