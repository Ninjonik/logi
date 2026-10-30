import type { Locale } from "../config"
const en = {
    playersNav: "Click Players in the sidebar to open the clan's player list.",
    playerOpen: "Open Atlas to see the player's performance records.",
    playerTrends:
        "These are the same trend indicators and performance graphs used on player profiles. Hover a metric to see what it measures.",
    newMatch: "Click New match to open the creation form.",
    matchWatch:
        "Watch the actual form fill in the teams, map and match name. These changes are local to the tour.",
    matchContinue: "Click Continue in the form to move to the next step.",
    matchTime:
        "Set the game start, meeting time and sign-up deadline here. The preview uses the same schedule.",
    matchSignups:
        "Choose who can sign up, the groups offered and their capacity limits.",
    matchDiscord:
        "Choose the Discord channels, forum and voice-channel options. The announcement preview updates alongside the form.",
    matchReview:
        "Review the schedule, sign-ups and Discord settings before publishing.",
    matchPublish:
        "Click Publish to simulate creating this match. The tour will not save a match or send a Discord message.",
    loading: "Opening the next page…",
    exit: "Exit tour",
    leave: "End the tour to use real data on this page.",
    example: "Tour · Example data",
    missing:
        "This part of the page is unavailable. You can continue to the next step.",
    nextPage: "Next",
    pause: "Pause",
    play: "Play",
    replay: "Replay",
    resume: "Resume tour",
}
type Copy = { [K in keyof typeof en]: string }
const cs: Copy = {
    playersNav:
        "Klikněte na Hráči v bočním menu a otevřete seznam hráčů klanu.",
    playerOpen: "Otevřete Atlas a prohlédněte si jeho výkony.",
    playerTrends:
        "Zde jsou stejné ukazatele trendů a grafy jako v profilech hráčů. Najeďte na metriku pro její popis.",
    newMatch: "Kliknutím na Nový zápas otevřete formulář.",
    matchWatch:
        "Sledujte vyplnění týmů, mapy a názvu ve skutečném formuláři. Změny jsou pouze součástí průvodce.",
    matchContinue: "Klikněte na Pokračovat ve formuláři.",
    matchTime:
        "Zde nastavíte začátek hry, sraz a konec přihlášek. Náhled používá stejný harmonogram.",
    matchSignups: "Vyberte oprávněné účastníky, skupiny a jejich kapacitu.",
    matchDiscord:
        "Vyberte Discord kanály, fórum a hlasové kanály. Vedle formuláře se aktualizuje náhled oznámení.",
    matchReview:
        "Před zveřejněním zkontrolujte časy, přihlášky a nastavení Discordu.",
    matchPublish:
        "Klikněte na Zveřejnit pro simulaci vytvoření zápasu. Průvodce zápas neuloží ani neodešle zprávu na Discord.",
    loading: "Otevírání další stránky…",
    exit: "Ukončit průvodce",
    leave: "Pro práci se skutečnými daty ukončete průvodce.",
    example: "Průvodce · Ukázková data",
    missing:
        "Tato část stránky není dostupná. Můžete pokračovat na další krok.",
    nextPage: "Dále",
    pause: "Pozastavit",
    play: "Přehrát",
    replay: "Znovu",
    resume: "Pokračovat v průvodci",
}
const de: Copy = {
    playersNav:
        "Klicke in der Seitenleiste auf Spieler, um die Spielerliste zu öffnen.",
    playerOpen: "Öffne Atlas, um die Leistungsdaten des Spielers zu sehen.",
    playerTrends:
        "Hier siehst du dieselben Trendanzeigen und Leistungsdiagramme wie in Spielerprofilen. Bewege den Zeiger über eine Metrik für Details.",
    newMatch: "Klicke auf Neues Spiel, um das Formular zu öffnen.",
    matchWatch:
        "Sieh zu, wie Teams, Karte und Name im echten Formular ausgefüllt werden. Diese Änderungen bleiben lokal in der Tour.",
    matchContinue: "Klicke im Formular auf Weiter.",
    matchTime:
        "Lege Spielbeginn, Treffpunkt und Anmeldeschluss fest. Die Vorschau verwendet denselben Zeitplan.",
    matchSignups:
        "Wähle die zugelassenen Teilnehmer, Gruppen und Kapazitätsgrenzen.",
    matchDiscord:
        "Wähle Discord-Kanäle, Forum und Sprachkanäle. Die Ankündigungsvorschau wird neben dem Formular aktualisiert.",
    matchReview:
        "Prüfe Zeiten, Anmeldungen und Discord-Einstellungen vor der Veröffentlichung.",
    matchPublish:
        "Klicke auf Veröffentlichen, um die Erstellung zu simulieren. Die Tour speichert kein Spiel und sendet keine Discord-Nachricht.",
    loading: "Nächste Seite wird geöffnet…",
    exit: "Tour beenden",
    leave: "Beende die Tour, um die echten Daten dieser Seite zu verwenden.",
    example: "Tour · Beispieldaten",
    missing:
        "Dieser Teil der Seite ist nicht verfügbar. Du kannst mit dem nächsten Schritt fortfahren.",
    nextPage: "Weiter",
    pause: "Pause",
    play: "Abspielen",
    replay: "Wiederholen",
    resume: "Tour fortsetzen",
}
export function getWalkthroughCopy(locale: Locale): Copy {
    return locale === "cs" ? cs : locale === "de" ? de : en
}
