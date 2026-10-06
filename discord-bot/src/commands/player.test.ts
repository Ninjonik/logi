import assert from "node:assert/strict"
import test from "node:test"

import { ChannelType, MessageFlags } from "discord.js"

import {
    configsOf,
    fakeInteraction,
    testGuildConfig,
    TEST_CHANNEL,
    TEST_GUILD,
    TEST_USER,
} from "./fake-interaction"
import {
    handlePlayerAutocomplete,
    handlePlayerCommand,
    handlePlayerShare,
    type PlayerPorts,
} from "./player"
import type { PlayerProfileData } from "../../../src/domain/discord-commands/player-view"
import type { ShareGuild } from "./share"

const profile: PlayerProfileData = {
    name: "Hráč 17",
    avatar: "https://cdn.discordapp.com/avatars/1/a.png",
    assignment: { type: "member", status: "active", paused: false },
    score: 1240,
    matchesPlayed: 48,
    averages: {
        kills: 18.2,
        deaths: 13,
        killDeathRatio: 1.4,
        offense: 412,
        defense: 388,
        support: 520,
    },
    recentMatches: [
        {
            mapName: "Carentan",
            mapId: "carentan",
            endedAt: "2026-10-03T19:00:00Z",
            importedAt: "2026-10-03T21:00:00Z",
            kills: 21,
            deaths: 12,
            killDeathRatio: 1.75,
        },
    ],
    firstMatchAt: "2026-06-02T18:00:00Z",
}

function shareGuild(options: { denied?: boolean } = {}) {
    const posted: string[] = []
    const guild: ShareGuild = {
        id: TEST_GUILD,
        channels: {
            fetch: async () => ({
                id: TEST_CHANNEL,
                guildId: TEST_GUILD,
                type: ChannelType.GuildText,
                permissionsFor: () => ({ has: () => !options.denied }),
                send: async (payload) => {
                    posted.push(JSON.stringify(payload))
                    return { id: "400000000000000001" }
                },
            }),
        },
        members: {
            fetch: async () => ({}),
            fetchMe: async () => ({}),
        },
    }
    return { guild, posted }
}

function ports(overrides: Partial<PlayerPorts> = {}): PlayerPorts {
    return {
        configs: configsOf(testGuildConfig()),
        search: async () => [
            {
                id: TEST_USER,
                name: "Hráč 17",
                assignmentType: "member",
                assignmentStatus: "active",
            },
            {
                id: "100000000000000018",
                name: "Hráč 18",
                assignmentType: "member",
                assignmentStatus: "recruit",
            },
        ],
        profile: async () => profile,
        shareGuild: () => shareGuild().guild,
        now: () => Date.parse("2026-10-11T18:50:00Z"),
        ...overrides,
    }
}

const command = (playerId = TEST_USER) =>
    fakeInteraction<Parameters<typeof handlePlayerCommand>[0]>({
        options: { getString: () => playerId },
    })

test("the autocomplete is in the clan language: name · status (M2-35, M1-40)", async () => {
    let choices: unknown
    await handlePlayerAutocomplete(
        {
            guildId: TEST_GUILD,
            options: {
                getFocused: () => ({ name: "player", value: "hr" }),
            } as never,
            respond: async (value: unknown) => {
                choices = value
            },
        } as never,
        ports()
    )
    assert.deepEqual(choices, [
        { name: "Hráč 17 · Člen · aktivní", value: TEST_USER },
        { name: "Hráč 18 · Rekrut", value: "100000000000000018" },
    ])
})

test("/player replies privately with the profile and Sdílet (M1-B06, M2-36..41)", async () => {
    const f = command()
    await handlePlayerCommand(f.interaction, ports())
    const reply = f.sent.at(-1)!
    assert.equal(reply.kind, "edit", "deferred privately, then completed")
    const out = f.last()
    assert.match(out, /HELL LET LOOSE · PROFIL HRÁČE/)
    assert.match(out, /Člen · aktivní/)
    assert.match(out, /Zdroj: importované zápasy klanu · 48 zápasů od 2\. 6\./)
    assert.match(out, /"custom_id":"player:share:100000000000000017"/)
    assert.match(out, /"style":1/, "Sdílet is the one primary button")
})

test("not found and unreadable profiles are the shared cards (M2-44, M2-45)", async () => {
    const missing = command("100000000000000099")
    await handlePlayerCommand(
        missing.interaction,
        ports({ profile: async () => null })
    )
    assert.match(missing.text(), /Tohoto hráče v klanu nenacházím/)
    const broken = command()
    await handlePlayerCommand(
        broken.interaction,
        ports({
            profile: async () => {
                throw new Error("Convex: internal detail")
            },
        })
    )
    assert.match(broken.text(), /Profil se teď nedá načíst/)
    assert.doesNotMatch(broken.text(), /internal detail/)
})

test("the reply mode Jen autor příkazu has no Sdílet (N3-16)", async () => {
    const f = command()
    await handlePlayerCommand(
        f.interaction,
        ports({
            configs: configsOf(
                testGuildConfig({
                    commandSettings: { player: { reply: "private" } },
                })
            ),
        })
    )
    assert.doesNotMatch(f.last(), /player:share/)
})

test("Sdílet posts the profile to the command's channel and names the sharer (M2-40, M2-42)", async () => {
    const target = shareGuild()
    const f = fakeInteraction<Parameters<typeof handlePlayerShare>[0]>({
        customId: `player:share:${TEST_USER}`,
    })
    await handlePlayerShare(
        f.interaction,
        ports({ shareGuild: () => target.guild })
    )
    assert.equal(target.posted.length, 1)
    assert.match(target.posted[0]!, /Sdílel <@100000000000000017> · stav k ne/)
    assert.match(
        target.posted[0]!,
        /Importované zápasy klanu · Spravováno v Logi/
    )
    assert.doesNotMatch(target.posted[0]!, /custom_id/)
    const posted = JSON.parse(target.posted[0]!) as { flags: number }
    assert.equal(
        posted.flags & MessageFlags.Ephemeral,
        0,
        "the shared post is public"
    )
    assert.match(f.last(), /Sdíleno do <#300000000000000001>/)
    assert.match(
        f.last(),
        /https:\/\/discord\.com\/channels\/100000000000000000\/300000000000000001\/400000000000000001/
    )
})

test("Sdílet into a channel the person or the bot cannot post in is refused (M2-B03)", async () => {
    const target = shareGuild({ denied: true })
    const f = fakeInteraction<Parameters<typeof handlePlayerShare>[0]>({
        customId: `player:share:${TEST_USER}`,
    })
    await handlePlayerShare(
        f.interaction,
        ports({ shareGuild: () => target.guild })
    )
    assert.equal(target.posted.length, 0)
    assert.match(f.last(), /Do <#300000000000000001> teď sdílet nejde/)
})
