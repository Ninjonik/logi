import assert from "node:assert/strict"
import test from "node:test"

import { userSettingsPatchSchema } from "./user-settings"

test("a single setting can be saved without the others", () => {
    assert.deepEqual(
        userSettingsPatchSchema.parse({
            matchRecapNotificationsEnabled: false,
        }),
        { matchRecapNotificationsEnabled: false }
    )
})

test("the profile card's full save is accepted and trimmed", () => {
    assert.deepEqual(
        userSettingsPatchSchema.parse({
            avatar: " https://cdn.discordapp.com/avatars/1/a.png ",
            platformIds: "76561198000000000",
            matchRecapNotificationsEnabled: true,
            defaultWorkspaceId: "",
        }),
        {
            avatar: "https://cdn.discordapp.com/avatars/1/a.png",
            platformIds: "76561198000000000",
            matchRecapNotificationsEnabled: true,
            defaultWorkspaceId: "",
        }
    )
})

test("blank avatars, unknown fields and wrong types are refused", () => {
    for (const body of [
        { avatar: "   " },
        { matchRecapNotificationsEnabled: "yes" },
        { defaultWorkspaceId: "guilds:abc" },
        { isStreamer: true },
    ])
        assert.equal(userSettingsPatchSchema.safeParse(body).success, false)
})
