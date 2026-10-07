import { parseLeagueResults, RESULTS_PARSER_ID } from "./parse-results"
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

test("the captured Scheduled page has no placements and says results are unsupported", () => {
    const data = parseMatchHtml(html, source)
    assert.equal(data.results, null)
    assert.deepEqual(
        parseLeagueResults(load(html), {
            teams: data.teams,
            progress: data.progress,
            status: data.status,
        }),
        { results: null, warnings: ["results_not_supported"] }
    )
    assert.equal(RESULTS_PARSER_ID, "none/1")
})

test("a synthetic finished page still yields no invented placements", () => {
    // Real completed markup is unknown; this mutation is not evidence of it.
    const finished = html
        .replace("Scheduled", "Completed")
        .replace(
            "<span>Placements<span> (<!-- -->not started yet<!-- -->)</span>",
            "<span>Placements<span> (<!-- -->done<!-- -->)</span>"
        )
        .replace(
            "<span>Confirmed<span> (<!-- -->not started yet<!-- -->)</span>",
            "<span>Confirmed<span> (<!-- -->done<!-- -->)</span>"
        )
    const data = parseMatchHtml(finished, source)
    assert.equal(data.status, "Completed")
    assert.equal(
        data.progress?.find((step) => step.label === "Placements")?.state,
        "done"
    )
    assert.equal(data.results, null)
    assert.ok(data.warnings.includes("results_not_supported"))
})
