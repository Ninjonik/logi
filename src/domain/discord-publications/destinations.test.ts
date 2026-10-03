import { invalidPublicationDestination } from "./destinations"
import assert from "node:assert/strict"
import test from "node:test"
test("server settings reject foreign and announcement private-thread parent IDs, including game overrides", () => {
    const channels = [
        { id: "text", type: 0 },
        { id: "announcement", type: 5 },
    ]
    assert.equal(
        invalidPublicationDestination(
            { announcementsChannelId: "announcement" },
            channels
        ),
        null
    )
    assert.equal(
        invalidPublicationDestination(
            { announcementsChannelId: "foreign" },
            channels
        )?.id,
        "foreign"
    )
    assert.equal(
        invalidPublicationDestination(
            {
                ticketSettings: {
                    enabled: true,
                    ticketParentChannelId: "announcement",
                },
            },
            channels
        )?.purpose,
        "private-thread"
    )
    assert.equal(
        invalidPublicationDestination(
            {
                gameOverrides: {
                    wardogs: {
                        membershipSettings: {
                            enabled: true,
                            applicationParentChannelId: "announcement",
                        },
                    },
                },
            },
            channels
        )?.purpose,
        "private-thread"
    )
    assert.equal(
        invalidPublicationDestination(
            {
                ticketSettings: {
                    enabled: false,
                    ticketParentChannelId: "deleted",
                },
            },
            channels
        ),
        null
    )
})
