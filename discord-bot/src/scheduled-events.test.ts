import { ChannelType, GuildScheduledEventStatus } from "discord.js"
import { resourceFixture } from "./runtime/event-resource.fixture"
import test, { beforeEach } from "node:test"
import assert from "node:assert/strict"
beforeEach((t) => {
    if ("mock" in t) resourceFixture(t)
})

import {
    cancelScheduledDiscordEvent,
    deriveScheduledEventLifecycle,
    syncScheduledDiscordEvent,
} from "./scheduled-events"
import type { EventRecord } from "./types"

const baseEvent: EventRecord = {
    id: "event-1",
    guildId: "guild-1",
    kind: "match",
    name: "Operation Test",
    requiredRoleIds: [],
    rewardRoleIds: [],
    registrationEnd: "2026-01-01T08:00:00.000Z",
    meetingStart: "2026-01-01T10:00:00.000Z",
    gameStart: "2026-01-01T10:30:00.000Z",
    gameEnd: "2026-01-01T12:00:00.000Z",
    pingClan: false,
    createForumChannel: true,
    status: "registration",
    statusUpdatedAt: "2026-01-01T07:00:00.000Z",
    attendanceReminderLog: [],
    signUps: [],
    participants: [],
    updatedAt: "event-v1",
}

function withNow<T>(iso: string, run: () => T) {
    const originalNow = Date.now
    Date.now = () => new Date(iso).getTime()
    try {
        return run()
    } finally {
        Date.now = originalNow
    }
}

test("deriveScheduledEventLifecycle returns scheduled before meeting start", () => {
    withNow("2026-01-01T09:00:00.000Z", () => {
        assert.equal(deriveScheduledEventLifecycle(baseEvent), "scheduled")
    })
})

test("deriveScheduledEventLifecycle returns active after meeting start", () => {
    withNow("2026-01-01T10:15:00.000Z", () => {
        assert.equal(deriveScheduledEventLifecycle(baseEvent), "active")
    })
})

test("deriveScheduledEventLifecycle returns completed after game end", () => {
    withNow("2026-01-01T12:01:00.000Z", () => {
        assert.equal(deriveScheduledEventLifecycle(baseEvent), "completed")
    })
})

test("deriveScheduledEventLifecycle cancels concluded events before meeting start", () => {
    withNow("2026-01-01T09:00:00.000Z", () => {
        assert.equal(
            deriveScheduledEventLifecycle({
                ...baseEvent,
                status: "concluded",
            }),
            "canceled"
        )
    })
})

test("deriveScheduledEventLifecycle completes concluded events after meeting start", () => {
    withNow("2026-01-01T10:15:00.000Z", () => {
        assert.equal(
            deriveScheduledEventLifecycle({
                ...baseEvent,
                status: "concluded",
            }),
            "completed"
        )
    })
})

test("syncScheduledDiscordEvent cancels unsupported meeting channels and clears scheduled state", async () => {
    const edits: unknown[] = []
    const guild = {
        id: "guild-1",
        scheduledEvents: {
            fetch: async () => ({
                status: GuildScheduledEventStatus.Scheduled,
                edit: async (input: unknown) => {
                    edits.push(input)
                    return {}
                },
            }),
        },
    }

    const result = await syncScheduledDiscordEvent({
        guild: guild as never,
        event: baseEvent,
        content: { name: "Operation Test", description: "Briefing" },
        meetingChannel: { type: ChannelType.GuildText } as never,
        scheduledEventId: "sched-1",
        desiredLifecycle: "scheduled",
    })

    assert.deepEqual(result, {
        scheduledEventId: undefined,
        scheduledEventStatus: "canceled",
    })
    assert.deepEqual(edits, [{ status: GuildScheduledEventStatus.Canceled }])
})

test("syncScheduledDiscordEvent returns completed without creating past lifecycle events", async () => {
    const guild = {
        id: "guild-1",
        scheduledEvents: {
            fetch: async () => null,
            create: async () => {
                throw new Error("should not create")
            },
        },
    }

    const result = await syncScheduledDiscordEvent({
        guild: guild as never,
        event: baseEvent,
        content: { name: "Operation Test", description: "Briefing" },
        meetingChannel: {
            id: "voice-1",
            type: ChannelType.GuildVoice,
        } as never,
        desiredLifecycle: "completed",
    })

    assert.deepEqual(result, {
        scheduledEventId: undefined,
        scheduledEventStatus: "completed",
    })
})

test("syncScheduledDiscordEvent creates and advances scheduled events when needed", async () => {
    const edits: unknown[] = []
    const guild = {
        id: "guild-1",
        scheduledEvents: {
            fetch: async () => null,
            create: async () => ({
                id: "sched-1",
                status: GuildScheduledEventStatus.Scheduled,
                edit: async (input: unknown) => {
                    edits.push(input)
                    return {
                        id: "sched-1",
                        status: GuildScheduledEventStatus.Active,
                        edit: async () => ({}),
                    }
                },
            }),
        },
    }

    const result = await syncScheduledDiscordEvent({
        guild: guild as never,
        event: baseEvent,
        content: { name: "Operation Test", description: "Briefing" },
        meetingChannel: {
            id: "voice-1",
            type: ChannelType.GuildVoice,
        } as never,
        desiredLifecycle: "active",
    })

    assert.deepEqual(result, {
        scheduledEventId: "sched-1",
        scheduledEventStatus: "active",
    })
    assert.deepEqual(edits, [{ status: GuildScheduledEventStatus.Active }])
})

for (const ambiguous of [false, true]) {
    test(`scheduled event receipt ${ambiguous ? "withholds a lost create response" : "survives a crash before sync state is saved"}`, async () => {
        let creates = 0
        const scheduled = {
            id: "scheduled",
            status: GuildScheduledEventStatus.Scheduled,
            edit: async () => scheduled,
        }
        const input = {
            guild: {
                id: "guild-1",
                scheduledEvents: {
                    fetch: async () => scheduled,
                    create: async () => {
                        creates++
                        if (ambiguous) throw new Error("Lost response")
                        return scheduled
                    },
                },
            } as never,
            event: baseEvent,
            content: { name: "Operation Test", description: "Briefing" },
            meetingChannel: {
                id: "voice",
                type: ChannelType.GuildVoice,
            } as never,
            desiredLifecycle: "scheduled" as const,
        }
        if (ambiguous) {
            await assert.rejects(
                syncScheduledDiscordEvent(input),
                /Lost response/
            )
            await assert.rejects(syncScheduledDiscordEvent(input), /uncertain/)
        } else {
            assert.equal(
                (await syncScheduledDiscordEvent(input)).scheduledEventId,
                "scheduled"
            )
            assert.equal(
                (await syncScheduledDiscordEvent(input)).scheduledEventId,
                "scheduled"
            )
        }
        assert.equal(creates, 1)
    })
}

test("a recovered active event can be rescheduled and its recovered replacement receives fresh metadata", async () => {
    let creates = 0
    const objects = new Map<
        string,
        {
            id: string
            status: GuildScheduledEventStatus
            edit(input: {
                status?: GuildScheduledEventStatus
                name?: string
            }): Promise<unknown>
        }
    >()
    const edits: Array<{ status?: GuildScheduledEventStatus; name?: string }> =
        []
    const guild = {
        id: "guild-1",
        scheduledEvents: {
            fetch: async (input: string | { guildScheduledEvent: string }) =>
                objects.get(
                    typeof input === "string"
                        ? input
                        : input.guildScheduledEvent
                ) ?? null,
            create: async () => {
                const object = {
                    id: `scheduled-${++creates}`,
                    status: GuildScheduledEventStatus.Scheduled,
                    edit: async (input: {
                        status?: GuildScheduledEventStatus
                        name?: string
                    }) => {
                        edits.push(input)
                        if (input.status) object.status = input.status
                        return object
                    },
                }
                objects.set(object.id, object)
                return object
            },
        },
    }
    const input = {
        guild: guild as never,
        event: baseEvent,
        content: { name: "Original", description: "Briefing" },
        meetingChannel: { id: "voice", type: ChannelType.GuildVoice } as never,
    }
    await syncScheduledDiscordEvent({ ...input, desiredLifecycle: "active" })
    const replaced = await syncScheduledDiscordEvent({
        ...input,
        desiredLifecycle: "scheduled",
    })
    assert.equal(replaced.scheduledEventId, "scheduled-2")
    await syncScheduledDiscordEvent({
        ...input,
        content: { name: "Updated", description: "New briefing" },
        desiredLifecycle: "scheduled",
    })
    assert.equal(creates, 2)
    assert.ok(
        edits.some(
            (edit) => edit.status === GuildScheduledEventStatus.Completed
        )
    )
    assert.equal(edits.at(-1)?.name, "Updated")
})

test("syncScheduledDiscordEvent edits existing scheduled events and tolerates edit failures", async () => {
    const scheduledEvent = {
        id: "sched-1",
        status: GuildScheduledEventStatus.Scheduled,
        edit: async (input: { status?: unknown }) => {
            if (input.status) {
                throw new Error("advance failed")
            }
            throw new Error("metadata failed")
        },
    }
    const guild = {
        id: "guild-1",
        scheduledEvents: {
            fetch: async () => scheduledEvent,
        },
    }

    const result = await syncScheduledDiscordEvent({
        guild: guild as never,
        event: baseEvent,
        content: { name: "Operation Test", description: "Briefing" },
        meetingChannel: {
            id: "voice-1",
            type: ChannelType.GuildVoice,
        } as never,
        scheduledEventId: "sched-1",
        desiredLifecycle: "active",
    })

    assert.deepEqual(result, {
        scheduledEventId: "sched-1",
        scheduledEventStatus: "scheduled",
    })
})

test("syncScheduledDiscordEvent never edits schedule fields after Discord activates an event", async () => {
    const edits: unknown[] = []
    const guild = {
        id: "guild-1",
        scheduledEvents: {
            fetch: async () => ({
                id: "sched-1",
                status: GuildScheduledEventStatus.Active,
                edit: async (input: unknown) => {
                    edits.push(input)
                    return {
                        id: "sched-1",
                        status: GuildScheduledEventStatus.Active,
                    }
                },
            }),
        },
    }

    const result = await syncScheduledDiscordEvent({
        guild: guild as never,
        event: { ...baseEvent, updatedAt: "event-v2" },
        content: { name: "Operation Test", description: "Briefing" },
        meetingChannel: {
            id: "voice-1",
            type: ChannelType.GuildVoice,
        } as never,
        scheduledEventId: "sched-1",
        desiredLifecycle: "active",
    })

    assert.deepEqual(result, {
        scheduledEventId: "sched-1",
        scheduledEventStatus: "active",
    })
    assert.deepEqual(edits, [])
})

test("syncScheduledDiscordEvent replaces an active Discord event when Logi is rescheduled", async () => {
    const edits: unknown[] = []
    const creates: unknown[] = []
    const guild = {
        id: "guild-1",
        scheduledEvents: {
            fetch: async () => ({
                id: "old-scheduled-event",
                status: GuildScheduledEventStatus.Active,
                edit: async (input: unknown) => {
                    edits.push(input)
                    return {
                        id: "old-scheduled-event",
                        status: GuildScheduledEventStatus.Completed,
                    }
                },
            }),
            create: async (input: unknown) => {
                creates.push(input)
                return {
                    id: "new-scheduled-event",
                    status: GuildScheduledEventStatus.Scheduled,
                    edit: async () => {
                        throw new Error("should not activate")
                    },
                }
            },
        },
    }

    const result = await syncScheduledDiscordEvent({
        guild: guild as never,
        event: {
            ...baseEvent,
            meetingStart: "2026-01-02T10:00:00.000Z",
            gameEnd: "2026-01-02T12:00:00.000Z",
        },
        content: { name: "Operation Test", description: "Briefing" },
        meetingChannel: {
            id: "voice-1",
            type: ChannelType.GuildVoice,
        } as never,
        scheduledEventId: "old-scheduled-event",
        desiredLifecycle: "scheduled",
    })

    assert.deepEqual(edits, [{ status: GuildScheduledEventStatus.Completed }])
    assert.equal(creates.length, 1)
    assert.deepEqual(result, {
        scheduledEventId: "new-scheduled-event",
        scheduledEventStatus: "scheduled",
    })
})

test("syncScheduledDiscordEvent keeps terminal Discord lifecycle when it matches Logi", async () => {
    const guild = {
        id: "guild-1",
        scheduledEvents: {
            fetch: async () => ({
                id: "sched-1",
                status: GuildScheduledEventStatus.Completed,
                edit: async () => {
                    throw new Error("should not edit")
                },
            }),
        },
    }

    const result = await syncScheduledDiscordEvent({
        guild: guild as never,
        event: baseEvent,
        content: { name: "Operation Test", description: "Briefing" },
        meetingChannel: {
            id: "voice-1",
            type: ChannelType.GuildVoice,
        } as never,
        scheduledEventId: "sched-1",
        desiredLifecycle: "completed",
    })

    assert.deepEqual(result, {
        scheduledEventId: "sched-1",
        scheduledEventStatus: "completed",
    })
})

test("cancelScheduledDiscordEvent returns false when missing and true when already terminal", async () => {
    const missing = await cancelScheduledDiscordEvent(
        {
            scheduledEvents: {
                fetch: async () => null,
            },
        } as never,
        "sched-404"
    )
    assert.equal(missing, false)

    const terminal = await cancelScheduledDiscordEvent(
        {
            scheduledEvents: {
                fetch: async () => ({
                    status: GuildScheduledEventStatus.Completed,
                    edit: async () => {
                        throw new Error("should not edit")
                    },
                }),
            },
        } as never,
        "sched-1"
    )
    assert.equal(terminal, true)
})

for (const code of [50013, 503, 404]) {
    test(`scheduled event lookup failure ${code} cannot create or clear an event`, async () => {
        const error = Object.assign(new Error("Discord unavailable"), { code })
        let creates = 0
        const guild = {
            id: "guild-1",
            scheduledEvents: {
                fetch: async () => {
                    throw error
                },
                create: async () => {
                    creates++
                    throw new Error("unexpected create")
                },
            },
        } as unknown as Parameters<typeof syncScheduledDiscordEvent>[0]["guild"]
        await assert.rejects(
            syncScheduledDiscordEvent({
                guild,
                event: baseEvent,
                content: { name: "Match", description: "" },
                meetingChannel: {
                    id: "voice",
                    type: ChannelType.GuildVoice,
                } as Parameters<
                    typeof syncScheduledDiscordEvent
                >[0]["meetingChannel"],
                scheduledEventId: "existing",
                desiredLifecycle: "scheduled",
            }),
            error
        )
        await assert.rejects(
            cancelScheduledDiscordEvent(guild, "existing"),
            error
        )
        assert.equal(creates, 0)
    })
}

test("explicit unknown scheduled event is treated as absent", async () => {
    const guild = {
        scheduledEvents: {
            fetch: async () => {
                throw { code: 10070 }
            },
        },
    }
    assert.equal(
        await cancelScheduledDiscordEvent(
            guild as unknown as Parameters<
                typeof cancelScheduledDiscordEvent
            >[0],
            "gone"
        ),
        false
    )
})
