import type { Locale } from "../config"
const pl: Copy = {
    playersNav:
        "Kliknij Gracze na pasku bocznym, aby otworzyć listę graczy klanu.",
    playerOpen: "Otwórz Atlas, aby zobaczyć zapisy wydajności gracza.",
    playerTrends:
        "Są to te same wskaźniki trendów i wykresy wydajności, które są używane w profilach graczy. Najedź kursorem na dane, aby zobaczyć, co mierzy.",
    newMatch: "Kliknij Nowe dopasowanie, aby otworzyć formularz tworzenia.",
    matchWatch:
        "Obejrzyj, jak w formularzu wypełnia się drużyny, mapę i nazwę meczu. Zmiany te mają charakter lokalny w stosunku do wycieczki.",
    matchContinue:
        "Kliknij przycisk Kontynuuj w formularzu, aby przejść do następnego kroku.",
    matchTime:
        "Ustaw tutaj godzinę rozpoczęcia gry, godzinę spotkania i ostateczny termin rejestracji. Podgląd wykorzystuje ten sam harmonogram.",
    matchSignups:
        "Wybierz, kto może się zarejestrować, oferowane grupy i ich limity pojemności.",
    matchDiscord:
        "Wybierz kanały Discord, opcje forum i kanału głosowego. Podgląd ogłoszenia jest aktualizowany wraz z formularzem.",
    matchReview:
        "Przed publikacją przejrzyj harmonogram, rejestracje i ustawienia Discord.",
    matchPublish:
        "Kliknij opcję Publikuj, aby zasymulować tworzenie tego dopasowania. Trasa nie zapisze dopasowania ani nie wyśle ​​wiadomości Discord.",
    loading: "Otwieranie następnej strony…",
    exit: "Zakończ samouczek",
    leave: "Zakończ wycieczkę, aby korzystać z rzeczywistych danych na tej stronie.",
    example: "Samouczek · Przykładowe dane",
    missing:
        "Ta część strony jest niedostępna. Możesz przejść do następnego kroku.",
    nextPage: "Dalej",
    pause: "Pauza",
    play: "Odtwórz",
    replay: "Powtórka",
    resume: "Wznów samouczek",
}

const fr = {
    playersNav: "Cliquez sur Joueurs dans la barre latérale pour ouvrir la liste des joueurs du clan.",
    playerOpen: "Ouvrez Atlas pour consulter les performances du joueur.",
    playerTrends:
        "Ce sont les mêmes indicateurs d’évolution et graphiques que sur les profils des joueurs. Survolez un indicateur pour savoir ce qu’il mesure.",
    newMatch: "Cliquez sur Nouveau match pour ouvrir le formulaire de création.",
    matchWatch:
        "Regardez le formulaire remplir les équipes, la carte et le nom du match. Ces modifications restent limitées à la visite.",
    matchContinue: "Cliquez sur Continuer dans le formulaire pour passer à l’étape suivante.",
    matchTime:
        "Définissez ici le début de la partie, le rassemblement et la clôture des inscriptions. L’aperçu utilise les mêmes horaires.",
    matchSignups:
        "Choisissez qui peut s’inscrire, les groupes proposés et leurs limites de places.",
    matchDiscord:
        "Choisissez les salons Discord, le forum et les options des salons vocaux. L’aperçu de l’annonce s’actualise avec le formulaire.",
    matchReview:
        "Vérifiez les horaires, inscriptions et paramètres Discord avant de publier.",
    matchPublish:
        "Cliquez sur Publier pour simuler la création du match. La visite n’enregistre aucun match et n’envoie aucun message Discord.",
    loading: "Ouverture de la page suivante…",
    exit: "Quitter la visite",
    leave: "Terminez la visite pour utiliser les données réelles de cette page.",
    example: "Visite · Données d’exemple",
    missing:
        "Cette partie de la page est indisponible. Vous pouvez passer à l’étape suivante.",
    nextPage: "Suivant",
    pause: "Mettre en pause",
    play: "Lancer",
    replay: "Rejouer",
    resume: "Reprendre la visite",
}

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
    return locale === "cs"
        ? cs
        : locale === "de"
          ? de
          : locale === "pl"
            ? pl
            : locale === "fr" ? fr : en
}
