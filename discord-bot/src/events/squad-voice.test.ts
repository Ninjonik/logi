import { ChannelType, type Guild } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

import { syncSquadVoiceChannels, type SquadVoiceNames } from "./squad-voice"
import { boardEvent, boardRoster } from "./board-example.fixture"
import type { Roster } from "../types"

type FakeChannel = {
    id: string
    name: string
    type: ChannelType
    parentId?: string | null
    rawPosition: number
    permissionOverwrites: {
        cache: Array<{
            id: string
            type: number
            allow: { bitfield: bigint }
            deny: { bitfield: bigint }
        }>
    }
    deleted: boolean
    delete(): Promise<FakeChannel>
}

function fakeGuild(options: { failCategory?: boolean } = {}) {
    const channels = new Map<string, FakeChannel>()
    const created: Array<Record<string, unknown>> = []
    const deleted: string[] = []
    let next = 1
    const add = (channel: Omit<FakeChannel, "deleted" | "delete">) => {
        const full: FakeChannel = {
            ...channel,
            deleted: false,
            async delete() {
                full.deleted = true
                channels.delete(full.id)
                deleted.push(full.id)
                return full
            },
        }
        channels.set(full.id, full)
        return full
    }
    add({
        id: "anchor",
        name: "Hlasové kanály",
        type: ChannelType.GuildCategory,
        rawPosition: 4,
        permissionOverwrites: {
            cache: [
                {
                    id: "everyone",
                    type: 0,
                    allow: { bitfield: BigInt(0) },
                    deny: { bitfield: BigInt(1024) },
                },
            ],
        },
    })
    const guild = {
        id: "guild-1",
        channels: {
            async fetch(id: string) {
                return channels.get(id) ?? null
            },
            async create(input: Record<string, unknown>) {
                created.push(input)
                if (
                    options.failCategory &&
                    input.type === ChannelType.GuildCategory
                )
                    throw new Error("Missing Permissions")
                return add({
                    id: `ch-${next++}`,
                    name: String(input.name),
                    type: input.type as ChannelType,
                    parentId: (input.parent as string | undefined) ?? null,
                    rawPosition: 0,
                    permissionOverwrites: { cache: [] },
                })
            },
        },
    }
    return {
        guild: guild as unknown as Guild,
        channels,
        created,
        deleted,
    }
}

const names: SquadVoiceNames = {
    category: "Čety · VLK vs ROG",
    squad: (squad) => `${squad.name} · Pěchota`,
}

const roster: Roster = {
    ...boardRoster,
    squads: [
        ...boardRoster.squads,
        { ...boardRoster.squads[0]!, name: "F2", order: 1 },
        { ...boardRoster.squads[0]!, name: "F3", order: 2, players: [] },
    ],
}

const event = boardEvent({
    status: "starting",
    createSquadVoiceChannels: true,
})
const afterMeeting = Date.parse(event.meetingStart) + 60_000

test("squad channels go into the match's own category below the configured one", async () => {
    const fake = fakeGuild()
    const ids = await syncSquadVoiceChannels({
        guild: fake.guild,
        event,
        roster,
        defaultCategoryId: "anchor",
        existingIds: [],
        names,
        now: afterMeeting,
    })
    assert.equal(ids.length, 3)
    const [category, f1, f2] = fake.created
    assert.equal(category?.name, "Čety · VLK vs ROG")
    assert.equal(category?.type, ChannelType.GuildCategory)
    assert.equal(category?.position, 5)
    assert.deepEqual(category?.permissionOverwrites, [
        { id: "everyone", type: 0, allow: BigInt(0), deny: BigInt(1024) },
    ])
    // Only non-empty squads get a channel.
    assert.deepEqual([f1?.name, f2?.name], ["F1 · Pěchota", "F2 · Pěchota"])
    assert.equal(f1?.parent, ids[0])
    assert.equal(f2?.parent, ids[0])
    assert.equal(fake.created.length, 3)
})

test("a later sync reuses the category and creates nothing twice", async () => {
    const fake = fakeGuild()
    const first = await syncSquadVoiceChannels({
        guild: fake.guild,
        event,
        roster: { ...roster, squads: roster.squads.slice(0, 1) },
        defaultCategoryId: "anchor",
        existingIds: [],
        names,
        now: afterMeeting,
    })
    const second = await syncSquadVoiceChannels({
        guild: fake.guild,
        event,
        roster,
        defaultCategoryId: "anchor",
        existingIds: first,
        names,
        now: afterMeeting,
    })
    assert.equal(
        fake.created.filter((item) => item.type === ChannelType.GuildCategory)
            .length,
        1
    )
    assert.equal(second.length, 3)
    assert.equal(fake.created[fake.created.length - 1]?.name, "F2 · Pěchota")
    assert.equal(fake.created[fake.created.length - 1]?.parent, first[0])
    const third = await syncSquadVoiceChannels({
        guild: fake.guild,
        event,
        roster,
        defaultCategoryId: "anchor",
        existingIds: second,
        names,
        now: afterMeeting,
    })
    assert.deepEqual(third, second)
    assert.equal(fake.created.length, 3)
})

test("without permission for a category the channels use the configured one", async () => {
    const fake = fakeGuild({ failCategory: true })
    const ids = await syncSquadVoiceChannels({
        guild: fake.guild,
        event,
        roster,
        defaultCategoryId: "anchor",
        existingIds: [],
        names,
        now: afterMeeting,
    })
    assert.equal(ids.length, 2)
    assert.deepEqual(
        fake.created
            .filter((item) => item.type === ChannelType.GuildVoice)
            .map((item) => item.parent),
        ["anchor", "anchor"]
    )
})

test("nothing is created before the meeting or when the template is off", async () => {
    for (const input of [
        { event, now: Date.parse(event.meetingStart) - 60_000 },
        {
            event: boardEvent({
                status: "starting",
                createSquadVoiceChannels: false,
            }),
            now: afterMeeting,
        },
    ]) {
        const fake = fakeGuild()
        const ids = await syncSquadVoiceChannels({
            guild: fake.guild,
            ...input,
            roster,
            defaultCategoryId: "anchor",
            existingIds: [],
            names,
        })
        assert.deepEqual(ids, [])
        assert.equal(fake.created.length, 0)
    }
})

test("a concluded match removes its channels, then its category", async () => {
    const fake = fakeGuild()
    const ids = await syncSquadVoiceChannels({
        guild: fake.guild,
        event,
        roster,
        defaultCategoryId: "anchor",
        existingIds: [],
        names,
        now: afterMeeting,
    })
    const left = await syncSquadVoiceChannels({
        guild: fake.guild,
        event: boardEvent({
            status: "concluded",
            createSquadVoiceChannels: true,
        }),
        roster,
        defaultCategoryId: "anchor",
        existingIds: ids,
        names,
    })
    assert.deepEqual(left, [])
    assert.deepEqual(fake.deleted, [ids[1], ids[2], ids[0]])
    assert.ok(fake.channels.has("anchor"), "the configured category stays")
})
