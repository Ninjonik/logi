import assert from "node:assert/strict"
import test from "node:test"

import {
    APPLICATION_CHANNEL_PERMISSIONS as P,
    PANEL_PERMISSIONS,
    THREAD_PERMISSIONS,
    checkApplicationChannels,
} from "./application-channels"

const guildId = "100000000000000001"
const botRole = "100000000000000002"
const everyone = (permissions: bigint) => ({
    id: guildId,
    permissions: String(permissions),
    position: 0,
    mentionable: false,
    managed: false,
})

test("the bot may post the panel and create private threads (N4-05, N4-06)", () => {
    const report = checkApplicationChannels({
        guildId,
        bot: { id: "100000000000000003", roleIds: [] },
        roles: [everyone(PANEL_PERMISSIONS | THREAD_PERMISSIONS)],
        panelChannel: { overwrites: [] },
        threadChannel: { overwrites: [] },
    })
    assert.deepEqual(report, { panel: { ok: true }, threads: { ok: true } })
})

test("a channel overwrite that denies attachments or private threads is reported", () => {
    const report = checkApplicationChannels({
        guildId,
        bot: { id: "100000000000000003", roleIds: [botRole] },
        roles: [
            everyone(P.viewChannel),
            {
                ...everyone(PANEL_PERMISSIONS | THREAD_PERMISSIONS),
                id: botRole,
            },
        ],
        panelChannel: {
            overwrites: [
                {
                    id: botRole,
                    type: 0,
                    allow: "0",
                    deny: String(P.attachFiles),
                },
            ],
        },
        threadChannel: {
            overwrites: [
                {
                    id: botRole,
                    type: 0,
                    allow: "0",
                    deny: String(P.createPrivateThreads),
                },
            ],
        },
    })
    assert.deepEqual(report, { panel: { ok: false }, threads: { ok: false } })
})

test("an unknown channel cannot be used; an unset one is not checked", () => {
    assert.deepEqual(
        checkApplicationChannels({
            guildId,
            bot: { id: "100000000000000003", roleIds: [] },
            roles: [everyone(PANEL_PERMISSIONS)],
            panelChannel: { overwrites: [], unusable: true },
            threadChannel: null,
        }),
        { panel: { ok: false }, threads: null }
    )
})
