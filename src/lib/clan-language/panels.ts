import { clanCopy, type ClanLanguage } from "./core"

/** Messages the bot keeps in channels: the calendar panel, plus the calendar links of events. */
export type PanelMessages = {
    calendar: {
        fallbackDetails: string
        fallbackLocation: string
        panelTitle: string
        panelEmpty: string
        panelCategories: string
        matchLabel: string
        trainingLabel: string
    }
}

const panelsMessages: Record<ClanLanguage, PanelMessages> = {
    en: {
        calendar: {
            fallbackDetails: "Operation briefing from Logi.",
            fallbackLocation: "Discord",
            panelTitle: "Calendar",
            panelEmpty: "No upcoming events are scheduled right now.",
            panelCategories: "Categories",
            matchLabel: "Match",
            trainingLabel: "Training",
        },
    },
    cs: {
        calendar: {
            fallbackDetails: "Briefing k operaci z Logi.",
            fallbackLocation: "Discord",
            panelTitle: "Kalendář",
            panelEmpty:
                "Momentálně nejsou naplánované žádné nadcházející akce.",
            panelCategories: "Kategorie",
            matchLabel: "Zápas",
            trainingLabel: "Výcvik",
        },
    },
    de: {
        calendar: {
            fallbackDetails: "Einsatz-Briefing aus Logi.",
            fallbackLocation: "Discord",
            panelTitle: "Kalender",
            panelEmpty: "Derzeit sind keine kommenden Events geplant.",
            panelCategories: "Kategorien",
            matchLabel: "Match",
            trainingLabel: "Training",
        },
    },
}

/** The panels copy in the clan language; unknown languages read English. */
export const getPanelMessages = clanCopy(panelsMessages)
