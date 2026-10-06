import assert from "node:assert/strict"
import test from "node:test"

import type { MessageCreateOptions } from "discord.js"

import type {
    SeedDeliveryServer,
    SeedDeliveryState,
} from "../../../convex/discordSeedBot"
import {
    isPermanentSeedFailure,
    runSeedGuild,
    type SeedWorkerPorts,
} from "./worker"
import { boardSeedSettings } from "../../../src/infrastructure/testing/in-memory-seed"
import type { StoredSeedRun } from "../../../src/application/discord-seed/ports"
import { startSeedRun } from "../../../src/domain/discord-seed/run"
import { PublicationChannelError } from "../sync/publication"

const GUILD = "100000000000000000"
const CONNECTION = "gameDataConnections:vlci1"
const SEED = "111111111111111111"
const CONTROL = "222222222222222222"
const ROLE = "333333333333333333"
const NOW = Date.parse("2026-10-10T15:41:00Z")

function run(overrides: Partial<StoredSeedRun> = {}): StoredSeedRun {
    return {
        ...startSeedRun({
            trigger: {
                kind: "manual",
                actor: { id: "100000000000000001", name: "Kowalski" },
                via: "discord",
                channelId: CONTROL,
            },
            now: NOW - 60_000,
            plan: { liveFrom: 40, maxDurationMinutes: 120, endAction: "edit" },
            ping: { kind: "role", roleId: ROLE },
            observation: {
                players: 12,
                capacity: 100,
                map: "Foy",
                observedAt: NOW - 60_000,
            },
        }),
        guildId: GUILD,
        connectionId: CONNECTION,
        planId: "plan-1",
        channelId: SEED,
        requestKey: null,
        serverName: "Vlci #1 · Public",
        id: "run-1",
        ...overrides,
    }
}

function server(
    overrides: Partial<SeedDeliveryServer> = {}
): SeedDeliveryServer {
    return {
        connectionId: CONNECTION,
        settings: boardSeedSettings({
            seedChannelId: SEED,
            controlChannelId: CONTROL,
            seedRoleId: ROLE,
        }),
        revision: 1,
        name: "Vlci #1 · Public",
        gameId: "hell_let_loose",
        reading: {
            name: "Vlci #1 · Public",
            gameId: "hell_let_loose",
            players: 12,
            capacity: 100,
            map: "Foy",
            online: true,
            observedAt: NOW - 20_000,
            fresh: true,
        },
        snapshot: null,
        status: "below_start",
        activeRun: null,
        joinUrl: "https://logi.app/join/vlci-1",
        panel: { channelId: "555555555555555555", paused: false, sent: true },
        control: {
            outbox: { revision: 1, deliveredRevision: 0 },
            message: null,
        },
        ...overrides,
    }
}

function fakePorts(
    state: SeedDeliveryState,
    overrides: Partial<SeedWorkerPorts> = {}
) {
    const published: Array<{
        key: string
        revision: number
        channelId: string | null
        message: MessageCreateOptions
    }> = []
    const events: unknown[] = []
    let clock = NOW
    const ports: SeedWorkerPorts = {
        state: async () => state,
        context: async () => ({
            language: "cs",
            timeZone: "Europe/Prague",
            clanName: "Vlci",
            messageStyle: null,
            siteUrl: "https://logi.app",
        }),
        publish: async (input) => {
            published.push(input)
            return input.channelId ? `message:${input.key}` : null
        },
        isPermanentFailure: isPermanentSeedFailure,
        record: async (input) => {
            events.push({ record: input })
        },
        callPosted: async (input) => {
            events.push({ posted: input })
        },
        callFailed: async (input) => {
            events.push({ failed: input })
        },
        roleMemberCount: async () => 34,
        channelPrivate: async () => true,
        pin: async (_guild, channelId, messageId) => {
            events.push({ pin: `${channelId}:${messageId}` })
        },
        controlChannelPublic: async (_guild, channelId) => {
            events.push({ publicControl: channelId })
        },
        now: () => clock,
        ...overrides,
    }
    return {
        ports,
        published,
        events,
        advance: (ms: number) => {
            clock += ms
        },
    }
}

const text = (message: MessageCreateOptions) =>
    JSON.stringify(message.components)
const empty: SeedDeliveryState = { servers: [], calls: [], intros: [] }

test("a running seed's call is posted with the ping, reported once and redrawn every 60 s", async () => {
    const seeding = run()
    const env = fakePorts({
        ...empty,
        servers: [
            server({
                activeRun: seeding,
                control: { outbox: null, message: null },
                settings: { ...server().settings, controlChannelId: null },
            }),
        ],
        calls: [
            {
                run: seeding,
                outbox: { revision: 1, deliveredRevision: 0 },
                message: null,
            },
        ],
    })
    const memory = new Map<string, number>()
    const first = await runSeedGuild(GUILD, env.ports, memory)
    assert.equal(first.calls.get("run-1"), "message:seed:call:run-1")
    assert.equal(env.published.length, 1)
    const call = env.published[0]!
    assert.equal(call.key, "seed:call:run-1")
    assert.equal(call.channelId, SEED)
    assert.deepEqual(call.message.allowedMentions, { parse: [], roles: [ROLE] })
    assert.match(text(call.message), /<@&333333333333333333>/)
    assert.match(text(call.message), /Seedujeme Vlci #1 · Public/)
    assert.match(text(call.message), /Zvát mě na seed/)
    assert.deepEqual(env.events, [
        { posted: { guildId: GUILD, runId: "run-1", pingedMembers: 34 } },
        {
            record: {
                guildId: GUILD,
                kind: "call",
                key: "run-1",
                revision: 1,
            },
        },
    ])

    // The same pass again inside 60 s draws nothing (the outbox is delivered now).
    const settled = { ...seeding, callPostedAt: NOW }
    const again = fakePorts({
        ...empty,
        calls: [
            {
                run: settled,
                outbox: { revision: 1, deliveredRevision: 1 },
                message: { channelId: SEED, messageId: "m1" },
            },
        ],
    })
    await runSeedGuild(GUILD, again.ports, memory)
    assert.equal(again.published.length, 0)
    again.advance(60_000)
    await runSeedGuild(GUILD, again.ports, memory)
    assert.equal(again.published.length, 1, "redrawn after 60 s")
    assert.deepEqual(again.events, [], "no new report for an edit")
})

test("a call the channel refuses fails the run and is kept for the receipt", async () => {
    const seeding = run()
    const env = fakePorts(
        {
            ...empty,
            calls: [
                {
                    run: seeding,
                    outbox: { revision: 1, deliveredRevision: 0 },
                    message: null,
                },
            ],
        },
        {
            publish: async () => {
                throw new PublicationChannelError("missing_permissions", [
                    "SendMessages",
                ])
            },
        }
    )
    await runSeedGuild(GUILD, env.ports, new Map())
    assert.deepEqual(env.events[0], {
        failed: {
            guildId: GUILD,
            runId: "run-1",
            reason: "channel_unavailable",
        },
    })
    assert.equal(
        (env.events[1] as { record: { error?: string } }).record.error,
        "Publication channel permissions missing."
    )
})

test("the live call drops the ping line; an ended call without a message is settled without posting", async () => {
    const live = run({
        status: "live",
        endedAt: NOW,
        callPostedAt: NOW - 60_000,
        players: {
            start: 12,
            latest: 41,
            peak: 41,
            end: 41,
            capacity: 100,
            map: "Foy",
            observedAt: NOW,
        },
    })
    const env = fakePorts({
        ...empty,
        calls: [
            {
                run: live,
                outbox: { revision: 3, deliveredRevision: 2 },
                message: { channelId: SEED, messageId: "m1" },
            },
            {
                run: { ...live, id: "run-2", callPostedAt: null },
                outbox: { revision: 2, deliveredRevision: 1 },
                message: null,
            },
        ],
    })
    await runSeedGuild(GUILD, env.ports, new Map())
    assert.equal(env.published.length, 1)
    const edit = env.published[0]!
    assert.deepEqual(edit.message.allowedMentions, { parse: [] })
    assert.doesNotMatch(text(edit.message), /<@&/)
    assert.match(text(edit.message), /Server je živý/)
    assert.deepEqual(
        env.events.map((event) => JSON.stringify(event)),
        [
            JSON.stringify({
                record: {
                    guildId: GUILD,
                    kind: "call",
                    key: "run-1",
                    revision: 3,
                },
            }),
            JSON.stringify({
                record: {
                    guildId: GUILD,
                    kind: "call",
                    key: "run-2",
                    revision: 2,
                },
            }),
        ]
    )
})

test("the control message goes only to a private channel (P3-22, P5-26)", async () => {
    const privateEnv = fakePorts({ ...empty, servers: [server()] })
    await runSeedGuild(GUILD, privateEnv.ports, new Map())
    assert.equal(privateEnv.published.length, 1)
    const control = privateEnv.published[0]!
    assert.equal(control.key, `seed:control:${CONNECTION}`)
    assert.equal(control.channelId, CONTROL)
    assert.match(text(control.message), /OVLÁDÁNÍ SERVERU · HELL LET LOOSE/)
    assert.match(text(control.message), /Spustit seed/)
    assert.match(text(control.message), /seed:start:gameDataConnections:vlci1/)

    const publicEnv = fakePorts(
        { ...empty, servers: [server()] },
        { channelPrivate: async () => false }
    )
    await runSeedGuild(GUILD, publicEnv.ports, new Map())
    assert.equal(publicEnv.published.length, 0)
    assert.deepEqual(publicEnv.events[0], { publicControl: CONTROL })
    assert.equal(
        (publicEnv.events[1] as { record: { error?: string } }).record.error,
        "control_channel_public"
    )

    const removed = fakePorts(
        {
            ...empty,
            servers: [
                server({
                    settings: { ...server().settings, controlChannelId: null },
                    control: {
                        outbox: { revision: 2, deliveredRevision: 1 },
                        message: { channelId: CONTROL, messageId: "m" },
                    },
                }),
            ],
        },
        { channelPrivate: async () => false }
    )
    await runSeedGuild(GUILD, removed.ports, new Map())
    assert.equal(removed.published[0]?.channelId, null, "the old message goes")
})

test("the intro is posted, pinned and removed when nobody offers the role any more", async () => {
    const intro = {
        channelId: SEED,
        show: true,
        roleId: ROLE,
        servers: [
            {
                name: "Vlci #1 · Public",
                schedule: {
                    enabled: true,
                    slots: [{ days: [5, 6], time: "15:00" }],
                },
            },
        ],
        outbox: { revision: 1, deliveredRevision: 0 },
        message: null,
    }
    const env = fakePorts({ ...empty, intros: [intro] })
    await runSeedGuild(GUILD, env.ports, new Map())
    assert.equal(env.published[0]?.key, `seed:intro:${SEED}`)
    assert.match(text(env.published[0]!.message), /Seed serverů Vlci/)
    assert.match(
        text(env.published[0]!.message),
        /seed:role:333333333333333333/
    )
    assert.deepEqual(env.events[0], {
        pin: `${SEED}:message:seed:intro:${SEED}`,
    })

    const gone = fakePorts({
        ...empty,
        intros: [
            {
                ...intro,
                show: false,
                roleId: null,
                servers: [],
                outbox: { revision: 2, deliveredRevision: 1 },
                message: { channelId: SEED, messageId: "m" },
            },
        ],
    })
    await runSeedGuild(GUILD, gone.ports, new Map())
    assert.equal(gone.published[0]?.channelId, null)
})

test("a clan without seed messages costs one read", async () => {
    let contexts = 0
    const env = fakePorts(empty, {
        context: async () => {
            contexts++
            throw new Error("not needed")
        },
    })
    await runSeedGuild(GUILD, env.ports, new Map())
    assert.equal(contexts, 0)
})
