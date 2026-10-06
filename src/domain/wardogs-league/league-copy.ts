import type { StandingsTableLabels } from "./standings-table"

/** A day of the League calendar in the clan's time zone. */
export type LeagueDay = { day: number; month: number; monthShort: string }

/**
 * Every word of the WD League panels and the link reply (boards P6 and L3),
 * in the clan language (`src/lib/clan-language/league.ts`). Czech is verbatim
 * from the boards; bot copy says "ty" ("du").
 */
export type LeagueCopy = {
    standings: {
        /** "Wardogs League · sezóna 2026" (laid out upper case). */
        label: (season: string) => string
        /** "WD League · tabulka". */
        title: string
        /** "Po 16 zápasech". */
        played: (matches: number) => string
        /** "body: 1. místo 3 · 2. místo 2 · 3. místo 1". */
        rule: (points: readonly number[]) => string
        /** Counted matches published different rules. */
        mixedRule: string
        columns: StandingsTableLabels
        /** "B body · Z zápasy · 1. 2. 3. kolikrát na tom místě · › náš tým". */
        legend: string
        /** "Tabulka se zobrazí po prvních výsledcích". */
        waiting: string
        /** Rows left out to fit Discord's limit. */
        moreTeams: (count: number) => string
        /** "Otevřít ligu". */
        open: string
        /** "Body počítá Logi z výsledků na wardogsleague.net". */
        footer: string
    }
    fixtures: {
        /** "Wardogs League · zápasy celé ligy". */
        label: string
        /** "WD League · nejbližší zápasy". */
        title: string
        /** "6 nejbližších zápasů · časy v tvém pásmu". */
        meta: (shown: number) => string
        /** "48 členů". */
        members: (count: number) => string
        /** "Hostuje VLK". */
        host: (team: string) => string
        /** The League hosts the server. */
        hostLeague: string
        /** "Mapa po hlasování". */
        mapAfterVote: string
        /** Chip of a fixture being played now. */
        live: string
        chips: {
            /** "Pravidla 2/3". */
            rules: (picked: number, total: number) => string
            rulesUnknown: string
            /** "Hlasování o mapě" before "· končí za 15 h". */
            voteRunning: string
            /** "končí {time}" with a relative Discord timestamp. */
            voteCloses: (time: string) => string
            /** "Hlasování o mapě od so 10. 10.". */
            voteFrom: (date: string) => string
            votePending: string
            voteDone: string
            moderatorDone: string
            moderatorPending: string
            readyPending: string
            readyRunning: string
            readyDone: string
            /** "Příprava ještě nezačala". */
            notStarted: string
        }
        /** "Detail na wardogsleague.net". */
        detail: string
        /** Fixtures that do not fit, still on the League site. */
        more: (count: number) => string
        empty: string
        /** "Všechny zápasy na webu ligy". */
        all: string
        /** "Data z wardogsleague.net". */
        footer: string
        /** "mapa Zestafona" (image description). */
        mapAlt: (map: string) => string
        /** Chip when the League site has not answered for a while. */
        stale: string
        /** "poslední data {time}". */
        lastData: (time: string) => string
    }
    recent: {
        /** "Wardogs League · 3.–9. 10." when the results stand alone. */
        label: (range: string) => string
        /** "WD League · poslední výsledky" when the results stand alone (P6-17). */
        title: string
        /** "Poslední výsledky" above the results inside "nejbližší zápasy". */
        heading: string
        /** "3.–9. 10.". */
        range: (from: LeagueDay, to: LeagueDay) => string
        /** No League result in the last seven days, once results are collected. */
        empty: string
        /** Before Logi has collected any League result (P6-18, INDEX resolution 7). */
        waiting: string
        /** "Výsledky na webu ligy". */
        link: string
    }
    /** "správce zastavil obnovování" (L3-54). */
    pausedReason: string
    reply: {
        /** "Wardogs League · nový zápas 41". */
        label: (fixture: string) => string
        /** "Logi zápas sleduje. Kartu, která se sama obnovuje, najdeš v #liga." */
        body: (channel: string) => string
        /** "Otevřít kartu". */
        openPanel: string
        /** "Otevřít na webu ligy". */
        openLeague: string
    }
}
