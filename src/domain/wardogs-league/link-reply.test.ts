import { leagueSnapshotFixture } from "../../infrastructure/testing/league-fixtures"
import { leagueLinkReply } from "./link-reply"
import assert from "node:assert/strict"
import test from "node:test"

const base = {
    source: "human" as const,
    accepted: true,
    alreadyReplied: false,
    inputChannelId: "100000000000000001",
    panelChannelId: "100000000000000002",
    panelMessageUrl:
        "https://discord.com/channels/1/100000000000000002/100000000000000003",
    match: leagueSnapshotFixture(),
}

test("a human link in the links channel gets one reply pointing to the panel", () => {
    assert.deepEqual(leagueLinkReply(base), {
        reply: true,
        view: {
            matchId: "cmuqt8ep605e1lf018w2nlywu",
            sourceUrl:
                "https://wardogsleague.net/matches/cmuqt8ep605e1lf018w2nlywu",
            fixtureNumber: 38,
            teamCodes: ["VLK", "ROG", "BAMC"],
            scheduledAt: "2026-10-10T18:30:00.000Z",
            panelChannelId: "100000000000000002",
            panelMessageUrl: base.panelMessageUrl,
        },
    })
})

test("no reply for scanner finds, the panel channel itself, repeats, refusals or missing data (L3-57)", () => {
    const cases = [
        [{ source: "scanner" as const }, "not_human"],
        [{ source: "admin" as const }, "not_human"],
        [{ accepted: false }, "not_accepted"],
        [{ alreadyReplied: true }, "already_replied"],
        [{ panelChannelId: null }, "no_panel"],
        [{ inputChannelId: base.panelChannelId }, "same_channel"],
        [{ match: null }, "waiting_for_data"],
        [{ match: { ...base.match, teams: null } }, "waiting_for_data"],
    ] as const
    for (const [patch, reason] of cases)
        assert.deepEqual(leagueLinkReply({ ...base, ...patch }), {
            reply: false,
            reason,
        })
})
