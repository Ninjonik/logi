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
            dmOffBody:
                "Shrnutí je ve vlákně. DM o uzavření ticketu má klan vypnutou. Vlákno je zamčené a archivované.",
            summary: {
                posted: {
                    sent: "Shrnutí je ve vlákně a autor ho dostal do DM.",
                    failed: "Autorovi nejde poslat DM, shrnutí najde ve vlákně.",
                    off: "Shrnutí je ve vlákně. DM o uzavření ticketu má klan vypnutou.",
                },
                notPosted: {
                    sent: "Shrnutí se do vlákna nepodařilo poslat, autor ho dostal do DM.",
                    failed: "Shrnutí se do vlákna nepodařilo poslat a autorovi nejde poslat DM.",
                    off: "Shrnutí se do vlákna nepodařilo poslat. DM o uzavření ticketu má klan vypnutou.",
                },
            },
            threadDone: "Vlákno je zamčené a archivované.",
            threadFailed: "Vlákno se nepodařilo {steps}.",
            threadSteps: {
                rename: "přejmenovat",
                lock: "zamknout",
                archive: "archivovat",
            },
            threadStepsOr: " ani ",
            adminNotified: "Správci dostali upozornění.",
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
    pl: {
        panel: {
            selectPlaceholder: "Wybierz, w czym potrzebujesz pomocy",
        },
        form: { fallbackTitle: "Zgłoszenie pomocy" },
        opened: {
            title: "Zgłoszenie #{number} otwarte",
            body: "Kontynuuj w wątku {thread}. Tam odezwie się do Ciebie obsługa.",
            openThread: "Otwórz wątek",
        },
        failed: {
            title: "Nie można otworzyć zgłoszenia",
            body: "Nic nie zostało zapisane. Administratorzy zostali powiadomieni; spróbuj ponownie za chwilę.",
        },
        disabled: {
            title: "Zgłoszenia pomocy są teraz wyłączone",
            body: "Napisz bezpośrednio do administratorów lub spróbuj ponownie później.",
        },
        staleCategory: {
            title: "Ta opcja wygasła",
            body: "Wybierz ponownie kategorię w bieżącym panelu zgłoszeń.",
        },
        thread: {
            name: "{category} #{number}",
            closedName: "zamknięte · {category} #{number}",
            label: "Zgłoszenie #{number} · {category}",
            title: "{author} · {category}",
            openChip: "Otwarte",
            openedAt: "Otwarto {time}",
            footer: "Wsparcie zamyka zgłoszenie za pomocą /close_ticket",
        },
        closed: {
            label: "Zgłoszenie #{number} · zamknięte",
            title: "Rozwiązane",
            chip: "Zamknięte",
            closedBy: "Zamknięte przez {closer} · {time}",
            footer: "Wątek jest zablokowany i zarchiwizowany",
            auditReason: "Zgłoszenie pomocy zamknięte",
        },
        dm: {
            label: "Klan {clan} · Zgłoszenie #{number}",
            title: "Twoje zgłoszenie zostało rozwiązane",
            closedBy: "{category} · zamknięte przez {closer}",
            openThread: "Otwórz wątek",
        },
        close: {
            successTitle: "Zgłoszenie #{number} zamknięte",
            successBody:
                "Podsumowanie znajduje się w wątku i autor otrzymał je przez DM. Wątek jest zamknięty i zarchiwizowany.",
            dmFailedBody:
                "Nie udało się dostarczyć wiadomości prywatnej. Podsumowanie jest dostępne w wątku.",
            dmOffBody:
                "Podsumowanie jest w wątku. Klan wyłączył prywatne powiadomienia o zamykaniu zgłoszeń. Wątek został zablokowany i zarchiwizowany.",
            summary: {
                posted: {
                    sent: "Podsumowanie znajduje się w wątku i autor otrzymał je przez DM.",
                    failed: "Nie udało się dostarczyć wiadomości prywatnej. Podsumowanie jest dostępne w wątku.",
                    off: "Podsumowanie jest w wątku. Klan wyłączył prywatne powiadomienia o zamykaniu zgłoszeń.",
                },
                notPosted: {
                    sent: "Nie można opublikować podsumowania w wątku; autor dostał to przez DM.",
                    failed: "Nie udało się opublikować podsumowania w wątku ani wysłać go w wiadomości prywatnej.",
                    off: "Nie udało się opublikować podsumowania w wątku. Klan wyłączył prywatne powiadomienia o zamykaniu zgłoszeń.",
                },
            },
            threadDone: "Wątek jest zablokowany i zarchiwizowany.",
            threadFailed:
                "Nie udało się wykonać następujących działań: {steps}.",
            threadSteps: {
                rename: "zmienić nazwy",
                lock: "zablokować wątku",
                archive: "zarchiwizować wątku",
            },
            threadStepsOr: " ani ",
            adminNotified: "Administratorzy zostali powiadomieni.",
            notAllowedTitle:
                "Tylko wsparcie i administratorzy mogą zamknąć to zgłoszenie",
            notAllowedBody:
                "Zgłoszenia z kategorii {category} zamykają osoby z rolami {roles} lub administratorzy Logi. Jeśli sprawa jest rozwiązana, napisz o tym w wątku.",
            notAllowedAdminsBody:
                "Zgłoszenia w kategorii {category} zamykane są przez administratorów Logi. Jeśli problem został rozwiązany, powiedz to w tym wątku.",
            or: " lub ",
            unverifiableTitle: "Nie można teraz sprawdzić Twoich ról",
            unverifiableBody:
                "Discord nie odpowiedział. Spróbuj ponownie za chwilę.",
            outsideTitle:
                "/close_ticket działa tylko w wątku zgłoszenia pomocy",
            outsideBody: "Otwórz wątek zgłoszenia i uruchom tam komendę.",
            notTicketTitle: "Ten wątek nie jest zgłoszeniem",
            notTicketBody:
                "Można zamknąć tylko wątek otwarty z panelu zgłoszeń.",
            alreadyClosedTitle: "Zgłoszenie #{number} jest już zamknięte",
            alreadyClosedBody: "Nic więcej nie jest potrzebne.",
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
            dmOffBody:
                "The summary is in the thread. The clan has switched off the ticket-closed DM. The thread is locked and archived.",
            summary: {
                posted: {
                    sent: "The summary is in the thread and the author got it by DM.",
                    failed: "The author can't receive DMs; they'll find the summary in the thread.",
                    off: "The summary is in the thread. The clan has switched off the ticket-closed DM.",
                },
                notPosted: {
                    sent: "The summary couldn't be posted in the thread; the author got it by DM.",
                    failed: "The summary couldn't be posted in the thread, and the author can't receive DMs.",
                    off: "The summary couldn't be posted in the thread. The clan has switched off the ticket-closed DM.",
                },
            },
            threadDone: "The thread is locked and archived.",
            threadFailed: "The thread couldn't be {steps}.",
            threadSteps: {
                rename: "renamed",
                lock: "locked",
                archive: "archived",
            },
            threadStepsOr: " or ",
            adminNotified: "The admins have been notified.",
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
            dmOffBody:
                "Die Zusammenfassung steht im Thread. Der Clan hat die DM zum geschlossenen Ticket ausgeschaltet. Der Thread ist gesperrt und archiviert.",
            summary: {
                posted: {
                    sent: "Die Zusammenfassung steht im Thread und der Autor hat sie per DM bekommen.",
                    failed: "Dem Autor kann keine DM geschickt werden; die Zusammenfassung findet er im Thread.",
                    off: "Die Zusammenfassung steht im Thread. Der Clan hat die DM zum geschlossenen Ticket ausgeschaltet.",
                },
                notPosted: {
                    sent: "Die Zusammenfassung ließ sich nicht im Thread posten; der Autor hat sie per DM bekommen.",
                    failed: "Die Zusammenfassung ließ sich nicht im Thread posten, und dem Autor kann keine DM geschickt werden.",
                    off: "Die Zusammenfassung ließ sich nicht im Thread posten. Der Clan hat die DM zum geschlossenen Ticket ausgeschaltet.",
                },
            },
            threadDone: "Der Thread ist gesperrt und archiviert.",
            threadFailed: "Der Thread konnte nicht {steps} werden.",
            threadSteps: {
                rename: "umbenannt",
                lock: "gesperrt",
                archive: "archiviert",
            },
            threadStepsOr: " oder ",
            adminNotified: "Die Admins wurden benachrichtigt.",
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
