import assert from "node:assert/strict"
import test from "node:test"

import {
    getNamedCollection,
    isCollectionQueryError,
    parseCollectionQuery,
} from "./collection-query"

test("parseCollectionQuery accepts first and second-level filters", () => {
    const query = parseCollectionQuery(
        new Request(
            "https://example.test?filter[status]=published&filter[score.axis]=3&offset=5&limit=10"
        )
    )
    assert.equal(isCollectionQueryError(query), false)
    if (!isCollectionQueryError(query))
        assert.deepEqual(query, {
            filters: [
                { path: "status", value: "published" },
                { path: "score.axis", value: "3" },
            ],
            offset: 5,
            limit: 10,
        })
})

test("parseCollectionQuery rejects deeper paths and excessive limits", () => {
    assert.equal(
        isCollectionQueryError(
            parseCollectionQuery(
                new Request("https://example.test?filter[a.b.c]=x")
            )
        ),
        true
    )
    assert.equal(
        isCollectionQueryError(
            parseCollectionQuery(new Request("https://example.test?limit=101"))
        ),
        true
    )
})

test("getNamedCollection only follows the explicitly supplied path", () => {
    assert.deepEqual(
        getNamedCollection({ raw: { player_stats: [{ kills: 4 }] } }, [
            "raw",
            "player_stats",
        ]),
        [{ kills: 4 }]
    )
    assert.equal(
        getNamedCollection({ raw: { player_stats: [{ kills: 4 }] } }, [
            "raw",
            "missing",
        ]),
        null
    )
})
