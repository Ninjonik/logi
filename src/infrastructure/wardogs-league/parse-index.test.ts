import { parseLeagueIndex } from "./parse-index"
import { fetchLeagueIndex } from "./fetch-match"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
const url = "https://wardogsleague.net/matches?tab=fixtures"
const html = `<nav><a href="/matches/outside">outside</a></nav><main><h1>Find your next match</h1><a href="/matches?tab=fixtures">Fixtures</a><a href="/matches?tab=results">Results</a><a href="/matches/one">Match #1</a><a href="/matches/one/">Duplicate</a><a href="/matches/requests/no">Request</a><a href="https://evil.test/matches/no">wrong host</a></main>`
test("index reads only main-content match details and rejects unrecognized HTML", () => {
    assert.deepEqual(parseLeagueIndex(html, url), {
        matchUrls: ["https://wardogsleague.net/matches/one"],
        incomplete: false,
    })
    assert.throws(() => parseLeagueIndex("<main><h1>Sign in</h1></main>", url))
    assert.equal(
        parseLeagueIndex(
            html.replace(
                "</main>",
                '<a rel="next" href="/matches?tab=fixtures&page=2">Next</a></main>'
            ),
            url
        ).incomplete,
        true
    )
})
test("real site navigation retains structural tab evidence but contributes no match links", () => {
    const actual = readFileSync(
        new URL("./fixtures/index-fixtures.html", import.meta.url),
        "utf8"
    )
    assert.deepEqual(parseLeagueIndex(actual, url), {
        matchUrls: ["https://wardogsleague.net/matches/one"],
        incomplete: false,
    })
})
test("index fetch retains the query and rejects switching tabs on redirect", async () => {
    const data = await fetchLeagueIndex(url, {
        fetch: async (input) => {
            assert.equal(String(input), url)
            return new Response(html, {
                headers: { "content-type": "text/html" },
            })
        },
    })
    assert.equal(data.matchUrls.length, 1)
    await assert.rejects(
        fetchLeagueIndex(url, {
            fetch: async () =>
                new Response(null, {
                    status: 302,
                    headers: { location: "/matches?tab=results" },
                }),
        }),
        /unsafe_redirect/
    )
})

test("button pagination never claims complete coverage", () => {
    assert.equal(
        parseLeagueIndex(
            html.replace(
                "</main>",
                '<button aria-label="Load more matches">Load more</button></main>'
            ),
            url
        ).incomplete,
        true
    )
})
test("an unverified empty shell never claims complete coverage", () => {
    const shell =
        '<main><h1>Find your next match</h1><a href="/matches?tab=fixtures">Fixtures</a><a href="/matches?tab=results">Results</a></main>'
    assert.throws(() => parseLeagueIndex(shell, url), /invalid_html/)
})
