import type { TicketCopy } from "@/domain/discord-tickets/ticket-copy"

import { clanCopy, type ClanLanguage } from "./core"

export type TicketMessages = TicketCopy

/**
 * Support tickets in Discord (boards L4 "Tickety", M3 "/close_ticket" and L2
 * "Rozhodnutí o … ticketu"): the panel, the category window, the thread
 * card, closing and the DM to the author. Bot copy says "ty" ("du"); Czech
 * is verbatim from the boards.
 */

const ticketMessages: Record<ClanLanguage, TicketMessages> = {
    cs: {
        panel: {
            selectPlaceholder: "Vyber, s čím potřebuješ pomoct",
        },
        form: { fallbackTitle: "Ticket" },
        opened: {
            title: "Ticket #{number} je otevřený",
            body: "Pokračuj ve vlákně {thread}. Podpora se ti ozve tam.",
            openThread: "Otevřít vlákno",
        },
        failed: {
            title: "Ticket se nepodařilo otevřít",
            body: "Nic se neuložilo. Správci dostali upozornění; zkus to prosím za chvíli znovu.",
        },
        disabled: {
            title: "Tickety jsou teď vypnuté",
            body: "Napiš správcům přímo, nebo to zkus později.",
        },
        staleCategory: {
            title: "Tahle nabídka už neplatí",
            body: "Vyber kategorii znovu v aktuálním panelu ticketů.",
        },
        thread: {
            name: "{category} #{number}",
            closedName: "uzavřeno · {category} #{number}",
            label: "Ticket #{number} · {category}",
            title: "{author} · {category}",
            openChip: "Otevřený",
            openedAt: "Otevřeno {time}",
            footer: "Ticket uzavře podpora příkazem /close_ticket",
        },
        closed: {
            label: "Ticket #{number} · uzavřen",
            title: "Vyřešeno",
            chip: "Uzavřený",
            closedBy: "Zavřel {closer} · {time}",
            footer: "Vlákno je zamčené a archivované",
            auditReason: "Ticket uzavřen",
        },
        dm: {
            label: "Klan {clan} · Ticket #{number}",
            title: "Tvůj ticket je vyřešený",
            closedBy: "{category} · zavřel {closer}",
            openThread: "Otevřít vlákno",
        },
        close: {
            successTitle: "Ticket #{number} je uzavřený",
            successBody:
                "Shrnutí je ve vlákně a autor ho dostal do DM. Vlákno je zamčené a archivované.",
            dmFailedBody: "Autorovi nejde poslat DM, shrnutí najde ve vlákně.",
            notAllowedTitle: "Tento ticket můžou zavřít jen podpora a správci",
            notAllowedBody:
                "Ticket z kategorie {category} zavírá {roles} nebo správci Logi. Když je vyřešený, napiš to sem do vlákna.",
            notAllowedAdminsBody:
                "Ticket z kategorie {category} zavírají správci Logi. Když je vyřešený, napiš to sem do vlákna.",
            or: " nebo ",
            unverifiableTitle: "Teď nejde ověřit tvoje role",
            unverifiableBody: "Discord neodpověděl. Zkus to za chvíli znovu.",
            outsideTitle: "/close_ticket funguje jen ve vlákně ticketu",
            outsideBody: "Otevři vlákno ticketu a spusť příkaz tam.",
            notTicketTitle: "Tohle vlákno není ticket",
            notTicketBody:
                "Zavírá se jen vlákno, které vzniklo z panelu ticketů.",
            alreadyClosedTitle: "Ticket #{number} je už uzavřený",
            alreadyClosedBody: "Nic dalšího není potřeba.",
        },
    },
    en: {
        panel: {
            selectPlaceholder: "Choose what you need help with",
        },
        form: { fallbackTitle: "Ticket" },
        opened: {
            title: "Ticket #{number} is open",
            body: "Continue in the thread {thread}. Support will get back to you there.",
            openThread: "Open thread",
        },
        failed: {
            title: "The ticket couldn't be opened",
            body: "Nothing was saved. The admins have been notified; please try again in a moment.",
        },
        disabled: {
            title: "Tickets are switched off right now",
            body: "Write to the admins directly, or try again later.",
        },
        staleCategory: {
            title: "This option has expired",
            body: "Choose the category again in the current ticket panel.",
        },
        thread: {
            name: "{category} #{number}",
            closedName: "closed · {category} #{number}",
            label: "Ticket #{number} · {category}",
            title: "{author} · {category}",
            openChip: "Open",
            openedAt: "Opened {time}",
            footer: "Support closes the ticket with /close_ticket",
        },
        closed: {
            label: "Ticket #{number} · closed",
            title: "Resolved",
            chip: "Closed",
            closedBy: "Closed by {closer} · {time}",
            footer: "The thread is locked and archived",
            auditReason: "Ticket closed",
        },
        dm: {
            label: "Clan {clan} · Ticket #{number}",
            title: "Your ticket is resolved",
            closedBy: "{category} · closed by {closer}",
            openThread: "Open thread",
        },
        close: {
            successTitle: "Ticket #{number} is closed",
            successBody:
                "The summary is in the thread and the author got it by DM. The thread is locked and archived.",
            dmFailedBody:
                "The author can't receive DMs; they'll find the summary in the thread.",
            notAllowedTitle: "Only support and admins can close this ticket",
            notAllowedBody:
                "Tickets in the {category} category are closed by {roles} or Logi's admins. If it's resolved, say so here in the thread.",
            notAllowedAdminsBody:
                "Tickets in the {category} category are closed by Logi's admins. If it's resolved, say so here in the thread.",
            or: " or ",
            unverifiableTitle: "Your roles can't be checked right now",
            unverifiableBody: "Discord didn't answer. Try again in a moment.",
            outsideTitle: "/close_ticket only works in a ticket thread",
            outsideBody: "Open the ticket's thread and run the command there.",
            notTicketTitle: "This thread isn't a ticket",
            notTicketBody:
                "Only a thread opened from the ticket panel can be closed.",
            alreadyClosedTitle: "Ticket #{number} is already closed",
            alreadyClosedBody: "Nothing else is needed.",
        },
    },
    de: {
        panel: {
            selectPlaceholder: "Wähle, wobei du Hilfe brauchst",
        },
        form: { fallbackTitle: "Ticket" },
        opened: {
            title: "Ticket #{number} ist offen",
            body: "Mach im Thread {thread} weiter. Der Support meldet sich dort bei dir.",
            openThread: "Thread öffnen",
        },
        failed: {
            title: "Das Ticket konnte nicht geöffnet werden",
            body: "Es wurde nichts gespeichert. Die Admins wurden benachrichtigt; versuch es bitte gleich noch einmal.",
        },
        disabled: {
            title: "Tickets sind gerade ausgeschaltet",
            body: "Schreib den Admins direkt oder versuch es später.",
        },
        staleCategory: {
            title: "Dieses Angebot ist nicht mehr gültig",
            body: "Wähle die Kategorie im aktuellen Ticket-Panel erneut.",
        },
        thread: {
            name: "{category} #{number}",
            closedName: "geschlossen · {category} #{number}",
            label: "Ticket #{number} · {category}",
            title: "{author} · {category}",
            openChip: "Offen",
            openedAt: "Geöffnet {time}",
            footer: "Der Support schließt das Ticket mit /close_ticket",
        },
        closed: {
            label: "Ticket #{number} · geschlossen",
            title: "Erledigt",
            chip: "Geschlossen",
            closedBy: "Geschlossen von {closer} · {time}",
            footer: "Der Thread ist gesperrt und archiviert",
            auditReason: "Ticket geschlossen",
        },
        dm: {
            label: "Clan {clan} · Ticket #{number}",
            title: "Dein Ticket ist erledigt",
            closedBy: "{category} · geschlossen von {closer}",
            openThread: "Thread öffnen",
        },
        close: {
            successTitle: "Ticket #{number} ist geschlossen",
            successBody:
                "Die Zusammenfassung steht im Thread und der Autor hat sie per DM bekommen. Der Thread ist gesperrt und archiviert.",
            dmFailedBody:
                "Dem Autor kann keine DM geschickt werden; die Zusammenfassung findet er im Thread.",
            notAllowedTitle:
                "Dieses Ticket können nur der Support und die Admins schließen",
            notAllowedBody:
                "Tickets der Kategorie {category} schließen {roles} oder die Admins von Logi. Wenn es erledigt ist, schreib das hier in den Thread.",
            notAllowedAdminsBody:
                "Tickets der Kategorie {category} schließen die Admins von Logi. Wenn es erledigt ist, schreib das hier in den Thread.",
            or: " oder ",
            unverifiableTitle: "Deine Rollen lassen sich gerade nicht prüfen",
            unverifiableBody:
                "Discord hat nicht geantwortet. Versuch es gleich noch einmal.",
            outsideTitle: "/close_ticket funktioniert nur im Ticket-Thread",
            outsideBody:
                "Öffne den Thread des Tickets und führe den Befehl dort aus.",
            notTicketTitle: "Dieser Thread ist kein Ticket",
            notTicketBody:
                "Geschlossen wird nur ein Thread, der über das Ticket-Panel entstanden ist.",
            alreadyClosedTitle: "Ticket #{number} ist schon geschlossen",
            alreadyClosedBody: "Es ist nichts weiter nötig.",
        },
    },
}

export const getTicketMessages = clanCopy(ticketMessages)
