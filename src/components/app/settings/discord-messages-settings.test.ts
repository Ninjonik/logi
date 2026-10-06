import { renderToStaticMarkup } from "react-dom/server"
import { NextIntlClientProvider } from "next-intl"
import assert from "node:assert/strict"
import { createElement } from "react"
import test from "node:test"

import {
    BOARD_EVENT_CATEGORIES,
    BOARD_PANEL_CHANNELS,
    boardPanelOverview,
} from "@/infrastructure/testing/panel-overview"
import { getDictionary } from "@/i18n/dictionaries"
import type { DiscordConfig } from "@/types/domain"
import { enMessages } from "@/i18n/messages/en"
import { deMessages } from "@/i18n/messages/de"
import { csMessages } from "@/i18n/messages/cs"

import {
    DiscordMessagesSettingsView,
    type Overview,
} from "./discord-messages-settings"

const config = {
    id: "c1",
    guildId: "111111111111111111",
    timezone: "Europe/Prague",
    defaultLanguage: "cs",
    announcementsChannelId: "201",
    eventInfoChannelId: "202",
    errorsChannelId: "203",
    calendarChannelId: "204",
    calendarCategories: ["Zápas", "Liga"],
    forumCategoryId: "205",
    meetingChannelId: "206",
    squadVoiceCategoryId: "207",
    gameOverrides: { wardogs: { announcementsChannelId: "208" } },
    attendanceNoticesInThread: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
} as unknown as DiscordConfig

const channels = [
    { id: "201", name: "oznameni", type: 0 },
    { id: "202", name: "info-akce", type: 0 },
    { id: "203", name: "logi-chyby", type: 0 },
    { id: "204", name: "kalendar", type: 0 },
    { id: "205", name: "Akce", type: 4 },
    { id: "206", name: "Sraz", type: 2 },
    { id: "207", name: "Čety", type: 4 },
    { id: "208", name: "wd-zapasy", type: 0 },
    ...BOARD_PANEL_CHANNELS,
]

// The board's panels as "Panely v Discordu" reports them (P1 overview).
const overview: Overview = {
    status: "ready",
    panels: boardPanelOverview(Date.parse("2026-10-05T16:00:00.000Z")),
    seed: { configured: true, enabled: true },
}

function render(locale: "cs" | "en" | "de" = "cs") {
    const dictionary = getDictionary(locale)
    return renderToStaticMarkup(
        // The provider's types require `children` among its props.
        // eslint-disable-next-line react/no-children-prop
        createElement(NextIntlClientProvider, {
            locale,
            messages: dictionary,
            timeZone: "Europe/Prague",
            children: createElement(DiscordMessagesSettingsView, {
                serverId: "s1",
                config,
                enabledGames: ["hell_let_loose", "wardogs"],
                siteUrl: "https://logi.example",
                hrefs: {
                    channels: "/cs/x/channels",
                    matchTemplates: "/cs/x/match-templates",
                    commands: "/cs/x/commands",
                    membership: "/cs/x/membership",
                    tickets: "/cs/x/tickets",
                    factionSigns:
                        "/cs/x/panel-graphics#panel-graphics-factions",
                    league: "/cs/x/league",
                    accountMessages: "/cs/dashboard/settings/user",
                    panels: "/cs/x/discord-panels",
                    seed: "/cs/x/discord-seed",
                },
                categories: BOARD_EVENT_CATEGORIES,
                dictionary,
                channels,
                channelsStatus: "ready",
                overview,
                onSaved: () => undefined,
                onPanelsChanged: () => undefined,
            }),
        })
    )
}

const text = (html: string) =>
    html
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")

test("the page shows the board's sections and rows in Czech (N1-02..44)", () => {
    const page = text(render())
    for (const copy of [
        "Zprávy a panely v Discordu",
        "Všechno, co bot posílá: kam, jestli vůbec a jak to vypadá. Píše v jazyce klanu a s barvou klanu.",
        "Vzhled všech zpráv",
        "Platí pro ohlášení, panely, DM i odpovědi příkazů. Chyby bota pro správce mají šedý pruh.",
        "Barva klanu",
        "Výchozí barva Logi. Kategorie akce se ukáže jako štítek, pruh nemění.",
        "Ikony ve zprávách",
        "Střídmé",
        "Emoji u každého řádku",
        "Znaky frakcí",
        "Výchozí znaky Logi",
        "Změnit znaky",
        "Čeština",
        "Živý náhled",
        "Ohlášení zápasu se střídmými ikonami. Mění se s barvou a ikonami vlevo.",
        "Co bot posílá",
        "Ohlášení zápasu",
        "Soupiska",
        "Výchozí podoba",
        "Při publikování jde změnit. Jinak: Jen fotka.",
        "Změny soupisky",
        "Fórum zápasu",
        "Debrief ve fóru",
        "Omluvy a zpoždění ve vlákně zápasu",
        "Nové",
        "Událost na Discordu",
        "Role a hlasové kanály čet",
        "Soukromé zprávy · DM a odpovědi, které vidí jen jeden člověk",
        "Připomínka přihlášky",
        "Připomínka docházky",
        "Shrnutí zápasu",
        "Výsledek tréninku",
        "Změna zařazení",
        "Žádost o tým",
        "Odpovědi na tlačítka",
        "Odpovědi příkazů",
        "Panely",
        "Přidat panel",
        // Every panel of "Panely v Discordu" with its state (N1-29..36).
        "Vlci #1 · Public",
        "Živý server · obnovuje se každých 60 s · tlačítka Připojit se, Zobrazit hráče a Nahlásit hráče",
        "Vlci #2 · Trénink a zápasy",
        "Živý server v soukromém kanálu · ukazuje i heslo serveru",
        "Vlci WD",
        "Chyba",
        "Bot nemá oprávnění Vkládat odkazy v #servery-wd",
        "Naše servery",
        "Neodesláno",
        "Vlci #1, Vlci #2 a Vlci WD v jedné zprávě",
        "Ovládání serveru",
        "Seed, Obnovit a Pozastavit · smí jen Správci Logi",
        "Výsledky HLL",
        "Po potvrzení výsledku v Logi · po vytvoření pošle posledních 5 potvrzených",
        "WD League",
        "Dvě zprávy pod sebou: tabulka a nejbližší zápasy celé ligy · obnovují se každých 60 s",
        "Kalendář",
        "Pozastaveno",
        "Nadcházející akce klanu, kategorie Zápas a Liga · pozastavil Hráč 01",
        "Členství a tickety",
        "Panel náboru",
        "Tlačítko Podat přihlášku",
        "Přihláška do klanu",
        "Uzavření přihlášky",
        "Panel ticketů",
        "Ticket",
        "Uzavření ticketu",
        "Nahlášení hráče",
        "Systém",
        "Chyby bota",
        "Co bot nemohl udělat a jak to opravit · jen pro správce · šedý pruh",
    ])
        assert.ok(page.includes(copy), copy)
    // The live preview draws the announcement with the bot's words.
    assert.match(page, /VLK vs ROG/)
    assert.match(page, /Přihlásit se/)
    // Channels: the clan-wide one, the game's own one and the owning page.
    assert.match(page, /oznameni/)
    assert.match(page, /wd-zapasy/)
    assert.match(page, /z Kanály a jazyk/)
    assert.match(page, /kategorie Akce/)
})

test("every switch and the errors channel picker have their board names (N1-45a)", () => {
    const html = render()
    for (const label of [
        "Změny soupisky předvolit",
        "Debrief ve fóru",
        "Omluvy a zpoždění ve vlákně zápasu",
        "Událost na Discordu",
        "Shrnutí zápasu",
        "Výsledek tréninku",
        "Změna zařazení předvolit",
        "DM žadateli po uzavření přihlášky",
        "DM autorovi po uzavření ticketu",
        "Panel Vlci #1 · Public",
        "Panel Vlci #2 · Trénink a zápasy",
        "Panel Vlci WD",
        "Panel Naše servery",
        "Ovládání serveru",
        "Panel Výsledky HLL",
        "Panely WD League",
        "Panel Kalendář",
    ])
        assert.ok(html.includes(`aria-label="${label}"`), label)
    assert.match(html, /Kanál pro chyby bota/)
    // The attendance post is off by default; the others are on (N1-B06).
    assert.match(
        html,
        /aria-checked="false"[^>]*aria-label="Omluvy a zpoždění ve vlákně zápasu"|aria-label="Omluvy a zpoždění ve vlákně zápasu"[^>]*aria-checked="false"/
    )
    assert.match(
        html,
        /aria-checked="true"[^>]*aria-label="Debrief ve fóru"|aria-label="Debrief ve fóru"[^>]*aria-checked="true"/
    )
})

test("every locale renders the page", () => {
    assert.match(text(render("en")), /Messages and panels in Discord/)
    assert.match(text(render("de")), /Nachrichten und Panels in Discord/)
})

/** Every leaf key of a nested object. */
function keys(value: unknown, path = ""): string[] {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return [path]
    return Object.entries(value).flatMap(([key, child]) =>
        keys(child, path ? `${path}.${key}` : key)
    )
}

test("the page copy has the same keys in cs, en and de", () => {
    const cs = keys(csMessages.settingsHub.messagesPage).sort()
    assert.deepEqual(keys(enMessages.settingsHub.messagesPage).sort(), cs)
    assert.deepEqual(keys(deMessages.settingsHub.messagesPage).sort(), cs)
})

test("the panel rows link to their editor and keep the paused calendar off", () => {
    const html = render()
    assert.match(html, /href="\/cs\/x\/discord-panels\/p-v1"/)
    assert.match(html, /href="\/cs\/x\/discord-seed"/)
    assert.match(
        html,
        /aria-checked="false"[^>]*aria-label="Panel Kalendář"|aria-label="Panel Kalendář"[^>]*aria-checked="false"/
    )
    // The "Nahlásit hráče" row names the ticket category the panels use.
    assert.doesNotMatch(text(html), /event-category-/)
})
