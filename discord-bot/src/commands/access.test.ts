import assert from "node:assert/strict"
import test from "node:test"

import { PermissionFlagsBits } from "discord.js"

import {
    callerOf,
    configsOf,
    fakeInteraction,
    testGuildConfig,
    TEST_USER,
} from "./fake-interaction"
import {
    checkCommandAccess,
    readFreshCaller,
    type AccessInteraction,
    type FreshGuild,
} from "./access"

function freshGuild(options: {
    roles?: string[]
    administrator?: boolean
    owner?: string
    fail?: boolean
}) {
    const reads: string[] = []
    const guild: FreshGuild = {
        fetch: async () => {
            reads.push("guild")
            if (options.fail) throw new Error("Discord did not answer")
            return {
                ownerId: options.owner ?? "999999999999999999",
                roles: {
                    fetch: async () => {
                        reads.push("roles")
                    },
                },
                members: {
                    fetch: async (request) => {
                        assert.equal(request.force, true, "never from cache")
                        reads.push("member")
                        return {
                            permissions: {
                                has: (permission: bigint) =>
                                    Boolean(options.administrator) &&
                                    permission ===
                                        PermissionFlagsBits.Administrator,
                            },
                            roles: {
                                cache: new Map(
                                    (options.roles ?? []).map((role) => [
                                        role,
                                        {},
                                    ])
                                ),
                            },
                        }
                    },
                },
            }
        },
    }
    return { guild, reads }
}

test("the caller is read freshly: guild, role definitions and the member (M1-B04)", async () => {
    const { guild, reads } = freshGuild({ roles: ["100000000000000001"] })
    assert.deepEqual(await readFreshCaller(guild, TEST_USER), {
        isAdministrator: false,
        roleIds: ["100000000000000001"],
    })
    assert.deepEqual(reads, ["guild", "roles", "member"])
    assert.equal(
        (
            await readFreshCaller(
                freshGuild({ owner: TEST_USER }).guild,
                TEST_USER
            )
        )?.isAdministrator,
        true,
        "the server owner counts as an Administrator"
    )
    assert.equal(
        await readFreshCaller(freshGuild({ fail: true }).guild, TEST_USER),
        null
    )
    assert.equal(await readFreshCaller(null, TEST_USER), null)
})

test("a group-limited command refuses a member with the shared card in the clan language", async () => {
    const f = fakeInteraction<AccessInteraction>()
    const result = await checkCommandAccess(f.interaction, "server-status", {
        configs: configsOf(testGuildConfig()),
        readCaller: callerOf({ isAdministrator: false, roleIds: [] }),
    })
    assert.equal(result, null)
    assert.match(f.text(), /\/server-status smí použít jen správci Logi/)
    assert.match(f.text(), /"flags":32832/, "private Components V2")
})

test("Discord not answering refuses rather than guessing (M3-33)", async () => {
    const f = fakeInteraction<AccessInteraction>()
    assert.equal(
        await checkCommandAccess(f.interaction, "server-status", {
            configs: configsOf(testGuildConfig()),
            readCaller: callerOf(null),
        }),
        null
    )
    assert.match(f.text(), /Teď nejde ověřit tvoje role/)
})

test("an open command needs no Discord read; a disabled one says so", async () => {
    let reads = 0
    const open = fakeInteraction<AccessInteraction>()
    const allowed = await checkCommandAccess(open.interaction, "notice", {
        configs: configsOf(testGuildConfig()),
        readCaller: async () => {
            reads++
            return null
        },
    })
    assert.ok(allowed)
    assert.equal(allowed.language, "cs")
    assert.equal(reads, 0)
    assert.deepEqual(open.sent, [])

    const off = fakeInteraction<AccessInteraction>()
    await checkCommandAccess(off.interaction, "notice", {
        configs: configsOf(
            testGuildConfig({ commandSettings: { notice: { enabled: false } } })
        ),
    })
    assert.match(off.text(), /Příkaz \/notice je tu vypnutý/)
})

test("a server without Logi answers in its community language with the defaults", async () => {
    const f = fakeInteraction<AccessInteraction>({
        guild: {
            preferredLocale: "de",
            fetch: async () => {
                throw new Error()
            },
        },
    })
    await checkCommandAccess(f.interaction, "server-status", {
        configs: configsOf(null),
        readCaller: callerOf({ isAdministrator: false, roleIds: [] }),
    })
    assert.match(f.text(), /dürfen nur Logi-Verwalter nutzen/)
})
