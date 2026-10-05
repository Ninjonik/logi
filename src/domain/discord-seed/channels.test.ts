import assert from "node:assert/strict"
import test from "node:test"

import {
    SEED_DISCORD_PERMISSIONS as P,
    channelPermissions,
    checkSeedChannels,
    everyoneCanView,
    type DiscordOverwrite,
    type DiscordRole,
} from "./channels"

const GUILD = "100000000000000000"
const BOT = "100000000000000009"
const BOT_ROLE = "100000000000000010"
const ADMINS = "100000000000000011"
const SEED_ROLE = "100000000000000012"

const bits = (...values: bigint[]) =>
    String(values.reduce((all, value) => all | value, BigInt(0)))
const publish = [
    P.viewChannel,
    P.sendMessages,
    P.embedLinks,
    P.attachFiles,
    P.readMessageHistory,
]
const role = (
    id: string,
    permissions: string,
    position: number,
    extra: Partial<DiscordRole> = {}
): DiscordRole => ({
    id,
    permissions,
    position,
    mentionable: false,
    managed: false,
    ...extra,
})
const roles = (seed: Partial<DiscordRole> = {}): DiscordRole[] => [
    role(GUILD, bits(P.viewChannel, P.readMessageHistory), 0),
    role(BOT_ROLE, bits(...publish, P.manageRoles), 5),
    role(ADMINS, bits(...publish), 4),
    role(SEED_ROLE, "0", 2, { mentionable: true, ...seed }),
]
const hiddenFromEveryone: DiscordOverwrite[] = [
    { id: GUILD, type: 0, allow: "0", deny: bits(P.viewChannel) },
    { id: ADMINS, type: 0, allow: bits(P.viewChannel), deny: "0" },
    { id: BOT_ROLE, type: 0, allow: bits(P.viewChannel), deny: "0" },
]
const check = (
    overrides: Partial<Parameters<typeof checkSeedChannels>[0]> = {}
) =>
    checkSeedChannels({
        guildId: GUILD,
        bot: { id: BOT, roleIds: [BOT_ROLE] },
        roles: roles(),
        seedChannel: { overwrites: [] },
        controlChannel: { overwrites: hiddenFromEveryone },
        roleId: SEED_ROLE,
        roleSelfService: true,
        ...overrides,
    })

test("the board's setup passes: #seed can ping @Seed and #spravci is private", () => {
    assert.deepEqual(check(), {
        seedChannel: { canPublish: true, canMentionRole: true },
        controlChannel: { canPublish: true, private: true },
        role: { exists: true, canManage: true },
        problems: [],
    })
})

test("a public control channel is refused", () => {
    const report = check({ controlChannel: { overwrites: [] } })
    assert.deepEqual(report.controlChannel, {
        canPublish: true,
        private: false,
    })
    assert.deepEqual(report.problems, ["control_channel_public"])
})

test("channels the bot cannot write to are reported", () => {
    const denied: DiscordOverwrite[] = [
        { id: BOT, type: 1, allow: "0", deny: bits(P.sendMessages) },
    ]
    assert.deepEqual(
        check({
            seedChannel: { overwrites: denied },
            controlChannel: { overwrites: [...hiddenFromEveryone, ...denied] },
        }).problems,
        ["seed_channel_unpublishable", "control_channel_unpublishable"]
    )
})

test("a role that is not mentionable needs Mention @everyone in #seed", () => {
    const unmentionable = roles({ mentionable: false })
    assert.deepEqual(check({ roles: unmentionable }).problems, [
        "seed_role_not_mentionable",
    ])
    assert.deepEqual(
        check({
            roles: unmentionable,
            seedChannel: {
                overwrites: [
                    {
                        id: BOT_ROLE,
                        type: 0,
                        allow: bits(P.mentionEveryone),
                        deny: "0",
                    },
                ],
            },
        }).problems,
        []
    )
})

test("self-service needs a role the bot can assign", () => {
    assert.deepEqual(check({ roles: roles({ position: 6 }) }).problems, [
        "seed_role_unmanageable",
    ])
    assert.deepEqual(check({ roles: roles({ managed: true }) }).problems, [
        "seed_role_unmanageable",
    ])
    assert.deepEqual(
        check({ roles: roles({ position: 6 }), roleSelfService: false })
            .problems,
        [],
        "without the toggle button the bot only pings the role"
    )
})

test("a deleted role and an unset role are told apart", () => {
    assert.deepEqual(check({ roleId: "100000000000000099" }).problems, [
        "seed_role_missing",
    ])
    const unset = check({ roleId: null })
    assert.equal(unset.role, null)
    assert.equal(unset.seedChannel?.canMentionRole, null)
    assert.deepEqual(unset.problems, [])
})

test("unset channels are not checked", () => {
    const report = check({ seedChannel: null, controlChannel: null })
    assert.equal(report.seedChannel, null)
    assert.equal(report.controlChannel, null)
})

test("permissions follow Discord's overwrite order and administrator", () => {
    const base = {
        guildId: GUILD,
        memberId: BOT,
        memberRoleIds: [BOT_ROLE],
        roles: roles(),
    }
    const memberDeny = channelPermissions({
        ...base,
        overwrites: [
            {
                id: BOT_ROLE,
                type: 0,
                allow: bits(P.mentionEveryone),
                deny: "0",
            },
            { id: BOT, type: 1, allow: "0", deny: bits(P.mentionEveryone) },
        ],
    })
    assert.equal(memberDeny & P.mentionEveryone, BigInt(0))
    const administrator = channelPermissions({
        ...base,
        roles: [role(GUILD, "0", 0), role(BOT_ROLE, bits(P.administrator), 5)],
        overwrites: [
            { id: BOT, type: 1, allow: "0", deny: bits(P.viewChannel) },
        ],
    })
    assert.equal(administrator & P.viewChannel, P.viewChannel)
    assert.equal(
        everyoneCanView(
            GUILD,
            [role(GUILD, bits(P.administrator), 0)],
            hiddenFromEveryone
        ),
        true
    )
    assert.equal(everyoneCanView(GUILD, roles(), hiddenFromEveryone), false)
    assert.equal(everyoneCanView(GUILD, roles(), []), true)
})
