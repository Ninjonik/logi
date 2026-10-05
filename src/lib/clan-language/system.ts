import type { MessageKitCopy } from "../../domain/discord-messages/message-layout"

import { clanCopy, type ClanLanguage } from "./core"

/**
 * System copy that is not tied to one feature: the shared message kit (frame
 * footer, paging, error cards), managed-message delivery errors and team
 * request decisions.
 */
export type SystemMessages = {
    teamRequests: {
        approvedTitle: string
        mergedTitle: string
        rejectedTitle: string
        approvedCreate: string
        approvedUpdate: string
        merged: string
        rejected: string
        request: string
        kindCreate: string
        kindUpdate: string
        game: string
        requestedName: string
        team: string
        reason: string
        footer: string
    }
    /** The frame words of every bot message (`message-layout.ts`). */
    kit: MessageKitCopy
    paging: { previous: string; next: string }
    errors: {
        /** Title of the unknown-error card. */
        unknownTitle: string
        unknownBody: string
        /** What a person sees when an admin must fix the cause. */
        adminNotified: string
    }
    /** Last delivery error of a managed message, shown on the dashboard. */
    publication: {
        deliveryFailed: string
        deliveryUncertain: string
    }
}

const systemMessages: Record<ClanLanguage, SystemMessages> = {
    en: {
        teamRequests: {
            approvedTitle: "Team request approved",
            mergedTitle: "Team request merged",
            rejectedTitle: "Team request rejected",
            approvedCreate:
                "Your new team is now in the Logi team catalogue and can be selected for matches.",
            approvedUpdate:
                "Your requested changes were applied to the team in the Logi team catalogue.",
            merged: "This team already exists in the Logi team catalogue, so your request was merged into it. Select that team for your matches.",
            rejected: "A Logi administrator rejected your team request.",
            request: "Request",
            kindCreate: "New team",
            kindUpdate: "Change request",
            game: "Game",
            requestedName: "Requested name",
            team: "Team in the catalogue",
            reason: "Reason",
            footer: "Logi team catalogue",
        },
        kit: {
            updated: "Updated {time}",
            refreshEvery: "refreshes every {seconds} s",
            managed: "Managed in Logi",
            dmClan: "Clan {clan}",
            dmSettings: "Message settings",
            page: "Page {page} of {pages}",
            paused: "Paused",
            lastData: "last data {time}",
        },
        paging: { previous: "Previous", next: "Next" },
        errors: {
            unknownTitle: "That didn't work",
            unknownBody:
                "Try again in a moment. If it still fails, message the clan admins.",
            adminNotified: "The admins have been notified.",
        },
        publication: {
            deliveryFailed:
                "The message could not be delivered to Discord. Check that the bot may view the channel, send messages and read message history there. Logi retries on its own.",
            deliveryUncertain:
                "It is unclear whether the message reached Discord, so Logi does not send it again to avoid a duplicate. Check the channel and contact Logi support.",
        },
    },
    cs: {
        teamRequests: {
            approvedTitle: "Žádost o tým schválena",
            mergedTitle: "Žádost o tým sloučena",
            rejectedTitle: "Žádost o tým zamítnuta",
            approvedCreate:
                "Váš nový tým je nyní v katalogu týmů Logi a lze ho vybrat pro zápasy.",
            approvedUpdate:
                "Požadované změny byly použity na tým v katalogu týmů Logi.",
            merged: "Tento tým už v katalogu týmů Logi existuje, proto byla vaše žádost sloučena s ním. Pro zápasy vyberte tento tým.",
            rejected: "Administrátor Logi vaši žádost o tým zamítl.",
            request: "Žádost",
            kindCreate: "Nový tým",
            kindUpdate: "Žádost o změnu",
            game: "Hra",
            requestedName: "Požadovaný název",
            team: "Tým v katalogu",
            reason: "Důvod",
            footer: "Katalog týmů Logi",
        },
        kit: {
            updated: "Aktualizováno {time}",
            refreshEvery: "obnovuje se každých {seconds} s",
            managed: "Spravováno v Logi",
            dmClan: "Klan {clan}",
            dmSettings: "Nastavit zprávy",
            page: "Strana {page} z {pages}",
            paused: "Pozastaveno",
            lastData: "poslední data {time}",
        },
        paging: { previous: "Předchozí", next: "Další" },
        errors: {
            unknownTitle: "Tohle se nepovedlo",
            unknownBody:
                "Zkus to za chvíli znovu. Když to nepůjde, napiš správcům klanu.",
            adminNotified: "Správci dostali upozornění.",
        },
        publication: {
            deliveryFailed:
                "Zprávu se nepodařilo doručit do Discordu. Zkontrolujte, že bot smí v kanálu zobrazit kanál, posílat zprávy a číst historii. Logi to zkusí znovu samo.",
            deliveryUncertain:
                "Není jisté, jestli zpráva do Discordu dorazila, proto ji Logi znovu neposílá, aby v kanálu nebyla dvakrát. Zkontrolujte kanál a kontaktujte podporu Logi.",
        },
    },
    de: {
        teamRequests: {
            approvedTitle: "Teamanfrage genehmigt",
            mergedTitle: "Teamanfrage zusammengeführt",
            rejectedTitle: "Teamanfrage abgelehnt",
            approvedCreate:
                "Dein neues Team ist jetzt im Logi-Teamkatalog und kann für Matches ausgewählt werden.",
            approvedUpdate:
                "Die angefragten Änderungen wurden auf das Team im Logi-Teamkatalog angewendet.",
            merged: "Dieses Team existiert bereits im Logi-Teamkatalog, daher wurde deine Anfrage damit zusammengeführt. Wähle dieses Team für eure Matches.",
            rejected: "Ein Logi-Administrator hat deine Teamanfrage abgelehnt.",
            request: "Anfrage",
            kindCreate: "Neues Team",
            kindUpdate: "Änderungsanfrage",
            game: "Spiel",
            requestedName: "Angefragter Name",
            team: "Team im Katalog",
            reason: "Begründung",
            footer: "Logi-Teamkatalog",
        },
        kit: {
            updated: "Aktualisiert {time}",
            refreshEvery: "wird alle {seconds} s aktualisiert",
            managed: "Verwaltet in Logi",
            dmClan: "Clan {clan}",
            dmSettings: "Nachrichten einstellen",
            page: "Seite {page} von {pages}",
            paused: "Pausiert",
            lastData: "letzte Daten {time}",
        },
        paging: { previous: "Zurück", next: "Weiter" },
        errors: {
            unknownTitle: "Das hat nicht geklappt",
            unknownBody:
                "Versuch es gleich noch einmal. Wenn es weiter nicht klappt, schreib den Clan-Admins.",
            adminNotified: "Die Admins wurden benachrichtigt.",
        },
        publication: {
            deliveryFailed:
                "Die Nachricht konnte nicht an Discord zugestellt werden. Prüfen Sie, ob der Bot den Kanal sehen, dort Nachrichten senden und den Verlauf lesen darf. Logi versucht es selbst erneut.",
            deliveryUncertain:
                "Es ist unklar, ob die Nachricht bei Discord angekommen ist. Logi sendet sie deshalb nicht erneut, damit sie nicht doppelt erscheint. Prüfen Sie den Kanal und wenden Sie sich an den Logi-Support.",
        },
    },
}

/** The system copy in the clan language; unknown languages read English. */
export const getSystemMessages = clanCopy(systemMessages)
