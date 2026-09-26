import assert from "node:assert/strict"
import test from "node:test"

import { parseApiPageQuery } from "./page-query"

const options = { gameOwned: true, supportsUpdatedSince: true }

test("page query defaults to HLL and a bounded page", () => {
    assert.deepEqual(
        parseApiPageQuery(new Request("https://logi.test/api"), options),
        {
            limit: 25,
            cursor: null,
            sort: "createdAt",
            game: "hell_let_loose",
        }
    )
})

test("page query only accepts its documented stable sort", () => {
    assert.deepEqual(
        parseApiPageQuery(
            new Request("https://logi.test/api?sort=updatedAt"),
            options
        ),
        { error: "sort must be createdAt." }
    )
})

test("page query validates updatedSince only where the resource supports it", () => {
    assert.deepEqual(
        parseApiPageQuery(
            new Request(
                "https://logi.test/api?updatedSince=2026-01-02T03:04:05.000Z"
            ),
            options
        ),
        {
            limit: 25,
            cursor: null,
            sort: "createdAt",
            game: "hell_let_loose",
            updatedSince: "2026-01-02T03:04:05.000Z",
        }
    )
    assert.deepEqual(
        parseApiPageQuery(
            new Request("https://logi.test/api?updatedSince=not-a-date"),
            options
        ),
        { error: "updatedSince must be an ISO timestamp." }
    )
    assert.deepEqual(
        parseApiPageQuery(
            new Request("https://logi.test/api?updatedSince=2026-01-02"),
            options
        ),
        { error: "updatedSince must be an ISO timestamp." }
    )
    assert.deepEqual(
        parseApiPageQuery(
            new Request(
                "https://logi.test/api?updatedSince=2026-01-02T03:04:05.000Z"
            ),
            { gameOwned: true }
        ),
        { error: "updatedSince is not supported by this resource." }
    )
})

test("page query rejects unsupported limits and games", () => {
    assert.deepEqual(
        parseApiPageQuery(
            new Request("https://logi.test/api?limit=101"),
            options
        ),
        { error: "limit must be an integer between 1 and 100." }
    )
    assert.deepEqual(
        parseApiPageQuery(
            new Request("https://logi.test/api?game=nope"),
            options
        ),
        { error: "game must be a supported game ID or all." }
    )
})

test("page query accepts any explicit combination of supported games", () => {
    assert.deepEqual(
        parseApiPageQuery(
            new Request(
                "https://logi.test/api?game=hell_let_loose&game=wardogs"
            ),
            options
        ),
        {
            limit: 25,
            cursor: null,
            sort: "createdAt",
            game: ["hell_let_loose", "wardogs"],
        }
    )
})
