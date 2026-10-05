import assert from "node:assert/strict"
import test from "node:test"

import {
    buildServerStatusView,
    serverStatusNoConnectionsCard,
    serverStatusNotAllowedCard,
    serverStatusUnavailableCard,
    type ServerStatusRow,
} from "./server-status-view"
import { viewButtons, viewText } from "@/infrastructure/testing/discord-view"
import { getCommandMessages } from "@/lib/clan-language/commands"

const cs = getCommandMessages("cs")
const row = (overrides: Partial<ServerStatusRow>): ServerStatusRow => ({
    displayName: "Vlci #1",
    state: "online",
    freshness: "fresh",
    collecting: true,
    players: 17,
    capacity: 98,
    map: "Zestafona",
    observedAt: "2026-10-11T18:13:20Z",
    provider: "wardogs_warcon",
    ...overrides,
})
const url =
    "https://logi.example/cs/dashboard/servers/guilds:a/settings/game-servers"

test("the stored status shows chips, details, the link and the count in Czech (M3-22..24)", () => {
    const view = buildServerStatusView({
        copy: cs.serverStatus,
        language: "cs",
        locale: "cs-CZ",
        gameLabel: "Wardogs",
        rows: [
            row({}),
            row({
                displayName: "Vlci #2 Trénink",
                freshness: "stale",
                players: 12,
                capacity: 64,
                map: "Kaluga",
                provider: "wardogs_rcon",
            }),
            row({ displayName: "Vlci Event", collecting: false }),
        ],
        gameServersUrl: url,
    })
    assert.equal(view.ephemeral, true)
    assert.equal(view.accent, "clan")
    const text = viewText(view)
    assert.match(text, /STAV HERNÍCH SERVERŮ · WARDOGS/)
    assert.match(text, /### 3 servery klanu/)
    assert.match(text, /Uložený stav ze sběru dat, ne živá kontrola\./)
    assert.match(
        text,
        /\*\*Vlci #1\*\* · 🟢 \*\*Online\*\*\n17 \/ 98 hráčů · Zestafona · <t:\d+:R> · Warcon/
    )
    assert.match(
        text,
        /\*\*Vlci #2 Trénink\*\* · 🟡 \*\*Online · zastaralé\*\*\n12 \/ 64 hráčů · Kaluga · <t:\d+:R> · RCON/
    )
    assert.match(
        text,
        /\*\*Vlci Event\*\* · ⚪ \*\*Sběr vypnutý\*\*\nZapne se v Herních serverech/
    )
    assert.match(
        text,
        /Zobrazeny 3 ze 3 serverů\. Nejvýš 5, celý seznam je v Logi\./
    )
    assert.deepEqual(viewButtons(view), [
        { label: "Herní servery v Logi", link: url },
    ])
})

test("at most five servers are shown and the count says how many exist (M1-B09)", () => {
    const view = buildServerStatusView({
        copy: cs.serverStatus,
        language: "cs",
        locale: "cs-CZ",
        gameLabel: "Wardogs",
        rows: Array.from({ length: 7 }, (_, index) =>
            row({ displayName: `Server ${index}` })
        ),
    })
    const text = viewText(view)
    assert.match(text, /Server 4/)
    assert.doesNotMatch(text, /Server 5/)
    assert.match(text, /Zobrazeno 5 ze 7 serverů/)
    assert.match(text, /### 7 serverů klanu/)
})

test("offline, unknown and hostile names stay readable and harmless", () => {
    const text = viewText(
        buildServerStatusView({
            copy: cs.serverStatus,
            language: "cs",
            locale: "cs-CZ",
            gameLabel: "Wardogs",
            rows: [
                row({ state: "offline", displayName: "\u202e\n " }),
                row({
                    freshness: "unavailable",
                    map: "@everyone [x](https://evil.test)",
                    players: null,
                    capacity: null,
                }),
                row({ provider: "wardogs_public_directory" }),
            ],
        })
    )
    assert.match(text, /\*\*Herní server\*\* · 🔴 \*\*Offline\*\*/)
    assert.match(text, /⚪ \*\*Bez dat\*\*/)
    assert.doesNotMatch(text, /(^|[^\u200b])@everyone/)
    assert.doesNotMatch(text, /\[x\]\(https:\/\/evil/)
    assert.match(text, /\[Wardog Servers\]\(https:\/\/wardogservers\.com\)/)
})

test("not allowed names who may and where the live score is (M3-25)", () => {
    const text = viewText(
        serverStatusNotAllowedCard({
            copy: cs.serverStatus,
            extraRoles: cs.access.extraRoles,
            or: cs.access.or,
            roleIds: [],
            liveScoreChannelId: "300000000000000009",
        })
    )
    assert.match(
        text,
        /Stav serverů vidí jen správci Logi\nSprávci mají v Discordu oprávnění Administrator nebo Roli správců\. Živé skóre najdeš v <#300000000000000009>\./
    )
    assert.match(
        viewText(
            serverStatusNotAllowedCard({
                copy: cs.serverStatus,
                extraRoles: cs.access.extraRoles,
                or: cs.access.or,
                roleIds: ["100000000000000005"],
            })
        ),
        /Smí ho použít i <@&100000000000000005>\./
    )
})

test("nothing connected and unavailable are cards with the next step (M3-26, M3-27)", () => {
    const empty = serverStatusNoConnectionsCard({
        copy: cs.serverStatus,
        gameLabel: "Wardogs",
        gameServersUrl: url,
    })
    assert.match(
        viewText(empty),
        /Pro Wardogs klan nemá připojený žádný server\nServer připojíš v Logi → Herní servery\./
    )
    assert.deepEqual(viewButtons(empty), [
        { label: "Herní servery v Logi", link: url },
    ])
    assert.match(
        viewText(serverStatusUnavailableCard(cs.serverStatus)),
        /Stav serverů se teď nedá načíst\nZkus to za minutu\. Na herní servery to nemá vliv\./
    )
})

test("English and German replies use their own words", () => {
    for (const language of ["en", "de"] as const) {
        const copy = getCommandMessages(language).serverStatus
        const text = viewText(
            buildServerStatusView({
                copy,
                language,
                locale: language === "en" ? "en-GB" : "de-DE",
                gameLabel: "Wardogs",
                rows: [row({})],
            }),
            language
        )
        assert.doesNotMatch(text, /serverů|Zobrazen/)
        assert.match(text, new RegExp(copy.intro.replace(/\./g, "\\.")))
    }
})
