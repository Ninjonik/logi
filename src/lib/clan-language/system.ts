import { clanCopy, type ClanLanguage } from "./core"

/** System copy that is not tied to one feature: team request decisions. */
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
    },
}

/** The system copy in the clan language; unknown languages read English. */
export const getSystemMessages = clanCopy(systemMessages)
