import assert from "node:assert/strict"
import test from "node:test"

import { buildICalendarFeed } from "./ical-feed"

test("buildICalendarFeed exports scheduled events and recurring manual calendar items", () => {
    const feed = buildICalendarFeed({
        clanName: "Logi, Test Clan",
        now: new Date("2026-01-01T00:00:00.000Z"),
        events: [
            {
                id: "event-1",
                guildId: "guild-1",
                kind: "match",
                name: "Saturday, match",
                description: "Meet in Discord\\ready room",
                registrationEnd: "2026-02-01T18:00:00.000Z",
                meetingStart: "2026-02-01T19:00:00.000Z",
                gameStart: "2026-02-01T19:30:00.000Z",
                gameEnd: "2026-02-01T21:00:00.000Z",
                pingClan: false,
                requiredRoleIds: [],
                rewardRoleIds: [],
                createForumChannel: false,
                stratmapIds: [],
                status: "registration",
                statusUpdatedAt: "2026-01-01T00:00:00.000Z",
                attendanceReminderLog: [],
                participants: [],
                signUps: [],
                absenceNotices: [],
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
            },
        ],
        calendarItems: [
            {
                id: "item-1",
                guildId: "guild-1",
                title: "UC SotM",
                startAt: "2026-02-03T00:00:00.000Z",
                endAt: "2026-02-03T23:59:00.000Z",
                allDay: true,
                color: "#000000",
                recurrence: { frequency: "monthly_date", interval: 1 },
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
            },
        ],
    })

    assert.match(feed, /X-WR-CALNAME:Logi\\, Test Clan/)
    assert.match(feed, /UID:logi-event-event-1@logi/)
    assert.match(feed, /SUMMARY:Saturday\\, match/)
    assert.match(feed, /DESCRIPTION:Meet in Discord\\\\ready room/)
    assert.match(feed, /UID:logi-calendar-item-item-1@logi/)
    assert.match(feed, /DTSTART;VALUE=DATE:20260203/)
    assert.match(feed, /DTEND;VALUE=DATE:20260204/)
    assert.match(feed, /RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=3/)
})
