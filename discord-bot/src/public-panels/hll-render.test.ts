import { hllLiveFixture } from "../../../src/infrastructure/testing/hll-live"
import { renderHllPanel, renderHllPlayers } from "./hll-render"
import assert from "node:assert/strict"
import test from "node:test"
const panel = {
    id: "panel",
    revision: 1,
    enabled: true,
    showLeaders: false,
    showPlayers: false,
}
test("HLL public player names require opt-in and public output excludes identifiers", () => {
    const data = hllLiveFixture()
    assert.equal(
        JSON.stringify(renderHllPanel(panel, data)).includes(
            "Synthetic Allied"
        ),
        false
    )
    const view = JSON.stringify(
        renderHllPanel(
            { ...panel, showLeaders: true, showPlayers: true },
            data,
            "attachment://map.webp"
        )
    )
    assert.match(view, /Synthetic Allied/)
    assert.match(view, /TOP 3/)
    assert.match(view, /51m 0s/)
    assert.doesNotMatch(view, /76561198|cash|playerId/)
    assert.match(view, /Players · private details/)
})
test("HLL private details preserve missing metrics and cannot mention or leak player IDs", () => {
    const data = hllLiveFixture()
    data.players[0].name = "@everyone <script>"
    const view = JSON.stringify(renderHllPlayers(panel, data, 999))
    assert.match(view, /Support —/)
    assert.match(view, /page 1\/1/)
    assert.doesNotMatch(view, /@everyone|<script>|76561198|cash/)
})
