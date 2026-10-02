import { LeagueError } from "../../domain/wardogs-league/contracts"
import { fetchLeagueMatch } from "./fetch-match"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
const source = "https://wardogsleague.net/matches/cmuqt8ep605e1lf018w2nlywu"
const html = readFileSync(
    new URL("./fixtures/scheduled.html", import.meta.url),
    "utf8"
)
const ok = () =>
    new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
    })
test("anonymous GET is bounded and returns parsing provenance", async () => {
    const result = await fetchLeagueMatch(source, {
        now: () => 1_800_000_000_000,
        fetch: async (url, init) => {
            assert.equal(String(url), source)
            assert.equal(init?.method, "GET")
            assert.equal(init?.redirect, "manual")
            const headers = new Headers(init?.headers)
            assert.equal(headers.has("authorization"), false)
            assert.equal(headers.has("cookie"), false)
            assert.match(
                headers.get("user-agent")!,
                /Logi.*github.com\/Ninjonik\/logi/
            )
            return ok()
        },
    })
    assert.equal(result.fetchedAt, "2027-01-15T08:00:00.000Z")
    assert.equal(result.teams?.length, 3)
})
test("validate redirects before dispatch and do not switch match identity", async () => {
    for (const location of [
        "https://localhost/private",
        source.replace(".net", ".net.evil.test"),
        source.replace("cmuqt8ep605e1lf018w2nlywu", "another"),
        "/login",
    ]) {
        let calls = 0
        await assert.rejects(
            fetchLeagueMatch(source, {
                fetch: async () => {
                    calls++
                    return new Response(null, {
                        status: 302,
                        headers: { location },
                    })
                },
            }),
            (e: unknown) =>
                e instanceof LeagueError && e.code === "unsafe_redirect"
        )
        assert.equal(calls, 1)
    }
    let calls = 0
    const value = await fetchLeagueMatch(source, {
        fetch: async () =>
            ++calls === 1
                ? new Response(null, {
                      status: 308,
                      headers: { location: source + "/" },
                  })
                : ok(),
    })
    assert.equal(value.id, "cmuqt8ep605e1lf018w2nlywu")
    assert.equal(calls, 2)
})
test("429 accepts delta seconds and HTTP-date Retry-After", async () => {
    for (const [header, delay] of [
        ["120", 120000],
        ["Thu, 01 Jan 1970 00:03:00 GMT", 180000],
        ["invalid", 60000],
    ] as const) {
        await assert.rejects(
            fetchLeagueMatch(source, {
                now: () => 0,
                fetch: async () =>
                    new Response(null, {
                        status: 429,
                        headers: { "Retry-After": header },
                    }),
            }),
            (e: unknown) =>
                e instanceof LeagueError &&
                e.code === "rate_limited" &&
                e.retryAfterMs === delay
        )
    }
})
test("reject non-HTML, oversize streams, redirect loops and stalled reads", async () => {
    const cases: Array<[typeof fetch, string]> = [
        [
            async () =>
                new Response("{}", {
                    headers: { "content-type": "application/json" },
                }),
            "invalid_html",
        ],
        [
            async () =>
                new Response("x".repeat(2 * 1024 * 1024 + 1), {
                    headers: { "content-type": "text/html" },
                }),
            "too_large",
        ],
        [
            async () =>
                new Response(null, {
                    status: 302,
                    headers: { location: source },
                }),
            "unsafe_redirect",
        ],
        [
            async () =>
                new Response(new ReadableStream({ start() {} }), {
                    headers: { "content-type": "text/html" },
                }),
            "timeout",
        ],
        [async () => new Response(null, { status: 404 }), "http"],
    ]
    for (const [fetch, code] of cases)
        await assert.rejects(
            fetchLeagueMatch(source, { fetch, timeoutMs: 50 }),
            (e: unknown) => e instanceof LeagueError && e.code === code
        )
})
