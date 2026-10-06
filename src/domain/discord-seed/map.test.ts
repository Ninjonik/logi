import assert from "node:assert/strict"
import test from "node:test"

import { seedMapFacts } from "./map"

test("a layer that names mode and lighting gives the full line and the built-in picture", () => {
    assert.deepEqual(
        seedMapFacts(
            { gameId: "hell_let_loose", map: "foy_warfare_day" },
            "cs",
            "https://logi.app"
        ),
        {
            mapLine: "Foy · Warfare · Den",
            mapName: "Foy",
            thumbnail: {
                url: "https://logi.app/maps/foy.webp",
                description: "Foy",
            },
        }
    )
    assert.equal(
        seedMapFacts(
            { gameId: "hell_let_loose", map: "carentan_offensive_ger_night" },
            "en"
        ).mapLine,
        "Carentan · Offensive · Night"
    )
})

test("a map name alone (the CRCON snapshot) gives the name and the picture; the dashboard keeps the path relative", () => {
    assert.deepEqual(
        seedMapFacts({ gameId: "hell_let_loose", map: "Foy" }, "cs"),
        {
            mapLine: "Foy",
            mapName: "Foy",
            thumbnail: { url: "/maps/foy.webp", description: "Foy" },
        }
    )
    assert.deepEqual(
        seedMapFacts({ gameId: "wardogs", map: "Zestafona" }, "de").thumbnail,
        { url: "/maps/wardogs/zestafona.webp", description: "Zestafona" }
    )
})

test("an unknown map keeps its escaped name and has no picture; no map has nothing", () => {
    assert.deepEqual(
        seedMapFacts(
            { gameId: "hell_let_loose", map: "Nová_mapa" },
            "cs",
            "https://logi.app"
        ),
        { mapLine: "Nová\\_mapa", mapName: "Nová_mapa", thumbnail: null }
    )
    assert.deepEqual(
        seedMapFacts({ gameId: "hell_let_loose", map: "  " }, "cs"),
        { mapLine: null, mapName: null, thumbnail: null }
    )
    assert.deepEqual(seedMapFacts({ gameId: "wardogs", map: null }, "cs"), {
        mapLine: null,
        mapName: null,
        thumbnail: null,
    })
})

test("an unusable site URL never hands Discord a relative picture", () => {
    assert.equal(
        seedMapFacts(
            { gameId: "hell_let_loose", map: "Foy" },
            "cs",
            "not a url"
        ).thumbnail,
        null
    )
})
