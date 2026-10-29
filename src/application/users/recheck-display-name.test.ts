import { recheckDisplayName } from "./recheck-display-name"
import assert from "node:assert/strict"
import test from "node:test"

const input = { guildId: "server", discordId: "123456789012345678" }
for (const [nick, globalName, expected] of [
    [" New nickname ", "Display", "New nickname"],
    [null, " Display ", "Display"],
    [" ", null, "username"],
] as const) {
    test(`refresh resolves ${expected}`, async () => {
        const result = await recheckDisplayName(input, {
            fetchMember: async (guildId, discordId) => {
                assert.equal(guildId, input.guildId)
                assert.equal(discordId, input.discordId)
                return {
                    nick,
                    user: {
                        id: discordId,
                        username: "username",
                        global_name: globalName,
                    },
                }
            },
            saveName: async (name) => {
                assert.equal(name, expected)
                return { changed: true }
            },
        })
        assert.deepEqual(result, { name: expected, changed: true })
    })
}
test("unchanged name is reported", async () => {
    assert.deepEqual(
        await recheckDisplayName(input, {
            fetchMember: async () => ({
                user: { id: input.discordId, username: "same" },
            }),
            saveName: async () => ({ changed: false }),
        }),
        { name: "same", changed: false }
    )
})
test("unlinked, unavailable and mismatched members never write", async () => {
    const saveName = async () => {
        assert.fail("must not write")
    }
    await assert.rejects(
        recheckDisplayName(
            { ...input, discordId: "imported-player" },
            {
                fetchMember: async () => {
                    assert.fail("must not fetch")
                },
                saveName,
            }
        )
    )
    await assert.rejects(
        recheckDisplayName(input, {
            fetchMember: async () => {
                throw new Error("Discord unavailable")
            },
            saveName,
        })
    )
    for (const member of [{}, { user: { id: "wrong", username: "other" } }]) {
        await assert.rejects(
            recheckDisplayName(input, {
                fetchMember: async () => member,
                saveName,
            })
        )
    }
})
