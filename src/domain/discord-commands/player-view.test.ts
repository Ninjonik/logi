import assert from "node:assert/strict"
import test from "node:test"

import {
    buildPlayerProfileView,
    playerLoadFailedCard,
    playerNotFoundCard,
    playerOptionLabel,
    playerProfileFromRow,
    type PlayerProfileData,
} from "./player-view"
import { viewButtons, viewText } from "@/infrastructure/testing/discord-view"
import { getCommandMessages } from "@/lib/clan-language/commands"

const cs = getCommandMessages("cs").player
const profile: PlayerProfileData = {
    name: "Hráč 17",
    avatar: "https://cdn.discordapp.com/avatars/1/a.png",
    assignment: { type: "member", status: "active", paused: false },
    score: 1240,
    matchesPlayed: 48,
    averages: {
        kills: 18.2,
        deaths: 13,
        killDeathRatio: 1.4,
        offense: 412,
        defense: 388,
        support: 520,
    },
    recentMatches: [
        {
            mapName: "Carentan",
            mapId: "carentan",
            endedAt: "2026-10-03T19:00:00Z",
            importedAt: "2026-10-03T21:00:00Z",
            kills: 21,
            deaths: 12,
            killDeathRatio: 1.75,
        },
        {
            mapName: null,
            mapId: "foy",
            endedAt: "2026-10-01T19:00:00Z",
            importedAt: "2026-10-01T21:00:00Z",
            kills: 15,
            deaths: 14,
            killDeathRatio: 1.07,
        },
    ],
    firstMatchAt: "2026-06-02T18:00:00Z",
}

test("the private profile names the game, the status and three numbers in Czech (M2-36..41)", () => {
    const view = buildPlayerProfileView({
        copy: cs,
        gameLabel: "Hell Let Loose",
        profile,
        locale: "cs-CZ",
        timeZone: "Europe/Prague",
        shareId: "player:share:17",
    })
    assert.equal(view.ephemeral, true)
    assert.equal(view.accent, "clan")
    assert.equal(view.header?.thumbnail?.url, profile.avatar)
    const text = viewText(view)
    assert.match(text, /HELL LET LOOSE · PROFIL HRÁČE/)
    assert.match(text, /### Hráč 17/)
    assert.match(text, /\*\*Člen · aktivní\*\*/)
    assert.match(
        text,
        /Skóre klanu \*\*1\u00a0240\*\* · Zápasy \*\*48\*\* · K\/D \*\*1,40\*\*/
    )
    assert.match(
        text,
        /Průměr na zápas: 18,2 zabití · 13,0 úmrtí · útok 412 · obrana 388 · podpora 520/
    )
    assert.match(text, /\*\*POSLEDNÍ ZÁPASY\*\*/)
    assert.match(
        text,
        /so 3\. 10\. · Carentan · 21 zabití, 12 úmrtí · K\/D 1,75/
    )
    assert.match(text, /čt 1\. 10\. · foy · 15 zabití, 14 úmrtí · K\/D 1,07/)
    assert.match(text, /Zdroj: importované zápasy klanu · 48 zápasů od 2\. 6\./)
    assert.doesNotMatch(text, /Spravováno|Kills|Recent matches|Member/)
    assert.deepEqual(viewButtons(view), [
        { label: "Sdílet", style: "primary", id: "player:share:17" },
    ])
})

test("the shared profile has no buttons and names who shared it and when (M2-42)", () => {
    const text = viewText(
        buildPlayerProfileView({
            copy: cs,
            gameLabel: "Hell Let Loose",
            profile,
            locale: "cs-CZ",
            timeZone: "Europe/Prague",
            shared: {
                userId: "100000000000000002",
                at: "2026-10-11T18:50:00Z",
            },
        })
    )
    assert.match(
        text,
        /Sdílel <@100000000000000002> · stav k ne <t:\d+:d> · <t:\d+:t>/
    )
    assert.match(text, /Importované zápasy klanu · Spravováno v Logi/)
    assert.doesNotMatch(text, /\[Sdílet\]/)
})

test("a profile without matches says so and offers nothing to share (M2-43)", () => {
    const view = buildPlayerProfileView({
        copy: cs,
        gameLabel: "Hell Let Loose",
        profile: {
            ...profile,
            name: "Hráč 23",
            assignment: { type: "member", status: "recruit" },
            matchesPlayed: 0,
            recentMatches: [],
            firstMatchAt: null,
        },
        locale: "cs-CZ",
        shareId: "player:share:23",
    })
    const text = viewText(view)
    assert.match(text, /\*\*Rekrut\*\*/)
    assert.match(
        text,
        /Zatím nemá žádné importované zápasy, takže tu není co ukázat ani sdílet\./
    )
    assert.match(text, /Zdroj: importované zápasy klanu$/m)
    assert.deepEqual(viewButtons(view), [])
})

test("the autocomplete reads name and clan status in the clan language (M2-35)", () => {
    assert.equal(
        playerOptionLabel(cs, {
            name: "Hráč 17",
            type: "member",
            status: "active",
        }),
        "Hráč 17 · Člen · aktivní"
    )
    assert.equal(
        playerOptionLabel(cs, { name: "Hráč 18", status: "recruit" }),
        "Hráč 18 · Rekrut"
    )
    assert.equal(
        playerOptionLabel(cs, {
            name: "Hráč 19",
            type: "member",
            status: "active",
            paused: true,
        }),
        "Hráč 19 · Člen · pozastavený"
    )
    assert.equal(
        playerOptionLabel(cs, {
            name: "Hráč 21",
            type: "mercenary",
            status: "active",
        }),
        "Hráč 21 · Žoldák · aktivní"
    )
    assert.equal(
        playerOptionLabel(getCommandMessages("de").player, {
            name: "Spieler",
            type: "member",
            status: "active",
        }),
        "Spieler · Mitglied · aktiv"
    )
})

test("not found and load failures are the shared error cards (M2-44, M2-45)", () => {
    assert.match(
        viewText(playerNotFoundCard(cs)),
        /Tohoto hráče v klanu nenacházím\n[\s\S]*Vyber hráče z nabídky, která se ukáže při psaní jména\./
    )
    assert.match(
        viewText(playerLoadFailedCard(cs)),
        /Profil se teď nedá načíst\nZkus to za chvíli znovu\./
    )
})

test("the stored clan profile maps to the card's data with safe defaults", () => {
    const data = playerProfileFromRow({
        name: "X",
        assignment: { type: "member", status: "active" },
        performance: null,
        recentMatches: null,
    })
    assert.equal(data.matchesPlayed, 0)
    assert.equal(data.averages.killDeathRatio, 0)
    assert.deepEqual(data.recentMatches, [])
})
