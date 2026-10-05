import assert from "node:assert/strict"
import test from "node:test"

import {
    clanResult,
    competitionPlacements,
    isPublicUpcomingMatch,
    matchOpponent,
    parseDiscordInviteUrl,
    publicClanGames,
    publicInviteInputSchema,
    selectUpcomingPublicMatches,
    type PublicUpcomingMatch,
} from "./public-clan-page"
import type { PublicCompetition } from "../competitions/competition"

test("Discord invites are accepted in their usual forms and made canonical", () => {
    for (const input of [
        "https://discord.gg/abcDEF12",
        "discord.gg/abcDEF12",
        " https://discord.gg/abcDEF12/ ",
        "https://www.discord.gg/abcDEF12",
        "https://discord.com/invite/abcDEF12",
        "https://discordapp.com/invite/abcDEF12?event=1",
        "https://www.discord.com/invite/abcDEF12#top",
    ])
        assert.equal(
            parseDiscordInviteUrl(input),
            "https://discord.gg/abcDEF12",
            input
        )
    assert.equal(
        parseDiscordInviteUrl("https://discord.gg/my-clan"),
        "https://discord.gg/my-clan"
    )
})

test("anything that is not a Discord invite is refused", () => {
    for (const input of [
        "",
        "   ",
        "http://discord.gg/abcDEF12",
        "javascript:alert(1)",
        "https://discord.gg.evil.example/abc",
        "https://evil.example/discord.gg/abc",
        "https://discord.gg/",
        "https://discord.gg/a",
        "https://discord.gg/abc/def",
        "https://discord.com/abcDEF12",
        "https://discord.com/channels/1/2",
        "https://user:pw@discord.gg/abcDEF12",
        "https://discord.gg:8443/abcDEF12",
        "https://discord.gg/abc%20def",
        "https://discord.gg/" + "a".repeat(65),
        "https://discord.gg/" + "a".repeat(300),
    ])
        assert.equal(parseDiscordInviteUrl(input), null, input)
})

test("the invite setting accepts an invite or null and nothing else", () => {
    assert.deepEqual(
        publicInviteInputSchema.parse({ inviteUrl: "discord.gg/clan" }),
        { inviteUrl: "https://discord.gg/clan" }
    )
    assert.deepEqual(publicInviteInputSchema.parse({ inviteUrl: null }), {
        inviteUrl: null,
    })
    assert.deepEqual(publicInviteInputSchema.parse({ inviteUrl: "  " }), {
        inviteUrl: null,
    })
    assert.equal(
        publicInviteInputSchema.safeParse({ inviteUrl: "https://x.example" })
            .success,
        false
    )
    assert.equal(
        publicInviteInputSchema.safeParse({
            inviteUrl: "https://discord.gg/clan",
            extra: true,
        }).success,
        false
    )
    assert.equal(publicInviteInputSchema.safeParse({}).success, false)
})

test("only announced, published, future matches are public before they are played", () => {
    const now = Date.parse("2026-10-05T12:00:00Z")
    const base = {
        kind: "match" as const,
        gameStart: "2026-10-10T18:00:00Z",
        status: "registration",
    }
    assert.equal(isPublicUpcomingMatch(base, now), true)
    assert.equal(
        isPublicUpcomingMatch({ ...base, kind: undefined }, now),
        true,
        "legacy events without a kind are matches"
    )
    assert.equal(
        isPublicUpcomingMatch(
            { ...base, registrationStart: "2026-10-05T11:00:00Z" },
            now
        ),
        true
    )
    assert.equal(
        isPublicUpcomingMatch({ ...base, kind: "training" }, now),
        false
    )
    assert.equal(isPublicUpcomingMatch({ ...base, isDraft: true }, now), false)
    assert.equal(
        isPublicUpcomingMatch({ ...base, status: "concluded" }, now),
        false
    )
    assert.equal(
        isPublicUpcomingMatch(
            { ...base, registrationStart: "2026-10-06T11:00:00Z" },
            now
        ),
        false,
        "not announced yet"
    )
    assert.equal(
        isPublicUpcomingMatch({ ...base, registrationStart: "soon" }, now),
        false
    )
    assert.equal(
        isPublicUpcomingMatch(
            { ...base, gameStart: "2026-10-05T11:00:00Z" },
            now
        ),
        false,
        "already started"
    )
})

test("upcoming matches are re-checked against the current time and capped", () => {
    const match = (eventId: string, startsAt: string): PublicUpcomingMatch => ({
        eventId,
        gameId: "hell_let_loose",
        startsAt,
        opponent: null,
        name: eventId,
        label: null,
    })
    const now = Date.parse("2026-10-05T12:00:00Z")
    assert.deepEqual(
        selectUpcomingPublicMatches(
            [
                match("later", "2026-10-12T18:00:00Z"),
                match("started", "2026-10-05T11:00:00Z"),
                match("soon", "2026-10-06T18:00:00Z"),
                match("last", "2026-10-20T18:00:00Z"),
            ],
            now,
            2
        ).map((item) => item.eventId),
        ["soon", "later"]
    )
})

test("the opponent is named only when the clan's own team is in the match", () => {
    const team = (teamId: string, name: string) => ({
        teamId,
        snapshot: { name },
    })
    const own = new Set(["own"])
    assert.equal(
        matchOpponent([team("own", "VLK"), team("rog", "ROG")], own),
        "ROG"
    )
    assert.equal(
        matchOpponent(
            [team("own", "VLK"), team("a", "MNT"), team("b", "DEF")],
            own
        ),
        "MNT / DEF"
    )
    assert.equal(matchOpponent([team("a", "MNT"), team("b", "DEF")], own), null)
    assert.equal(matchOpponent([], own), null)
    assert.equal(matchOpponent([team("own", "VLK")], own), null)
})

test("imported results are shown from the clan's side", () => {
    const result = {
        sideA: "DEF",
        sideB: "Váš klan",
        outcome: "victory" as const,
        score: { sideA: 2, sideB: 3 },
    }
    assert.deepEqual(clanResult({ side: "Allies", result }), {
        outcome: "victory",
        clanScore: 3,
        opponentScore: 2,
        opponent: "DEF",
    })
    assert.deepEqual(
        clanResult({ result }),
        { outcome: "victory", clanScore: 3, opponentScore: 2, opponent: "DEF" },
        "side inferred from the outcome"
    )
    assert.deepEqual(
        clanResult({
            side: "axis",
            result: {
                sideA: "Axis",
                sideB: "Allies",
                outcome: "defeat",
                score: { sideA: 1, sideB: 4 },
            },
        }),
        { outcome: "defeat", clanScore: 1, opponentScore: 4, opponent: null }
    )
    assert.deepEqual(
        clanResult({
            result: {
                sideA: "ROG",
                sideB: "VLK",
                outcome: "draw",
                score: { sideA: 2, sideB: 2 },
            },
        }),
        { outcome: "draw", clanScore: 2, opponentScore: 2, opponent: null }
    )
})

function competition(
    divisions: PublicCompetition["divisions"],
    slug = "ecl-2026"
): PublicCompetition {
    return {
        id: "c1",
        gameId: "hell_let_loose",
        slug,
        name: "ECL",
        season: "2026",
        description: null,
        divisions,
    }
}
const team = (id: string, withdrawn = false) => ({
    id,
    name: id.toUpperCase(),
    shortCode: null,
    logoUrl: null,
    withdrawn,
})

test("a clan's placement is its place in the division table", () => {
    const placements = competitionPlacements(
        [
            competition([
                {
                    id: "d1",
                    name: "Divize 1",
                    teams: [team("mnt"), team("vlk"), team("def")],
                    fixtures: [
                        {
                            id: "f1",
                            phase: "league",
                            teamAId: "mnt",
                            teamBId: "vlk",
                            status: "final",
                            scoreA: 4,
                            scoreB: 1,
                        },
                        {
                            id: "f2",
                            phase: "league",
                            teamAId: "vlk",
                            teamBId: "def",
                            status: "final",
                            scoreA: 3,
                            scoreB: 2,
                        },
                    ],
                },
                {
                    id: "d2",
                    name: "Divize 2",
                    teams: [team("x")],
                    fixtures: [],
                },
            ]),
        ],
        new Set(["vlk"])
    )
    assert.deepEqual(placements, [
        {
            slug: "ecl-2026",
            name: "ECL",
            season: "2026",
            divisionName: "Divize 1",
            divisionCount: 2,
            position: 2,
            teamCount: 3,
        },
    ])
})

test("no place is claimed before a result and withdrawn teams are left out", () => {
    const placements = competitionPlacements(
        [
            competition([
                {
                    id: "d1",
                    name: "Liga",
                    teams: [team("vlk"), team("mnt")],
                    fixtures: [],
                },
            ]),
            competition(
                [
                    {
                        id: "d2",
                        name: "Liga",
                        teams: [team("vlk", true)],
                        fixtures: [],
                    },
                ],
                "old"
            ),
        ],
        new Set(["vlk"])
    )
    assert.equal(placements.length, 1)
    assert.equal(placements[0].position, null)
    assert.deepEqual(competitionPlacements([], new Set(["vlk"])), [])
})

test("clans from before game selection play Hell Let Loose", () => {
    assert.deepEqual(publicClanGames(undefined), ["hell_let_loose"])
    assert.deepEqual(publicClanGames([]), ["hell_let_loose"])
    assert.deepEqual(
        publicClanGames(["wardogs", "wardogs", "hell_let_loose"]),
        ["wardogs", "hell_let_loose"]
    )
})
