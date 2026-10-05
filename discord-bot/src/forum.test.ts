import assert from "node:assert/strict"
import test from "node:test"

import { ChannelFlags, ChannelType } from "discord.js"

import {
    buildMatchForumName,
    buildTopicMessage,
    findRecoverableEventForum,
    pinForumPost,
} from "./forum"
import { forumTopicView } from "../../src/domain/discord-messages/match-forum"
import { getRosterMessages } from "../../src/lib/clan-language/rosters"

const snapshot = (name: string, shortCode: string) => ({
    name,
    shortCode,
    logoAssetId: null,
    logoUrl: null,
    teamRevision: 1,
    capturedAt: "",
})

test("the match forum is named after the match title and the day", () => {
    assert.equal(
        buildMatchForumName(
            { timezone: "Europe/Prague" },
            {
                name: "Liga 4",
                gameStart: "2026-10-11T18:00:00.000Z",
                matchTeams: [
                    {
                        teamId: "a",
                        slot: "a",
                        side: "Allies",
                        snapshot: snapshot("Vlci", "VLK"),
                    },
                    {
                        teamId: "b",
                        slot: "b",
                        side: "Axis",
                        snapshot: snapshot("Rogue", "ROG"),
                    },
                ],
            }
        ),
        "vlk-vs-rog-11-10"
    )
})

test("a topic post keeps its attachments inside the clan card above the footer", () => {
    const container = buildTopicMessage(
        forumTopicView({
            title: "Komunikace a rádio",
            body: "Velitelé čet mluví krátce.",
            presetName: "Komunikace",
            copy: getRosterMessages("cs"),
        }),
        [{ name: "foy-komunikace.pdf" }, { name: "mapa.png" }],
        { language: "cs" }
    ).toJSON()
    // The title and text, the picture gallery, the PDF card, then the footer.
    assert.deepEqual(
        container.components.map((component) => component.type),
        [10, 10, 12, 13, 10]
    )
    assert.match(
        JSON.stringify(container),
        /attachment:\/\/foy-komunikace\.pdf/
    )
    assert.match(
        JSON.stringify(container.components.at(-1)),
        /-# Z předvolby témat Komunikace · Spravováno v Logi/
    )
})

test("forum recovery selects the oldest matching event forum", () => {
    const recovered = findRecoverableEventForum(
        [
            {
                id: "other-parent",
                name: "wardogs-match-10-10-2026",
                parentId: "other",
                type: ChannelType.GuildForum,
                createdTimestamp: 1,
            },
            {
                id: "newer-match",
                name: "wardogs-match-10-10-2026",
                parentId: "briefings",
                type: ChannelType.GuildForum,
                createdTimestamp: 20,
            },
            {
                id: "oldest-match",
                name: "wardogs-match-10-10-2026",
                parentId: "briefings",
                type: ChannelType.GuildForum,
                createdTimestamp: 10,
            },
        ],
        "briefings",
        "wardogs-match-10-10-2026"
    )

    assert.equal(recovered?.id, "oldest-match")
})

test("the debrief post is pinned and any other pinned post unpinned", async () => {
    const calls: string[] = []
    const post = (id: string, pinned: boolean) => ({
        id,
        flags: {
            has: (flag: ChannelFlags) => pinned && flag === ChannelFlags.Pinned,
        },
        pin: async () => {
            calls.push(`pin ${id}`)
        },
        unpin: async () => {
            calls.push(`unpin ${id}`)
        },
    })
    const info = post("info", true)
    const topic = post("topic", false)
    const debrief = post("debrief", false)

    await pinForumPost([info, topic, debrief], debrief, "event-1")
    assert.deepEqual(calls, ["unpin info", "pin debrief"])

    calls.length = 0
    await pinForumPost(
        [post("debrief", true)],
        post("debrief", true),
        "event-1"
    )
    assert.deepEqual(calls, [])
})
