import { renderToStaticMarkup } from "react-dom/server"
import assert from "node:assert/strict"
import { createElement } from "react"
import test from "node:test"

import { GroupInlineIcons } from "./group-inline-icons"

test("a player without a primary group sees their sign-up group icon once", () => {
    const markup = renderToStaticMarkup(
        createElement(GroupInlineIcons, {
            assignment: {
                id: "assignment-1",
                userId: "user-1",
                serverId: "server-1",
                type: "member",
                status: "active",
                secondaryGroupIds: [],
                paused: false,
                createdAt: "2026-10-01T00:00:00.000Z",
                updatedAt: "2026-10-01T00:00:00.000Z",
            },
            groupsById: new Map([
                [
                    "infantry",
                    {
                        id: "infantry",
                        guildId: "server-1",
                        name: "Infantry",
                        color: "#6b7280",
                        order: 0,
                        createdAt: "2026-10-01T00:00:00.000Z",
                        updatedAt: "2026-10-01T00:00:00.000Z",
                    },
                ],
            ]),
            signupGroupName: "Infantry",
        })
    )

    assert.equal((markup.match(/title="Infantry"/g) ?? []).length, 1)
})

test("ranked signup preferences mark the displayed signup icon", () => {
    const markup = renderToStaticMarkup(
        createElement(GroupInlineIcons, {
            groupsById: new Map(),
            signupPreferences: ["Infantry", "Armour"],
        })
    )

    assert.match(markup, /aria-hidden="true"/)
    assert.match(markup, /aria-label="1\. Infantry, 2\. Armour"/)
})
