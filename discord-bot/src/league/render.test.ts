import { parseMatchHtml } from "../../../src/infrastructure/wardogs-league/parse-match"
import { renderLeagueCard, humanLeagueInput } from "./render"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
test("compact card binds teams to factions and keeps vote deadline separate from match start", () => {
    const snapshot = {
        ...parseMatchHtml(
            readFileSync(
                new URL(
                    "../../../src/infrastructure/wardogs-league/fixtures/scheduled.html",
                    import.meta.url
                ),
                "utf8"
            ),
            "https://wardogsleague.net/matches/cmuqt8ep605e1lf018w2nlywu"
        ),
        fetchedAt: "2026-10-03T12:00:00Z",
    }
    const message = renderLeagueCard(
        {
            id: snapshot.id,
            guildId: "123",
            gameId: "wardogs",
            eventId: null,
            revision: "1",
            state: "tracked",
            snapshot,
            stale: false,
            ageSeconds: 0,
            lastAttemptAt: null,
            error: null,
        },
        undefined,
        { valkyra: "<:valkyra:123456789012345678>" }
    )
    const text = JSON.stringify(message)
    assert.match(text, /<:valkyra:123456789012345678>/)
    assert.match(text, /VLK.*Valkyra/)
    assert.match(text, /ROG.*Manticore/)
    assert.match(text, /BAMC.*Lonestar/)
    assert.match(
        text,
        new RegExp(String(Math.floor(Date.parse(snapshot.scheduledAt!) / 1000)))
    )
    assert.doesNotMatch(text, /Winner|1st place|displayedMemberCount/)
    assert.deepEqual(message.allowedMentions, { parse: [] })
})
test("human intake rejects bots, webhooks, DMs and unconfigured rooms", () => {
    const source = {
        guildId: "guild",
        channelId: "room",
        bot: false,
        webhookId: null,
        content: "https://wardogsleague.net/matches/abc",
    }
    assert.deepEqual(humanLeagueInput(source, "room"), [
        "https://wardogsleague.net/matches/abc",
    ])
    assert.equal(humanLeagueInput({ ...source, bot: true }, "room"), null)
    assert.equal(
        humanLeagueInput({ ...source, webhookId: "hook" }, "room"),
        null
    )
    assert.equal(humanLeagueInput({ ...source, guildId: null }, "room"), null)
    assert.equal(humanLeagueInput(source, "other"), null)
})

test("received human edits remain available for backend receipt cleanup after intake moves or disables", () => {
    const edit = {
        guildId: "guild",
        channelId: "old-room",
        bot: false,
        webhookId: null,
        content: "Removed the link",
    }
    assert.deepEqual(humanLeagueInput(edit, "new-room", true), [])
    assert.deepEqual(humanLeagueInput(edit, null, true), [])
    assert.equal(humanLeagueInput(edit, "new-room"), null)
    assert.equal(humanLeagueInput({ ...edit, bot: true }, null, true), null)
    assert.equal(
        humanLeagueInput({ ...edit, webhookId: "hook" }, null, true),
        null
    )
})
test("League cards use the clan language for labels, footer and button", () => {
    const snapshot = {
        ...parseMatchHtml(
            readFileSync(
                new URL(
                    "../../../src/infrastructure/wardogs-league/fixtures/scheduled.html",
                    import.meta.url
                ),
                "utf8"
            ),
            "https://wardogsleague.net/matches/cmuqt8ep605e1lf018w2nlywu"
        ),
        fetchedAt: "2026-10-03T12:00:00Z",
    }
    const fixture = {
        id: snapshot.id,
        guildId: "123",
        gameId: "wardogs" as const,
        eventId: null,
        revision: "1",
        state: "tracked" as const,
        snapshot,
        stale: false,
        ageSeconds: 0,
        lastAttemptAt: null,
        error: null,
    }
    const czech = JSON.stringify(renderLeagueCard(fixture, undefined, {}, "cs"))
    assert.match(czech, /"title":"Zápas /)
    assert.match(czech, /Kontrola připravenosti/)
    assert.match(czech, /Otevřít na webu ligy/)
    assert.match(czech, /Zdroj ověřen/)
    assert.doesNotMatch(czech, /View match|Preparation|Source checked/)
    assert.match(
        JSON.stringify(renderLeagueCard(fixture)),
        /"title":"Match #.*View match/
    )
})
