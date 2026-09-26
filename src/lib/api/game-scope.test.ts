import assert from "node:assert/strict"
import test from "node:test"

import { isApiGameScopeError, parseApiGameScope } from "./game-scope"

test("the public API defaults an omitted game to Hell Let Loose", () => {
    assert.equal(
        parseApiGameScope(new Request("https://example.test/api/v1/clan")),
        "hell_let_loose"
    )
})

test("the public API accepts explicit games and all", () => {
    assert.equal(
        parseApiGameScope(
            new Request("https://example.test/api/v1/clan?game=wardogs")
        ),
        "wardogs"
    )
    assert.equal(
        parseApiGameScope(
            new Request("https://example.test/api/v1/clan?game=all")
        ),
        "all"
    )
})

test("the public API accepts repeated or comma-separated game selections", () => {
    assert.deepEqual(
        parseApiGameScope(
            new Request(
                "https://example.test/api/v1/clan?game=wardogs&game=hell_let_loose"
            )
        ),
        ["wardogs", "hell_let_loose"]
    )
    assert.deepEqual(
        parseApiGameScope(
            new Request(
                "https://example.test/api/v1/clan?game=wardogs,hell_let_loose_vietnam"
            )
        ),
        ["wardogs", "hell_let_loose_vietnam"]
    )
})

test("the public API rejects all combined with a specific game", () => {
    assert.equal(
        isApiGameScopeError(
            parseApiGameScope(
                new Request(
                    "https://example.test/api/v1/clan?game=all&game=wardogs"
                )
            )
        ),
        true
    )
})

test("the public API rejects an unsupported game", () => {
    assert.equal(
        isApiGameScopeError(
            parseApiGameScope(
                new Request("https://example.test/api/v1/clan?game=quake")
            )
        ),
        true
    )
})
