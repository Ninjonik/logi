import { buildCreateEventRecord, buildUpdateEventPatch } from "./upsert-policy"
import { eventDiscussionDefaults, validateEventDiscussion } from "./discussion"
import assert from "node:assert/strict"
import { test } from "node:test"

const input = {
    guildId: "guild",
    name: "Match",
    kind: "match" as const,
    registrationEnd: "2030-01-01T18:00:00Z",
    meetingStart: "2030-01-01T18:00:00Z",
    gameStart: "2030-01-01T18:30:00Z",
    gameEnd: "2030-01-01T20:00:00Z",
    pingClan: false,
    createForumChannel: true,
}
const now = new Date("2029-01-01T00:00:00Z")
test("clan defaults inherit per field and game overrides preserve false", () => {
    const config = {
        eventDiscussionDefaults: {
            createForumChannel: true,
            deleteForumAfterConclusion: true,
            debriefDestination: "debrief_forum" as const,
            debriefForumChannelId: "111",
        },
        gameOverrides: {
            wardogs: {
                eventDiscussionDefaults: {
                    deleteForumAfterConclusion: false,
                    debriefForumChannelId: "222",
                },
            },
        },
    }
    assert.deepEqual(eventDiscussionDefaults(config, "wardogs"), {
        ...config.eventDiscussionDefaults,
        deleteForumAfterConclusion: false,
        debriefForumChannelId: "222",
    })
    assert.deepEqual(
        eventDiscussionDefaults(config, "hell_let_loose"),
        config.eventDiscussionDefaults
    )
    assert.deepEqual(eventDiscussionDefaults(null, "wardogs"), {})
})
test("inside-forum debrief requires forum creation and retention at every writer", () => {
    assert.throws(
        () =>
            buildCreateEventRecord(
                { ...input, debriefDestination: "event_forum" },
                now
            ),
        /retained/
    )
    assert.throws(
        () =>
            buildCreateEventRecord(
                {
                    ...input,
                    createForumChannel: false,
                    debriefDestination: "event_forum",
                    deleteForumAfterConclusion: false,
                },
                now
            ),
        /retained/
    )
    const saved = buildCreateEventRecord(
        {
            ...input,
            debriefDestination: "event_forum",
            deleteForumAfterConclusion: false,
        },
        now
    )
    assert.throws(
        () =>
            buildUpdateEventPatch(
                saved,
                { ...input, deleteForumAfterConclusion: true },
                now
            ),
        /retained/
    )
    assert.throws(
        () =>
            buildUpdateEventPatch(
                saved,
                { ...input, createForumChannel: false },
                now
            ),
        /retained/
    )
    assert.equal(
        buildUpdateEventPatch(
            saved,
            {
                ...input,
                deleteForumAfterConclusion: true,
                debriefDestination: "results_thread",
            },
            now
        ).deleteForumAfterConclusion,
        true
    )
})
test("dedicated debrief requires a forum and supports either cleanup choice", () => {
    assert.throws(
        () => validateEventDiscussion({ debriefDestination: "debrief_forum" }),
        /Select/
    )
    for (const deleteForumAfterConclusion of [true, false]) {
        const saved = buildCreateEventRecord(
            {
                ...input,
                debriefDestination: "debrief_forum",
                debriefForumChannelId: "123",
                deleteForumAfterConclusion,
            },
            now
        )
        assert.equal(saved.debriefForumChannelId, "123")
        assert.equal(
            buildUpdateEventPatch(saved, input, now).debriefDestination,
            undefined
        )
        assert.equal(
            buildUpdateEventPatch(saved, input, now).debriefForumChannelId,
            undefined
        )
    }
    assert.doesNotThrow(() =>
        validateEventDiscussion({
            createDebriefThread: false,
            debriefDestination: "debrief_forum",
        })
    )
})
test("new matches use results discussions while legacy edits preserve missing destinations", () => {
    assert.equal(
        buildCreateEventRecord(input, now).debriefDestination,
        "results_thread"
    )
    assert.equal(
        buildUpdateEventPatch({ ...input, participants: [] }, input, now)
            .debriefDestination,
        undefined
    )
})
