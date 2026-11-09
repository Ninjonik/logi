import type { Locale } from "../config"
const copy = {
    fr: {
        title: "Importer des joueurs",
        body: "Choisissez un rôle Discord et importez ses joueurs comme membres, recrues, réservistes ou mercenaires. Répétez pour les autres rôles, puis confirmez que tout le monde a été importé.",
        none: "Je n’ai aucun joueur",
        done: "J’ai importé tout le monde",
    },
    en: {
        title: "Import players",
        body: "Choose a Discord role and import its players as members, recruits, reserve members or mercenaries. Repeat for other roles, then confirm that you have imported everyone.",
        none: "I don't have any players",
        done: "I've imported everyone",
    },
    cs: {
        title: "Import hráčů",
        body: "Vyberte Discord roli a importujte hráče jako členy, rekruty, členy v záloze nebo žoldáky. Opakujte import pro další role a nakonec potvrďte, že jste importovali všechny.",
        none: "Nemám žádné hráče",
        done: "Už jsem importoval všechny",
    },
    de: {
        title: "Spieler importieren",
        body: "Wähle eine Discord-Rolle und importiere Spieler als Mitglieder, Rekruten, Reservemitglieder oder Söldner. Wiederhole den Import für weitere Rollen und bestätige anschließend den Abschluss.",
        none: "Ich habe keine Spieler",
        done: "Ich habe alle importiert",
    },
    pl: {
        title: "Import graczy",
        body: "Wybierz rolę Discord i importuj graczy jako członków, rekrutów, członków rezerwowych lub najemników. Powtórz import dla kolejnych ról, a następnie potwierdź zakończenie.",
        none: "Nie mam graczy",
        done: "Wszyscy zaimportowani",
    },
}
export function getPlayerImportCopy(locale: Locale) {
    return copy[locale]
}
