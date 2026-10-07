import assert from "node:assert/strict"
import test from "node:test"

import {
    platformChannelsQuerySchema,
    platformSettingsInputSchema,
} from "@/lib/validation/platform-settings"

const guild = "123456789012345678"
const channel = "223456789012345678"

test("accepts a workspace with or without a status channel", () => {
    assert.deepEqual(
        platformSettingsInputSchema.parse({
            workspaceGuildId: guild,
            statusChannelId: channel,
        }),
        { workspaceGuildId: guild, statusChannelId: channel }
    )
    assert.deepEqual(
        platformSettingsInputSchema.parse({
            workspaceGuildId: guild,
            statusChannelId: "",
        }),
        { workspaceGuildId: guild, statusChannelId: "" }
    )
    assert.deepEqual(
        platformSettingsInputSchema.parse({ workspaceGuildId: ` ${guild} ` }),
        { workspaceGuildId: guild }
    )
})

test("rejects missing, malformed and unknown fields", () => {
    for (const body of [
        {},
        { workspaceGuildId: "" },
        { workspaceGuildId: "general" },
        { workspaceGuildId: guild, statusChannelId: "#status" },
        { workspaceGuildId: guild, statusChannelId: 42 },
        { workspaceGuildId: guild, extra: true },
    ])
        assert.equal(platformSettingsInputSchema.safeParse(body).success, false)
})

test("the channel listing needs one Discord server ID", () => {
    assert.equal(
        platformChannelsQuerySchema.safeParse({ guildId: guild }).success,
        true
    )
    assert.equal(
        platformChannelsQuerySchema.safeParse({ guildId: "abc" }).success,
        false
    )
})
