import assert from "node:assert/strict"
import test from "node:test"

import {
    ANNOUNCEMENT_LAYOUT_VERSION,
    ANNOUNCEMENT_MIGRATIONS_PER_MINUTE,
    announcementMigrationScanStart,
    hasMigratableMessage,
    isAnnouncementMigrationDue,
    takeMigrationToken,
} from "./announcement-migration"

const now = new Date("2026-10-20T12:00:00.000Z")
const due = (gameEnd: string, patch = {}) =>
    isAnnouncementMigrationDue({
        gameEnd,
        now,
        hasMessage: true,
        layoutVersion: null,
        version: ANNOUNCEMENT_LAYOUT_VERSION,
        ...patch,
    })

test("upcoming matches and matches ended in the last 14 days are redrawn (L1-147, L1-148)", () => {
    assert.equal(due("2026-10-25T20:00:00.000Z"), true)
    assert.equal(due("2026-10-07T12:00:00.000Z"), true)
    assert.equal(due("2026-10-06T11:59:00.000Z"), false)
    assert.equal(due("not a date"), false)
})

test("a card is redrawn once: the stored layout marks it done; no card, nothing to do (L1-B20)", () => {
    assert.equal(
        due("2026-10-25T20:00:00.000Z", {
            layoutVersion: ANNOUNCEMENT_LAYOUT_VERSION,
        }),
        false
    )
    assert.equal(
        due("2026-10-25T20:00:00.000Z", { layoutVersion: "old" }),
        true
    )
    assert.equal(due("2026-10-25T20:00:00.000Z", { hasMessage: false }), false)
})

test("a match whose announcement the old bot removed is redrawn through its roster card or forum post, once (L1-147, L1-B20)", () => {
    assert.equal(hasMigratableMessage(null), false)
    assert.equal(hasMigratableMessage({}), false)
    assert.equal(hasMigratableMessage({ announcementMessageId: "1" }), true)
    // The roster card in the roster channel, without an announcement.
    assert.equal(hasMigratableMessage({ eventInfoMessageId: "2" }), true)
    // Only the forum's "Informace o zápasu" post.
    assert.equal(hasMigratableMessage({ infoMessageId: "3" }), true)
    // Recorded after the redraw: never queued again.
    assert.equal(
        due("2026-10-25T20:00:00.000Z", {
            migrationVersion: ANNOUNCEMENT_LAYOUT_VERSION,
        }),
        false
    )
    assert.equal(
        due("2026-10-25T20:00:00.000Z", { migrationVersion: "old" }),
        true
    )
})

test("redraws are limited to a few per minute (L1-151)", () => {
    let bucket = null as Parameters<typeof takeMigrationToken>[0]
    let allowed = 0
    for (let index = 0; index < 20; index += 1) {
        const result = takeMigrationToken(bucket, 0)
        bucket = result.bucket
        if (result.allowed) allowed += 1
    }
    assert.equal(allowed, ANNOUNCEMENT_MIGRATIONS_PER_MINUTE)
    // Ten seconds later one more is allowed, a minute later the full batch.
    assert.equal(takeMigrationToken(bucket, 10_000).allowed, true)
    let later = takeMigrationToken(bucket, 70_000).bucket
    let again = 0
    for (let index = 0; index < 20; index += 1) {
        const result = takeMigrationToken(later, 70_000)
        later = result.bucket
        if (result.allowed) again += 1
    }
    assert.ok(again >= ANNOUNCEMENT_MIGRATIONS_PER_MINUTE - 1)
    assert.ok(again <= ANNOUNCEMENT_MIGRATIONS_PER_MINUTE)
})

test("a bounded read starts a day before the window, so the rule still sees every due match", () => {
    const start = announcementMigrationScanStart(now)
    assert.equal(start, "2026-10-05T12:00:00.000Z")
    // Every match the rule may accept sorts after the scan start, including
    // an end written with a UTC offset, whose text sorts by its local time:
    // 02:30 at -10:00 is 12:30 UTC, inside the window, yet its text sorts
    // before the window's own start.
    for (const gameEnd of [
        "2026-10-06T12:00:00.000Z",
        "2026-10-06T12:00:00Z",
        "2026-10-06T02:30:00-10:00",
        "2026-10-07T01:00:00+12:00",
        "2026-10-25T20:00:00.000Z",
    ]) {
        assert.ok(gameEnd >= start, gameEnd)
        assert.ok(due(gameEnd), gameEnd)
    }
    // A match the rule rejects for its age may still be read: the bound is
    // a superset, never a substitute for the rule.
    assert.ok("2026-10-06T11:00:00.000Z" >= start)
    assert.equal(due("2026-10-06T11:00:00.000Z"), false)
    assert.ok("2026-10-05T11:00:00.000Z" < start)
})
