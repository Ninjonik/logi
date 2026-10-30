import { clanFixtures, SAMPLE_ID, sampleMetadata } from "./clan-fixtures"
import assert from "node:assert/strict"
import { test } from "node:test"

test("sample clan is populated and internally linked without persisted identifiers", () => {
    const now = new Date("2030-04-12T12:00:00Z")
    const data = clanFixtures(now)
    const users = new Set(data.users.map((user) => user.discordId))
    assert.equal(data.guild.id, SAMPLE_ID)
    assert.equal(users.size, 4)
    assert.equal(data.assignments.length, users.size)
    assert.ok(data.groups.length > 0)
    for (const event of data.events) {
        assert.equal(event.guildId, SAMPLE_ID)
        assert.ok(event.signUps.length > 0)
        assert.ok(event.signUps.every((signup) => users.has(signup.userId)))
    }
    assert.equal(data.roster.eventId, data.upcoming.id)
    assert.ok(data.roster.squads.every((squad) => squad.players.length > 0))
    assert.ok(new Date(data.upcoming.gameStart) > now)
    assert.ok(new Date(data.previous.gameEnd) < now)
    assert.equal(data.previous.status, "concluded")
    assert.equal(data.previous.eventResult?.outcome, "victory")
    assert.ok(data.performance.length > 1)
    assert.ok(
        sampleMetadata.channels.some(
            (channel) => channel.id === data.config.eventInfoChannelId
        )
    )
})

test("sample dates follow the tour clock deterministically", () => {
    const first = clanFixtures(new Date("2030-01-01T00:00:00Z"))
    const later = clanFixtures(new Date("2030-01-02T00:00:00Z"))
    assert.deepEqual(first, clanFixtures(new Date("2030-01-01T00:00:00Z")))
    assert.equal(
        new Date(later.upcoming.gameStart).getTime() -
            new Date(first.upcoming.gameStart).getTime(),
        86400000
    )
})
