import assert from "node:assert/strict"
import test from "node:test"

import { boardEvent } from "./events/board-example.fixture"
import { generateCalendarUrl } from "./utils"

test("the calendar panel's link runs from the meeting to the end without the old fillers (L1-143)", () => {
    const event = boardEvent({
        description: "Tanky drží střed.\nMikrofon povinný.",
        server: "VLK Scrim",
        meetingChannelId: "444444444444444444",
    })
    const url = new URL(generateCalendarUrl(event, "cs"))
    assert.equal(url.searchParams.get("text"), "VLK vs ROG")
    assert.equal(
        url.searchParams.get("dates"),
        "20261011T173000Z/20261011T200000Z"
    )
    assert.equal(
        url.searchParams.get("details"),
        "Tanky drží střed. Mikrofon povinný."
    )
    assert.equal(url.searchParams.get("location"), "Discord")
    assert.doesNotMatch(url.toString(), /444444444444444444|VLK%20Scrim/)

    const bare = new URL(
        generateCalendarUrl(boardEvent({ description: undefined }), "cs")
    )
    assert.equal(bare.searchParams.has("details"), false)
    assert.doesNotMatch(
        decodeURIComponent(bare.toString()),
        /Briefing k operaci/
    )
})
