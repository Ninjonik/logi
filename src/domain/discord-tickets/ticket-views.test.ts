import assert from "node:assert/strict"
import test from "node:test"

import {
    closedTicketThreadName,
    quotedReason,
    ticketAlreadyClosedCard,
    ticketClosedDmView,
    ticketClosedReplyView,
    ticketClosedView,
    ticketCloseNotAllowedCard,
    ticketCloseNotTicketCard,
    ticketCloseOutsideCard,
    ticketCloseUnverifiableCard,
    ticketFailedCard,
    ticketIntroMentions,
    ticketIntroView,
    ticketOpenedView,
    ticketPanelView,
    ticketsDisabledCard,
    ticketThreadName,
} from "./ticket-views"
import {
    layoutForTest,
    viewButtons,
    viewText,
} from "@/infrastructure/testing/discord-view"
import { getTicketMessages } from "@/lib/clan-language/tickets"

const cs = getTicketMessages("cs")
const categories = [
    {
        id: "report",
        label: "Nahlásit hráče",
        description: "chování na serveru",
    },
    {
        id: "role",
        label: "Žádost o roli",
        description: "tank, recon, velení",
    },
    { id: "bot", label: "Problém s botem", description: "něco nefunguje" },
    { id: "other", label: "Jiné", description: "cokoli dalšího" },
]
const ADMINI = "200000000000000001"
const AUTHOR = "100000000000000017"
const CLOSER = "100000000000000002"

test("the panel: heading, text, category lines, grey buttons and 'Spravováno v Logi' (L4-35..37)", () => {
    const view = ticketPanelView({
        title: "Potřebuješ pomoc?",
        description:
            "Vyber, s čím potřebuješ pomoct. Otevře se soukromé vlákno, které vidíš jen ty a správci.",
        categories,
        copy: cs,
        managedUrl: "https://logi.example",
    })
    const text = viewText(view)
    assert.match(text, /### Potřebuješ pomoc\?/)
    assert.match(
        text,
        /Vyber, s čím potřebuješ pomoct\. Otevře se soukromé vlákno, které vidíš jen ty a správci\./
    )
    assert.match(
        text,
        /\*\*Nahlásit hráče\*\* · chování na serveru\n\*\*Žádost o roli\*\* · tank, recon, velení\n\*\*Problém s botem\*\* · něco nefunguje\n\*\*Jiné\*\* · cokoli dalšího/
    )
    assert.match(text, /-# \[Spravováno v Logi\]\(https:\/\/logi\.example\)/)
    assert.deepEqual(viewButtons(view), [
        { label: "Nahlásit hráče", style: "secondary", id: "ticket:report" },
        { label: "Žádost o roli", style: "secondary", id: "ticket:role" },
        { label: "Problém s botem", style: "secondary", id: "ticket:bot" },
        { label: "Jiné", style: "secondary", id: "ticket:other" },
    ])
    assert.equal(view.accent, "clan")
    assert.deepEqual(
        ticketPanelView({
            title: "x",
            categories,
            copy: cs,
            accentColor: "#3366FF",
        }).accent,
        { custom: "#3366FF" }
    )
})

test("a panel with more than ten categories offers one select instead of rows of buttons", () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
        id: `c${index}`,
        label: `Kategorie ${index}`,
    }))
    const view = ticketPanelView({ title: "x", categories: many, copy: cs })
    layoutForTest(view)
    assert.equal(viewButtons(view).length, 0)
    const select = view.blocks.find((block) => block.kind === "select")
    assert.ok(select && select.kind === "select")
    assert.equal(select.select.options.length, 12)
    assert.equal(select.select.placeholder, "Vyber, s čím potřebuješ pomoct")
})

test("opened, failed and disabled replies (L4-39..41)", () => {
    const opened = ticketOpenedView({
        copy: cs,
        ticketNumber: 12,
        threadId: "300000000000000012",
        threadUrl: "https://discord.com/channels/1/300000000000000012",
    })
    const text = viewText(opened)
    assert.match(text, /### Ticket #12 je otevřený/)
    assert.match(
        text,
        /Pokračuj ve vlákně <#300000000000000012>\. Podpora se ti ozve tam\./
    )
    assert.deepEqual(viewButtons(opened), [
        {
            label: "Otevřít vlákno",
            link: "https://discord.com/channels/1/300000000000000012",
        },
    ])
    assert.equal(opened.ephemeral, true)
    const failed = viewText(ticketFailedCard(cs))
    assert.match(failed, /### Ticket se nepodařilo otevřít/)
    assert.match(
        failed,
        /Nic se neuložilo\. Správci dostali upozornění; zkus to prosím za chvíli znovu\./
    )
    assert.doesNotMatch(failed, /oprávnění bota/)
    const disabled = viewText(ticketsDisabledCard(cs))
    assert.match(disabled, /### Tickety jsou teď vypnuté/)
    assert.match(disabled, /Napiš správcům přímo, nebo to zkus později\./)
})

test("the thread card: label, author title, chip, time, Q&A and the close hint (L4-42)", () => {
    const view = ticketIntroView({
        copy: cs,
        ticketNumber: 12,
        category: "Nahlásit hráče",
        titleTemplate: "{author} nahlašuje hráče",
        authorName: "Hráč 17",
        openedAt: "2026-10-11T18:31:00Z",
        answers: [
            { label: "Kdo? Jméno ve hře", value: "xX_Sniper_Xx" },
            { label: "Kde a kdy?", value: "Vlci #1, dnes kolem 20:15" },
            {
                label: "Co se stalo?",
                value: "Opakovaně zabíjel vlastní tým u základny. Video v příloze.",
            },
        ],
        locale: "cs-CZ",
        timeZone: "Europe/Prague",
    })
    const text = viewText(view)
    assert.match(text, /-# \*\*TICKET #12 · NAHLÁSIT HRÁČE\*\*/)
    assert.match(text, /### Hráč 17 nahlašuje hráče/)
    assert.match(text, /🟢 \*\*Otevřený\*\*/)
    assert.match(text, /Otevřeno ne <t:1791743460:d> · <t:1791743460:t>/)
    assert.match(
        text,
        /\*\*Kdo\? Jméno ve hře\*\*\nxX\\_Sniper\\_Xx\n\*\*Kde a kdy\?\*\*/
    )
    assert.match(
        text,
        /-# Ticket uzavře podpora příkazem \/close_ticket · Spravováno v Logi/
    )
    const generic = viewText(
        ticketIntroView({
            copy: cs,
            ticketNumber: 13,
            category: "Jiné",
            authorName: "Hráč 17",
            openedAt: "2026-10-11T18:31:00Z",
            answers: [],
            locale: "cs-CZ",
            timeZone: "Europe/Prague",
        })
    )
    assert.match(generic, /### Hráč 17 · Jiné/)
})

test("the thread pings only the author and the category's support roles (L4-B05)", () => {
    assert.deepEqual(
        ticketIntroMentions({
            authorId: AUTHOR,
            supportRoleIds: [ADMINI, ADMINI, "not-a-role"],
        }),
        {
            content: `<@${AUTHOR}> <@&${ADMINI}>`,
            allowedMentions: {
                users: [AUTHOR],
                roles: [ADMINI],
                parse: [],
            },
        }
    )
})

test("thread names read 'Nahlásit hráče #12' and 'uzavřeno · Nahlásit hráče #12' (L4-45)", () => {
    assert.equal(
        ticketThreadName(cs, "Nahlásit hráče", 12),
        "Nahlásit hráče #12"
    )
    assert.equal(
        closedTicketThreadName(cs, "Nahlásit hráče", 12),
        "uzavřeno · Nahlásit hráče #12"
    )
    assert.ok(ticketThreadName(cs, "x".repeat(200), 1).length <= 100)
})

test("the close card: label, 'Vyřešeno', chip, closer, quoted reason, footer (L4-43)", () => {
    const view = ticketClosedView({
        copy: cs,
        ticketNumber: 12,
        closerId: CLOSER,
        closedAt: "2026-10-11T19:12:00Z",
        reason: "Hráč dostal ban na 7 dní. Díky za nahlášení.",
        locale: "cs-CZ",
        timeZone: "Europe/Prague",
    })
    const text = viewText(view)
    assert.match(text, /-# \*\*TICKET #12 · UZAVŘEN\*\*/)
    assert.match(text, /### Vyřešeno/)
    assert.match(text, /⚪ \*\*Uzavřený\*\*/)
    assert.match(
        text,
        new RegExp(
            `Zavřel <@${CLOSER}> · ne <t:1791745920:d> · <t:1791745920:t>`
        )
    )
    assert.match(text, /> Hráč dostal ban na 7 dní\. Díky za nahlášení\./)
    assert.match(text, /-# Vlákno je zamčené a archivované · Spravováno v Logi/)
    const noReason = viewText(
        ticketClosedView({
            copy: cs,
            ticketNumber: 12,
            closerId: CLOSER,
            closedAt: "2026-10-11T19:12:00Z",
            locale: "cs-CZ",
            timeZone: "Europe/Prague",
        })
    )
    assert.doesNotMatch(noReason, /^>/m)
    assert.doesNotMatch(noReason, /Nebyl uveden důvod/)
})

test("the DM to the author: label, title, category and closer by name, quote, link, footer (L4-44, L2-56)", () => {
    const view = ticketClosedDmView({
        copy: cs,
        clanName: "Vlci",
        ticketNumber: 12,
        category: "Nahlásit hráče",
        closerName: "Hráč 02",
        reason: "Hráč dostal ban na 7 dní. Díky za nahlášení.",
        threadUrl: "https://discord.com/channels/1/2",
        settingsUrl: "https://logi.example/cs/dashboard/settings/user",
    })
    const text = viewText(view)
    assert.match(text, /-# \*\*KLAN VLCI · TICKET #12\*\*/)
    assert.match(text, /### Tvůj ticket je vyřešený/)
    assert.match(text, /Nahlásit hráče · zavřel Hráč 02/)
    assert.match(text, /> Hráč dostal ban na 7 dní\. Díky za nahlášení\./)
    assert.match(
        text,
        /-# Klan Vlci · \[Nastavit zprávy\]\(https:\/\/logi\.example\/cs\/dashboard\/settings\/user\)/
    )
    assert.doesNotMatch(text, /this server|<@/)
    assert.deepEqual(viewButtons(view), [
        { label: "Otevřít vlákno", link: "https://discord.com/channels/1/2" },
    ])
    assert.equal(view.ephemeral, undefined)
    // The divider sits between the quoted reason and the button (L2-56).
    assert.deepEqual(
        view.blocks.map((block) => block.kind),
        ["text", "text", "separator", "buttons"]
    )
})

test("/close_ticket replies: closed with or without the DM, and every refusal (M3-30..36)", () => {
    const closed = viewText(
        ticketClosedReplyView({ copy: cs, ticketNumber: 12, dmDelivered: true })
    )
    assert.match(closed, /### Ticket #12 je uzavřený/)
    assert.match(
        closed,
        /Shrnutí je ve vlákně a autor ho dostal do DM\. Vlákno je zamčené a archivované\./
    )
    assert.match(
        viewText(
            ticketClosedReplyView({
                copy: cs,
                ticketNumber: 12,
                dmDelivered: false,
            })
        ),
        /Autorovi nejde poslat DM, shrnutí najde ve vlákně\./
    )
    const denied = viewText(
        ticketCloseNotAllowedCard({
            copy: cs,
            category: "Nahlásit hráče",
            supportRoleIds: [ADMINI],
        })
    )
    assert.match(denied, /### Tento ticket můžou zavřít jen podpora a správci/)
    assert.match(
        denied,
        new RegExp(
            `Ticket z kategorie Nahlásit hráče zavírá <@&${ADMINI}> nebo správci Logi\\. Když je vyřešený, napiš to sem do vlákna\\.`
        )
    )
    assert.match(
        viewText(
            ticketCloseNotAllowedCard({
                copy: cs,
                category: "Jiné",
                supportRoleIds: [],
            })
        ),
        /zavírají správci Logi/
    )
    assert.match(
        viewText(ticketCloseUnverifiableCard(cs)),
        /### Teď nejde ověřit tvoje role\nDiscord neodpověděl\. Zkus to za chvíli znovu\./
    )
    assert.match(
        viewText(ticketCloseOutsideCard(cs)),
        /### \/close\\_ticket funguje jen ve vlákně ticketu\nOtevři vlákno ticketu a spusť příkaz tam\./
    )
    assert.match(
        viewText(ticketCloseNotTicketCard(cs)),
        /### Tohle vlákno není ticket\nZavírá se jen vlákno, které vzniklo z panelu ticketů\./
    )
    assert.match(
        viewText(ticketAlreadyClosedCard(cs, 12)),
        /### Ticket #12 je už uzavřený\nNic dalšího není potřeba\./
    )
})

test("reasons are quoted line by line and escaped", () => {
    assert.equal(quotedReason("a\n\n*b*"), "> a\n> \\*b\\*")
    assert.equal(quotedReason("  "), "")
})

test("every ticket card passes the board rules in all three languages", () => {
    for (const language of ["cs", "en", "de"] as const) {
        const copy = getTicketMessages(language)
        layoutForTest(
            ticketPanelView({ title: "x", categories, copy }),
            language
        )
        layoutForTest(
            ticketIntroView({
                copy,
                ticketNumber: 1,
                category: "Jiné",
                authorName: "A",
                openedAt: Date.UTC(2026, 9, 11),
                answers: Array.from({ length: 5 }, () => ({
                    label: "Q",
                    value: "x".repeat(1000),
                })),
                locale: "en-GB",
                timeZone: "UTC",
            }),
            language
        )
        layoutForTest(
            ticketClosedDmView({
                copy,
                clanName: "Vlci",
                ticketNumber: 1,
                category: "Jiné",
                closerName: "A",
                threadUrl: "https://discord.com/channels/1/2",
            }),
            language
        )
    }
})
