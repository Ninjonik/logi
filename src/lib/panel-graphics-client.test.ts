import {
    panelEmojiStatus,
    panelMapTiles,
} from "@/domain/discord-publications/panel-graphics-settings"
import { loadPanelGraphics, savePanelGraphics } from "./panel-graphics-client"
import assert from "node:assert/strict"
import test from "node:test"

const data = {
    revision: 2,
    settings: { defaultStyle: "a", servers: [], maps: [] },
    clanAccent: "#e8a33d",
    clanName: "Vlci",
    clanTag: "VLC",
    servers: [],
    maps: [],
    emoji: panelEmojiStatus(null),
    mapTiles: panelMapTiles([]),
}
function fetcher(
    status: number,
    body: unknown,
    seen: Array<[string, RequestInit | undefined]> = []
) {
    return (async (url: string, init?: RequestInit) => {
        seen.push([url, init])
        return Response.json(body, { status })
    }) as unknown as typeof fetch
}

test("loading reads the page data from the encoded same-origin route", async () => {
    const seen: Array<[string, RequestInit | undefined]> = []
    const result = await loadPanelGraphics("server/1", fetcher(200, data, seen))
    assert.equal(result.ok, true)
    assert.equal(seen[0]![0], "/api/servers/server%2F1/discord-panel-graphics")
    assert.deepEqual(
        await loadPanelGraphics("s", fetcher(403, { error: "forbidden" })),
        {
            ok: false,
            error: "forbidden",
        }
    )
    assert.deepEqual(
        await loadPanelGraphics("s", fetcher(200, { revision: "x" })),
        {
            ok: false,
            error: "unavailable",
        }
    )
})

test("saving sends the patch and maps every documented error", async () => {
    const seen: Array<[string, RequestInit | undefined]> = []
    assert.deepEqual(
        await savePanelGraphics(
            "s",
            { defaultStyle: "b" },
            fetcher(200, { ok: true, revision: 3 }, seen)
        ),
        { ok: true, revision: 3 }
    )
    assert.equal(seen[0]![1]?.method, "PATCH")
    assert.equal(seen[0]![1]?.body, JSON.stringify({ defaultStyle: "b" }))
    for (const error of [
        "conflict",
        "asset_unavailable",
        "unknown_server",
        "invalid_request",
    ])
        assert.deepEqual(
            await savePanelGraphics(
                "s",
                { defaultStyle: "b" },
                fetcher(400, { error })
            ),
            { ok: false, error }
        )
    assert.deepEqual(
        await savePanelGraphics("s", { defaultStyle: "b" }, fetcher(403, null)),
        { ok: false, error: "forbidden" }
    )
    assert.deepEqual(
        await savePanelGraphics("s", { defaultStyle: "b" }, (async () => {
            throw new Error("offline")
        }) as unknown as typeof fetch),
        { ok: false, error: "unavailable" }
    )
})
