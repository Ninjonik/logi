import type { ChapterId, TourKind } from "@/domain/onboarding/tours"
import type { Locale } from "../config"
type ChapterCopy = Record<
    ChapterId,
    readonly [title: string, body: string, location: string]
>
const pl: ChapterCopy = {
    history: [
        "Zapisane rozgrywki",
        "Przeglądaj zebrane gry serwerowe, sprawdzaj tablice wyników i wybieraj, jak długo mają być przechowywane.",
        "Ustawienia klanu → Serwery gier → Przechowywanie historii",
    ],
    tracking: [
        "Śledzenie Wardogs League",
        "Śledź drużyny ligowe, wprowadzaj mecze do Logi i publikuj aktualizacje ligowe w Discord.",
        "Ustawienia klanu → Wardogs League",
    ],
    commands: [
        "Komendy bota",
        "Wybierz, które polecenia są dostępne, kto może z nich korzystać i w jakich kanałach. Gracze mogą sprawdzić swoje statystyki za pomocą /stats.",
        "Ustawienia klanu → Komendy",
    ],
    welcome: [
        "Samouczek Logi",
        "Zobacz, jak się sprawy mają i obejrzyj przykłady z przykładowym klanem.",
        "Panel zarządzania",
    ],
    workspace: [
        "Wybierz swój klan",
        "Użyj przełącznika klanów, aby poruszać się pomiędzy społecznościami, do których należysz lub którymi zarządzasz.",
        "Pasek boczny → Przełącznik klanów",
    ],
    mode: [
        "Wybierz, ile potrzebujesz",
        "Pełny Logi zawiera zdarzenia i narzędzia Discord. Tryb rywalizacji przechowuje rejestrację drużyn, zawodników i ligi.",
        "Ustawienia klanu → Tryb przestrzeni roboczej",
    ],
    bot: [
        "Zaproś bota",
        "Zaproś Logi do swojego serwera Discord. Umieść jego rolę nad rolami, którymi będzie zarządzał, a następnie odśwież status bota.",
        "Panel → Zaproś bota",
    ],
    overview: [
        "Panel Twojego klanu",
        "Sprawdź następny mecz, oczekujące prace, ostatnie wyniki i występ.",
        "Obszar roboczy → Panel zarządzania",
    ],
    calendar: [
        "Kalendarz",
        "Przeglądaj mecze, treningi i niestandardowe daty. Otwórz wpis, aby zapoznać się ze szczegółami.",
        "Obszar roboczy → Kalendarz",
    ],
    articles: [
        "Artykuły",
        "Publikuj wiadomości klanowe, przewodniki i zasady wraz ze zdjęciami i załącznikami.",
        "Obszar roboczy → Artykuły",
    ],
    players: [
        "Gracze",
        "Zarządzaj członkami, najemnikami, grupami i kontami gier. Otwórz gracz, aby zobaczyć jego zarejestrowane występy.",
        "Konfiguracja → Gracze",
    ],
    performance: [
        "Wyniki",
        "Porównaj nagrane gry i statystyki graczy. Podłącz serwer gry, aby zebrać dane.",
        "Panel · Profil gracza",
    ],
    match: [
        "Utwórz mecz",
        "Wybierz szablon, przeciwników, mapę i czasy. Obejrzyj wypełnienie przykładu.",
        "Operacje → Mecze → Nowe mecz",
    ],
    signups: [
        "Zapisy na Discordzie",
        "Gracze wybierają grupę lub odrzucają Discord. Limity grupowe wysyłają dodatkowe zapisy do rezerw.",
        "Operacje → Mecze",
    ],
    roster: [
        "Zbuduj skład",
        "Przypisz graczy do drużyn i ról, zachowaj rezerwy, a następnie opublikuj w Discord.",
        "Mecze → Składy",
    ],
    attendance: [
        "Obecność",
        "Gracze potwierdzają swoje przydziały na Discord. Przed zamknięciem meczu przejrzyj powiadomienia o obecności i spóźnieniach lub nieobecnościach.",
        "Mecz → Obecność",
    ],
    results: [
        "Wyniki",
        "Zaimportuj nagraną grę, przejrzyj wyniki i potwierdź wynik. Korekty wymagają powodu.",
        "Mecz → Wynik",
    ],
    training: [
        "Treningi",
        "Zaplanuj sesję, zbierz rejestracje i zanotuj zaliczenie lub niepowodzenie dla każdego uczestnika.",
        "Operacje → Treningi",
    ],
    presets: [
        "Szablony i presety",
        "Wykorzystuj ponownie czasy meczów i zasady rejestracji, układy oddział i tematy odpraw.",
        "Ustawienia klanu → Oddział i ustawienia tematów",
    ],
    maps: [
        "Mapy taktyczne",
        "Oznaczaj pozycje, rysuj trasy i przygotowuj slajdy na odprawę meczową.",
        "Mecze → Mapy taktyczne",
    ],
    membership: [
        "Rekrutacja",
        "Skonfiguruj formularz zgłoszeniowy, przejrzyj kandydatów i przypisz role rekrutów lub członków.",
        "Ustawienia klanu → Członkostwo",
    ],
    tickets: [
        "Pomoc",
        "Pozwól graczom otwierać prywatne wątki pomocy z panelu Discord. Ustaw kategorie, pytania i role personelu.",
        "Konfiguracja → Zgłoszenia",
    ],
    competitions: [
        "Rozgrywki",
        "Zarejestruj drużynę, sprawdź zatwierdzenie i śledź dywizje, mecze i wyniki.",
        "Rozgrywki → Rozgrywki",
    ],
    teams: [
        "Drużyny",
        "Połącz drużyny swojego klanu z katalogu. Poproś o brakujący drużyna lub zaproponuj zmiany.",
        "Rozgrywki → Drużyny",
    ],
    panels: [
        "Panele Discord",
        "Publikuj serwery na żywo, wyniki, rankingi ligowe i kalendarz. Wybierz kanały i style wiadomości.",
        "Bot · Ustawienia klanu → Panele Discord",
    ],
    seeding: [
        "Seeding serwera",
        "Zadzwoń do graczy, aby zapełnili serwer. Ustaw harmonogram, próg gracza i rolę powiadamiania.",
        "Ustawienia klanu → Serwer seeding",
    ],
    servers: [
        "Serwery gier",
        "Podłącz CRCON lub Warcon, aby zbierać wyniki i statystyki graczy. Sprawdź tutaj stan połączenia.",
        "Ustawienia klanu → Serwery gier",
    ],
    settings: [
        "Ustawienia klanu",
        "Ustaw gry, kanały, role i dostęp. Wymagane kroki konfiguracji pokazują, czego brakuje.",
        "Konfiguracja → Ustawienia klanu",
    ],
    integrations: [
        "Strona internetowa i integracje",
        "Twórz klucze API o określonym zakresie, konfiguruj logowanie do witryny, subskrybuj kalendarz lub wysyłaj webhooki.",
        "Ustawienia klanu → Strona internetowa i integracje",
    ],
    account: [
        "Twoje konto",
        "Ustaw język, motyw, konta gier i powiadomienia z menu konta.",
        "Pasek boczny → Moje konto",
    ],
    finish: [
        "Gotowy do uruchomienia",
        "Otwórz ponownie tę wycieczkę ze stopki, kiedy tylko jej potrzebujesz.",
        "Stopka → Uruchom samouczek ponownie",
    ],
}

const fr: ChapterCopy = {
    history: [
        "Parties enregistrées",
        "Parcourez les parties collectées sur les serveurs, consultez les tableaux de scores et choisissez leur durée de conservation.",
        "Paramètres du clan → Serveurs de jeu → Conservation de l’historique",
    ],
    tracking: [
        "Suivi Wardogs League",
        "Suivez les équipes de ligue, importez les rencontres dans Logi et publiez les actualités de la ligue sur Discord.",
        "Paramètres du clan → Wardogs League",
    ],
    commands: [
        "Commandes du bot",
        "Choisissez les commandes disponibles, leurs utilisateurs autorisés et leurs salons. Les joueurs peuvent consulter leurs statistiques avec /stats.",
        "Paramètres du clan → Commandes",
    ],
    welcome: [
        "Visite de Logi",
        "Découvrez les rubriques et des exemples avec un clan fictif.",
        "Tableau de bord",
    ],
    workspace: [
        "Choisissez votre clan",
        "Utilisez le sélecteur de clan pour passer d’une communauté à l’autre parmi celles que vous rejoignez ou gérez.",
        "Barre latérale → Sélecteur de clan",
    ],
    mode: [
        "Choisissez les fonctions dont vous avez besoin",
        "Logi complet inclut les événements et les outils Discord. Le mode Compétition conserve les équipes, les joueurs et les inscriptions aux ligues.",
        "Paramètres du clan → Mode de l’espace de travail",
    ],
    bot: [
        "Inviter le bot",
        "Invitez Logi sur votre serveur Discord. Placez son rôle au-dessus de ceux qu’il doit gérer, puis actualisez l’état du bot.",
        "Tableau de bord → Inviter le bot",
    ],
    overview: [
        "Le tableau de bord de votre clan",
        "Consultez le prochain match, les tâches en attente, les résultats récents et les performances.",
        "Espace de travail → Tableau de bord",
    ],
    calendar: [
        "Calendrier",
        "Parcourez les matchs, entraînements et dates personnalisées. Ouvrez un élément pour en voir les détails.",
        "Espace de travail → Calendrier",
    ],
    articles: [
        "Articles",
        "Publiez les actualités, guides et règles du clan avec des images et des pièces jointes.",
        "Espace de travail → Articles",
    ],
    players: [
        "Joueurs",
        "Gérez les membres, mercenaires, groupes et comptes de jeu. Ouvrez la fiche d’un joueur pour consulter ses performances enregistrées.",
        "Configuration → Joueurs",
    ],
    performance: [
        "Performances",
        "Comparez les parties enregistrées et les statistiques des joueurs. Connectez un serveur de jeu pour collecter les données.",
        "Tableau de bord · Profil du joueur",
    ],
    match: [
        "Créer un match",
        "Choisissez un modèle, les adversaires, la carte et les horaires. Regardez l’exemple se remplir.",
        "Opérations → Matchs → Nouveau match",
    ],
    signups: [
        "Inscriptions Discord",
        "Les joueurs choisissent un groupe ou indiquent leur indisponibilité sur Discord. Au-delà des limites de groupe, les inscriptions vont en réserve.",
        "Opérations → Matchs",
    ],
    roster: [
        "Préparer la composition",
        "Affectez les joueurs aux escouades et aux rôles, gardez des réservistes, puis publiez sur Discord.",
        "Matchs → Compositions",
    ],
    attendance: [
        "Présence",
        "Les joueurs confirment leur affectation sur Discord. Vérifiez les présences et les signalements de retard ou d’absence avant de clôturer le match.",
        "Match → Présence",
    ],
    results: [
        "Résultats",
        "Importez une partie enregistrée, vérifiez les scores et confirmez le résultat. Toute correction nécessite un motif.",
        "Match → Résultat",
    ],
    training: [
        "Entraînements",
        "Planifiez une séance, recueillez les inscriptions et indiquez la réussite ou l’échec de chaque participant.",
        "Opérations → Entraînements",
    ],
    presets: [
        "Modèles et configurations",
        "Réutilisez les horaires et règles d’inscription, les structures d’escouades et les sujets de briefing.",
        "Paramètres du clan → Modèles d’escouades et de sujets",
    ],
    maps: [
        "Cartes tactiques",
        "Marquez des positions, tracez des itinéraires et préparez des diapositives pour le briefing du match.",
        "Matchs → Cartes tactiques",
    ],
    membership: [
        "Candidatures au clan",
        "Configurez le formulaire, examinez les candidatures et attribuez les rôles de recrue ou de membre.",
        "Paramètres du clan → Adhésion",
    ],
    tickets: [
        "Tickets",
        "Permettez aux joueurs d’ouvrir des fils privés de support depuis un panneau Discord. Définissez les catégories, questions et rôles de l’équipe de support.",
        "Configuration → Tickets",
    ],
    competitions: [
        "Compétitions",
        "Inscrivez une équipe, vérifiez sa validation et suivez les divisions, rencontres et résultats.",
        "Compétitions → Compétitions",
    ],
    teams: [
        "Équipes",
        "Associez les équipes de votre clan depuis le catalogue. Demandez l’ajout d’une équipe manquante ou proposez des modifications.",
        "Compétitions → Équipes",
    ],
    panels: [
        "Panneaux Discord",
        "Publiez les serveurs en direct, résultats, classements de ligue et calendrier. Choisissez les salons et les styles de message.",
        "Bot · Paramètres du clan → Panneaux Discord",
    ],
    seeding: [
        "Seeding des serveurs",
        "Appelez les joueurs pour remplir un serveur. Définissez un programme, un seuil de joueurs et un rôle de notification.",
        "Paramètres du clan → Seeding des serveurs",
    ],
    servers: [
        "Serveurs de jeu",
        "Connectez CRCON ou Warcon pour collecter les résultats et statistiques des joueurs. Vérifiez ici l’état des connexions.",
        "Paramètres du clan → Serveurs de jeu",
    ],
    settings: [
        "Paramètres du clan",
        "Définissez les jeux, salons, rôles et accès. Les étapes de configuration obligatoires indiquent les éléments manquants.",
        "Configuration → Paramètres du clan",
    ],
    integrations: [
        "Site et intégrations",
        "Créez des clés API aux accès limités, configurez la connexion au site, abonnez-vous au calendrier ou envoyez des webhooks.",
        "Paramètres du clan → Site et intégrations",
    ],
    account: [
        "Votre compte",
        "Réglez la langue, le thème, les comptes de jeu et les notifications depuis le menu du compte.",
        "Barre latérale → Mon compte",
    ],
    finish: [
        "Prêt à commencer",
        "Rouvrez cette visite depuis le pied de page quand vous le souhaitez.",
        "Pied de page → Relancer la visite",
    ],
}

const en: ChapterCopy = {
    history: [
        "Recorded games",
        "Browse collected server games, inspect scoreboards and choose how long they are retained.",
        "Clan settings → Game servers → History retention",
    ],
    tracking: [
        "Wardogs League tracking",
        "Track league teams, bring fixtures into Logi and publish league updates to Discord.",
        "Clan settings → Wardogs League",
    ],
    commands: [
        "Bot commands",
        "Choose which commands are available, who may use them and in which channels. Players can look up their statistics with /stats.",
        "Clan settings → Commands",
    ],
    welcome: [
        "A tour of Logi",
        "See where things are and watch examples with a sample clan.",
        "Dashboard",
    ],
    workspace: [
        "Choose your clan",
        "Use the clan switcher to move between communities you belong to or manage.",
        "Sidebar → Clan switcher",
    ],
    mode: [
        "Choose how much you need",
        "Full Logi includes events and Discord tools. Competition mode keeps teams, players and league registration.",
        "Clan settings → Workspace mode",
    ],
    bot: [
        "Invite the bot",
        "Invite Logi to your Discord server. Put its role above the roles it will manage, then refresh the bot status.",
        "Dashboard → Invite bot",
    ],
    overview: [
        "Your clan dashboard",
        "Check the next match, pending work, recent results and performance.",
        "Workspace → Dashboard",
    ],
    calendar: [
        "Calendar",
        "Browse matches, trainings and custom dates. Open an entry for its details.",
        "Workspace → Calendar",
    ],
    articles: [
        "Articles",
        "Publish clan news, guides and rules with images and attachments.",
        "Workspace → Articles",
    ],
    players: [
        "Players",
        "Manage members, mercenaries, groups and game accounts. Open a player to see their recorded performance.",
        "Configuration → Players",
    ],
    performance: [
        "Performance",
        "Compare recorded games and player statistics. Connect a game server to collect the data.",
        "Dashboard · Player profile",
    ],
    match: [
        "Create a match",
        "Choose a template, opponents, map and times. Watch the example fill in.",
        "Operations → Matches → New match",
    ],
    signups: [
        "Discord sign-ups",
        "Players choose a group or decline on Discord. Group limits send extra sign-ups to reserves.",
        "Operations → Matches",
    ],
    roster: [
        "Build the roster",
        "Assign players to squads and roles, keep reserves, then publish to Discord.",
        "Matches → Rosters",
    ],
    attendance: [
        "Attendance",
        "Players confirm their assignment on Discord. Review attendance and late or absence notices before closing the match.",
        "Match → Attendance",
    ],
    results: [
        "Results",
        "Import a recorded game, review the scores and confirm the result. Corrections require a reason.",
        "Match → Result",
    ],
    training: [
        "Trainings",
        "Schedule a session, collect sign-ups and record pass or fail for each participant.",
        "Operations → Trainings",
    ],
    presets: [
        "Templates and presets",
        "Reuse match times and sign-up rules, squad layouts and briefing topics.",
        "Clan settings → Squad and topic presets",
    ],
    maps: [
        "Tactical maps",
        "Mark positions, draw routes and prepare slides for the match briefing.",
        "Matches → Tactical maps",
    ],
    membership: [
        "Membership applications",
        "Configure the application form, review applicants and assign recruit or member roles.",
        "Clan settings → Membership",
    ],
    tickets: [
        "Tickets",
        "Let players open private support threads from a Discord panel. Set categories, questions and staff roles.",
        "Configuration → Tickets",
    ],
    competitions: [
        "Competitions",
        "Register a team, check approval and follow divisions, fixtures and results.",
        "Competitions → Competitions",
    ],
    teams: [
        "Teams",
        "Link your clan’s teams from the catalogue. Request a missing team or suggest changes.",
        "Competitions → Teams",
    ],
    panels: [
        "Discord panels",
        "Post live servers, results, league standings and the calendar. Choose channels and message styles.",
        "Bot · Clan settings → Discord panels",
    ],
    seeding: [
        "Server seeding",
        "Call players to populate a server. Set a schedule, player threshold and notification role.",
        "Clan settings → Server seeding",
    ],
    servers: [
        "Game servers",
        "Connect CRCON or Warcon to collect results and player statistics. Check connection health here.",
        "Clan settings → Game servers",
    ],
    settings: [
        "Clan settings",
        "Set games, channels, roles and access. Required setup steps show what is missing.",
        "Configuration → Clan settings",
    ],
    integrations: [
        "Website and integrations",
        "Create scoped API keys, configure website sign-in, subscribe to the calendar or send webhooks.",
        "Clan settings → Website and integrations",
    ],
    account: [
        "Your account",
        "Set your language, theme, game accounts and notifications from the account menu.",
        "Sidebar → My account",
    ],
    finish: [
        "Ready to start",
        "Reopen this tour from the footer whenever you need it.",
        "Footer → Restart tour",
    ],
}
const cs: ChapterCopy = {
    history: [
        "Zaznamenané hry",
        "Procházejte hry ze serverů, zkontrolujte výsledkové tabulky a nastavte dobu uchování.",
        "Nastavení klanu → Herní servery → Uchování historie",
    ],
    tracking: [
        "Sledování Wardogs League",
        "Sledujte ligové týmy, přenášejte zápasy do Logi a zveřejňujte ligové aktualizace na Discordu.",
        "Nastavení klanu → Wardogs League",
    ],
    commands: [
        "Příkazy bota",
        "Vyberte dostupné příkazy, oprávněné role a kanály. Hráči si zobrazí statistiky příkazem /stats.",
        "Nastavení klanu → Příkazy",
    ],
    welcome: [
        "Průvodce Logi",
        "Prohlédněte si aplikaci a ukázky s fiktivním klanem.",
        "Dashboard",
    ],
    workspace: [
        "Vyberte klan",
        "Přepínačem klanů přejdete mezi komunitami, do kterých patříte nebo které spravujete.",
        "Boční menu → Přepínač klanů",
    ],
    mode: [
        "Vyberte rozsah funkcí",
        "Plné Logi zahrnuje akce a Discord nástroje. Soutěžní režim ponechá týmy, hráče a přihlášky do lig.",
        "Nastavení klanu → Režim pracovního prostoru",
    ],
    bot: [
        "Pozvěte bota",
        "Pozvěte Logi na Discord server. Jeho roli umístěte nad role, které má spravovat, a obnovte stav bota.",
        "Dashboard → Pozvat bota",
    ],
    overview: [
        "Dashboard klanu",
        "Zkontrolujte příští zápas, čekající úkoly, výsledky a výkony.",
        "Pracovní prostor → Dashboard",
    ],
    calendar: [
        "Kalendář",
        "Procházejte zápasy, tréninky a vlastní termíny. Otevřením položky zobrazíte podrobnosti.",
        "Pracovní prostor → Kalendář",
    ],
    articles: [
        "Články",
        "Zveřejňujte novinky klanu, návody a pravidla s obrázky a přílohami.",
        "Pracovní prostor → Články",
    ],
    players: [
        "Hráči",
        "Spravujte členy, žoldáky, skupiny a herní účty. V profilu hráče najdete zaznamenané výkony.",
        "Konfigurace → Hráči",
    ],
    performance: [
        "Výkony",
        "Porovnejte zaznamenané hry a statistiky hráčů. Pro sběr dat připojte herní server.",
        "Dashboard · Profil hráče",
    ],
    match: [
        "Vytvoření zápasu",
        "Vyberte šablonu, soupeře, mapu a časy. Sledujte vyplnění ukázky.",
        "Operace → Zápasy → Nový zápas",
    ],
    signups: [
        "Přihlášky na Discordu",
        "Hráči na Discordu vyberou skupinu nebo odmítnou účast. Po naplnění skupiny se další přihlásí do záloh.",
        "Operace → Zápasy",
    ],
    roster: [
        "Sestava",
        "Rozdělte hráče do čet a rolí, ponechte zálohy a zveřejněte sestavu na Discordu.",
        "Zápasy → Sestavy",
    ],
    attendance: [
        "Docházka",
        "Hráči potvrzují přiřazení na Discordu. Před uzavřením zápasu zkontrolujte docházku, zpoždění a omluvenky.",
        "Zápas → Docházka",
    ],
    results: [
        "Výsledky",
        "Importujte zaznamenanou hru, zkontrolujte skóre a potvrďte výsledek. Opravy vyžadují důvod.",
        "Zápas → Výsledek",
    ],
    training: [
        "Tréninky",
        "Naplánujte trénink, sbírejte přihlášky a zaznamenejte výsledek každého účastníka.",
        "Operace → Tréninky",
    ],
    presets: [
        "Šablony a předlohy",
        "Opakovaně použijte časy zápasů, pravidla přihlášek, rozložení čet a témata briefingu.",
        "Nastavení klanu → Předlohy čet a témat",
    ],
    maps: [
        "Taktické mapy",
        "Vyznačte pozice, nakreslete trasy a připravte snímky pro briefing zápasu.",
        "Zápasy → Taktické mapy",
    ],
    membership: [
        "Přihlášky do klanu",
        "Nastavte formulář, posuzujte uchazeče a přidělujte role rekrutů nebo členů.",
        "Nastavení klanu → Členství",
    ],
    tickets: [
        "Tikety",
        "Hráči otevřou soukromé vlákno podpory z Discord panelu. Nastavte kategorie, otázky a role podpory.",
        "Konfigurace → Tikety",
    ],
    competitions: [
        "Soutěže",
        "Přihlaste tým, sledujte schválení, divize, zápasy a výsledky.",
        "Soutěže → Soutěže",
    ],
    teams: [
        "Týmy",
        "Propojte týmy klanu s katalogem. Požádejte o chybějící tým nebo navrhněte změny.",
        "Soutěže → Týmy",
    ],
    panels: [
        "Discord panely",
        "Zveřejněte stav serverů, výsledky, ligové tabulky a kalendář. Vyberte kanály a vzhled zpráv.",
        "Bot · Nastavení klanu → Discord panely",
    ],
    seeding: [
        "Plnění serveru",
        "Svolejte hráče na server. Nastavte harmonogram, limit hráčů a roli pro upozornění.",
        "Nastavení klanu → Plnění serveru",
    ],
    servers: [
        "Herní servery",
        "Připojte CRCON nebo Warcon pro sběr výsledků a statistik hráčů. Zde ověříte stav připojení.",
        "Nastavení klanu → Herní servery",
    ],
    settings: [
        "Nastavení klanu",
        "Nastavte hry, kanály, role a přístup. Povinné kroky ukazují, co chybí.",
        "Konfigurace → Nastavení klanu",
    ],
    integrations: [
        "Web a integrace",
        "Vytvořte API klíče, nastavte přihlášení na web, odebírejte kalendář nebo posílejte webhooky.",
        "Nastavení klanu → Web a integrace",
    ],
    account: [
        "Váš účet",
        "V nabídce účtu nastavte jazyk, vzhled, herní účty a upozornění.",
        "Boční menu → Můj účet",
    ],
    finish: [
        "Můžete začít",
        "Průvodce můžete znovu otevřít v patičce.",
        "Patička → Restartovat průvodce",
    ],
}
const de: ChapterCopy = {
    history: [
        "Erfasste Spiele",
        "Durchsuche gesammelte Serverspiele, prüfe Ergebnistabellen und lege die Aufbewahrungsdauer fest.",
        "Clan-Einstellungen → Spielserver → Aufbewahrung",
    ],
    tracking: [
        "Wardogs-League-Tracking",
        "Verfolge Ligateams, übernimm Begegnungen in Logi und veröffentliche Liga-Updates auf Discord.",
        "Clan-Einstellungen → Wardogs League",
    ],
    commands: [
        "Bot-Befehle",
        "Wähle verfügbare Befehle, berechtigte Rollen und Kanäle. Spieler rufen mit /stats ihre Statistiken ab.",
        "Clan-Einstellungen → Befehle",
    ],
    welcome: [
        "Eine Tour durch Logi",
        "Lerne die Anwendung mit Beispielen eines fiktiven Clans kennen.",
        "Dashboard",
    ],
    workspace: [
        "Clan auswählen",
        "Wechsle zwischen den Communities, denen du angehörst oder die du verwaltest.",
        "Seitenleiste → Clanauswahl",
    ],
    mode: [
        "Funktionsumfang wählen",
        "Vollständiges Logi umfasst Events und Discord-Werkzeuge. Der Wettkampfmodus behält Teams, Spieler und Liga-Anmeldungen.",
        "Clan-Einstellungen → Arbeitsbereich-Modus",
    ],
    bot: [
        "Bot einladen",
        "Lade Logi auf euren Discord-Server ein. Platziere seine Rolle über den verwalteten Rollen und aktualisiere den Botstatus.",
        "Dashboard → Bot einladen",
    ],
    overview: [
        "Clan-Dashboard",
        "Prüfe das nächste Spiel, offene Aufgaben, Ergebnisse und Leistungen.",
        "Arbeitsbereich → Dashboard",
    ],
    calendar: [
        "Kalender",
        "Sieh Spiele, Trainings und eigene Termine. Öffne einen Eintrag für Details.",
        "Arbeitsbereich → Kalender",
    ],
    articles: [
        "Artikel",
        "Veröffentliche Clan-Neuigkeiten, Anleitungen und Regeln mit Bildern und Anhängen.",
        "Arbeitsbereich → Artikel",
    ],
    players: [
        "Spieler",
        "Verwalte Mitglieder, Söldner, Gruppen und Spielkonten. Spielerprofile zeigen erfasste Leistungen.",
        "Konfiguration → Spieler",
    ],
    performance: [
        "Leistung",
        "Vergleiche erfasste Spiele und Spielerstatistiken. Verbinde einen Spielserver für die Datensammlung.",
        "Dashboard · Spielerprofil",
    ],
    match: [
        "Spiel erstellen",
        "Wähle Vorlage, Gegner, Karte und Zeiten. Sieh zu, wie das Beispiel ausgefüllt wird.",
        "Operationen → Spiele → Neues Spiel",
    ],
    signups: [
        "Discord-Anmeldungen",
        "Spieler wählen auf Discord eine Gruppe oder sagen ab. Volle Gruppen bieten Reserveplätze an.",
        "Operationen → Spiele",
    ],
    roster: [
        "Aufstellung",
        "Weise Spieler Squads und Rollen zu, verwalte Reserven und veröffentliche auf Discord.",
        "Spiele → Aufstellungen",
    ],
    attendance: [
        "Anwesenheit",
        "Spieler bestätigen ihre Zuweisung auf Discord. Prüfe Anwesenheit, Verspätungen und Abmeldungen vor Spielabschluss.",
        "Spiel → Anwesenheit",
    ],
    results: [
        "Ergebnisse",
        "Importiere ein erfasstes Spiel, prüfe die Punkte und bestätige das Ergebnis. Korrekturen benötigen einen Grund.",
        "Spiel → Ergebnis",
    ],
    training: [
        "Trainings",
        "Plane ein Training, sammle Anmeldungen und erfasse Bestehen oder Nichtbestehen je Teilnehmer.",
        "Operationen → Trainings",
    ],
    presets: [
        "Vorlagen",
        "Verwende Spielzeiten, Anmelderegeln, Squad-Aufteilungen und Briefing-Themen erneut.",
        "Clan-Einstellungen → Squad- und Themenvorlagen",
    ],
    maps: [
        "Taktische Karten",
        "Markiere Positionen, zeichne Routen und bereite Folien für das Briefing vor.",
        "Spiele → Taktische Karten",
    ],
    membership: [
        "Clanbewerbungen",
        "Richte das Formular ein, prüfe Bewerber und vergib Rekruten- oder Mitgliederrollen.",
        "Clan-Einstellungen → Mitgliedschaft",
    ],
    tickets: [
        "Tickets",
        "Spieler öffnen private Support-Threads über ein Discord-Panel. Lege Kategorien, Fragen und Supportrollen fest.",
        "Konfiguration → Tickets",
    ],
    competitions: [
        "Wettbewerbe",
        "Melde ein Team an und verfolge Freigabe, Divisionen, Begegnungen und Ergebnisse.",
        "Wettbewerbe → Wettbewerbe",
    ],
    teams: [
        "Teams",
        "Verknüpfe Clanteams mit dem Katalog. Beantrage fehlende Teams oder schlage Änderungen vor.",
        "Wettbewerbe → Teams",
    ],
    panels: [
        "Discord-Panels",
        "Veröffentliche Serverstatus, Ergebnisse, Ligatabellen und Kalender. Wähle Kanäle und Nachrichtenstile.",
        "Bot · Clan-Einstellungen → Discord-Panels",
    ],
    seeding: [
        "Server-Seeding",
        "Rufe Spieler auf den Server. Lege Zeitplan, Spielergrenze und Benachrichtigungsrolle fest.",
        "Clan-Einstellungen → Server-Seeding",
    ],
    servers: [
        "Spielserver",
        "Verbinde CRCON oder Warcon für Ergebnisse und Spielerstatistiken. Prüfe hier den Verbindungsstatus.",
        "Clan-Einstellungen → Spielserver",
    ],
    settings: [
        "Clan-Einstellungen",
        "Lege Spiele, Kanäle, Rollen und Zugriff fest. Erforderliche Schritte zeigen fehlende Einstellungen.",
        "Konfiguration → Clan-Einstellungen",
    ],
    integrations: [
        "Website und Integrationen",
        "Erstelle API-Schlüssel, konfiguriere Website-Anmeldung, abonniere den Kalender oder sende Webhooks.",
        "Clan-Einstellungen → Website und Integrationen",
    ],
    account: [
        "Dein Konto",
        "Wähle Sprache, Design, Spielkonten und Benachrichtigungen im Kontomenü.",
        "Seitenleiste → Mein Konto",
    ],
    finish: [
        "Bereit zum Start",
        "Öffne diese Tour bei Bedarf erneut über die Fußzeile.",
        "Fußzeile → Tour neu starten",
    ],
}
const labels = {
    pl: {
        memberOverview:
            "Zobacz nadchodzące mecze, ostatnie wyniki i opublikowane składy.",
        memberRoster:
            "Sprawdź swój oddział i rolę w opublikowanym skład na Discord.",
        memberAttendance:
            "Potwierdź swoje przypisanie w Discord. Poinformuj klan, jeśli się spóźnisz lub nie będziesz mógł przybyć.",
        memberArticles: "Przeczytaj wiadomości klanowe, przewodniki i zasady.",
        memberRosterLocation: "Discord → Mój przydział",
        memberAttendanceLocation: "Discord → Przypomnienie o obecności",
        demo: "Przykładowe dane",
        tour: "Samouczek aplikacji",
        chapters: "Rozdziały",
        location: "Gdzie to znaleźć",
        open: "Otwórz tę stronę",
        pause: "Wstrzymaj przykład",
        play: "Odtwórz przykład",
        replay: "Powtórz przykład",
        start: "Rozpocznij samouczek",
        resume: "Wznów samouczek",
        invite: "Zaproś bota",
        setup: "Otwórz konfigurację",
        saved: "Utworzono przykład",
        welcome: "Pierwsze logowanie",
        manager: "Pełny samouczek klanu",
        competitions: "Tryb rywalizacji",
        member: "Samouczek członka",
        "competition-member": "Tryb rywalizacji",
        limitedOverview:
            "Śledź drużyny i zawody swojego klanu w tym obszarze roboczym.",
        limitedSettings:
            "Wybierz tutaj Pełny Logi, jeśli potrzebujesz narzędzi zdarzeń i Discord.",
        limitedMember:
            "Użyj menu konta do obsługi kont gier i powiadomień. Poproś menadżera klanu o zarejestrowanie drużyn.",
        sample: "NOVA · Przykładowy klan",
        done: "Samouczek ukończony",
        finish: "Rozpocznij korzystanie z Logi",
        retry: "Ponów próbę zapisu",
        botPresent: "Bot podłączony",
        guide: "Poradnik konfiguracji",
    },
    fr: {
        memberOverview:
            "Consultez les prochains matchs, résultats récents et compositions publiées.",
        memberRoster:
            "Retrouvez votre escouade et votre rôle dans la composition publiée sur Discord.",
        memberAttendance:
            "Confirmez votre affectation sur Discord. Prévenez le clan si vous serez en retard ou ne pourrez pas venir.",
        memberArticles: "Lisez les actualités, guides et règles du clan.",
        memberRosterLocation: "Discord → Mon affectation",
        memberAttendanceLocation: "Discord → Rappel de présence",

        demo: "Données d’exemple",
        tour: "Visite de l’application",
        chapters: "Chapitres",
        location: "Où trouver cette fonction",
        open: "Ouvrir cette page",
        pause: "Mettre l’exemple en pause",
        play: "Lancer l’exemple",
        replay: "Rejouer l’exemple",
        start: "Commencer la visite",
        resume: "Reprendre la visite",
        invite: "Inviter le bot",
        setup: "Ouvrir la configuration",
        saved: "Exemple créé",
        welcome: "Première connexion",
        manager: "Visite complète du clan",
        competitions: "Mode Compétition",
        member: "Visite membre",
        "competition-member": "Mode Compétition",
        limitedOverview:
            "Suivez les équipes et compétitions de votre clan depuis cet espace.",
        limitedSettings:
            "Choisissez Logi complet ici pour accéder aux événements et aux outils Discord.",
        limitedMember:
            "Utilisez le menu de votre compte pour gérer les comptes de jeu et les notifications. Demandez à un responsable du clan d’inscrire les équipes.",
        sample: "NOVA · Clan d’exemple",
        done: "Visite terminée",
        finish: "Commencer à utiliser Logi",
        retry: "Réessayer l’enregistrement",
        botPresent: "Bot connecté",
        guide: "Guide de configuration",
    },
    en: {
        memberOverview:
            "See upcoming matches, recent results and published rosters.",
        memberRoster:
            "Check your squad and role in the published roster on Discord.",
        memberAttendance:
            "Confirm your assignment on Discord. Let the clan know if you will be late or cannot attend.",
        memberArticles: "Read clan news, guides and rules.",
        memberRosterLocation: "Discord → My assignment",
        memberAttendanceLocation: "Discord → Attendance reminder",

        demo: "Example data",
        tour: "Application tour",
        chapters: "Chapters",
        location: "Where to find it",
        open: "Open this page",
        pause: "Pause example",
        play: "Play example",
        replay: "Replay example",
        start: "Start tour",
        resume: "Resume tour",
        invite: "Invite bot",
        setup: "Open setup",
        saved: "Example created",
        welcome: "First login",
        manager: "Full clan tour",
        competitions: "Competition mode",
        member: "Member tour",
        "competition-member": "Competition mode",
        limitedOverview:
            "Follow your clan’s teams and competitions from this workspace.",
        limitedSettings:
            "Choose Full Logi here when you want event and Discord tools.",
        limitedMember:
            "Use your account menu for game accounts and notifications. Ask a clan manager to register teams.",
        sample: "NOVA · Sample clan",
        done: "Tour complete",
        finish: "Start using Logi",
        retry: "Retry saving",
        botPresent: "Bot connected",
        guide: "Setup guide",
    },
    cs: {
        memberOverview:
            "Prohlédněte si nadcházející zápasy, výsledky a zveřejněné sestavy.",
        memberRoster:
            "Zkontrolujte svou četu a roli ve zveřejněné sestavě na Discordu.",
        memberAttendance:
            "Potvrďte přiřazení na Discordu. Dejte klanu vědět o zpoždění nebo neúčasti.",
        memberArticles: "Čtěte novinky klanu, návody a pravidla.",
        memberRosterLocation: "Discord → Moje přiřazení",
        memberAttendanceLocation: "Discord → Připomínka docházky",

        demo: "Ukázková data",
        tour: "Průvodce aplikací",
        chapters: "Kapitoly",
        location: "Kde to najdete",
        open: "Otevřít stránku",
        pause: "Pozastavit ukázku",
        play: "Spustit ukázku",
        replay: "Přehrát znovu",
        start: "Spustit průvodce",
        resume: "Pokračovat",
        invite: "Pozvat bota",
        setup: "Otevřít nastavení",
        saved: "Ukázka vytvořena",
        welcome: "První přihlášení",
        manager: "Průvodce celým klanem",
        competitions: "Soutěžní režim",
        member: "Průvodce pro členy",
        "competition-member": "Soutěžní režim",
        limitedOverview:
            "Sledujte týmy a soutěže svého klanu v tomto pracovním prostoru.",
        limitedSettings: "Pro akce a Discord nástroje zde vyberte Plné Logi.",
        limitedMember:
            "V nabídce účtu nastavte herní účty a upozornění. Týmy do soutěží přihlašuje správce klanu.",
        sample: "NOVA · Ukázkový klan",
        done: "Průvodce dokončen",
        finish: "Začít používat Logi",
        retry: "Zkusit uložit znovu",
        botPresent: "Bot připojen",
        guide: "Průvodce nastavením",
    },
    de: {
        memberOverview:
            "Sieh kommende Spiele, aktuelle Ergebnisse und veröffentlichte Aufstellungen.",
        memberRoster:
            "Prüfe deinen Squad und deine Rolle in der veröffentlichten Aufstellung auf Discord.",
        memberAttendance:
            "Bestätige deine Zuweisung auf Discord. Melde Verspätungen oder Absagen deinem Clan.",
        memberArticles: "Lies Clan-Neuigkeiten, Anleitungen und Regeln.",
        memberRosterLocation: "Discord → Meine Zuweisung",
        memberAttendanceLocation: "Discord → Anwesenheitserinnerung",

        demo: "Beispieldaten",
        tour: "Anwendungstour",
        chapters: "Kapitel",
        location: "Hier findest du es",
        open: "Seite öffnen",
        pause: "Beispiel pausieren",
        play: "Beispiel abspielen",
        replay: "Beispiel wiederholen",
        start: "Tour starten",
        resume: "Tour fortsetzen",
        invite: "Bot einladen",
        setup: "Einrichtung öffnen",
        saved: "Beispiel erstellt",
        welcome: "Erste Anmeldung",
        manager: "Vollständige Clantour",
        competitions: "Wettkampfmodus",
        member: "Mitgliedertour",
        "competition-member": "Wettkampfmodus",
        limitedOverview:
            "Verfolge die Teams und Wettbewerbe deines Clans in diesem Arbeitsbereich.",
        limitedSettings:
            "Wähle hier Vollständiges Logi für Events und Discord-Werkzeuge.",
        limitedMember:
            "Verwalte Spielkonten und Benachrichtigungen im Kontomenü. Clanmanager melden Teams an.",
        sample: "NOVA · Beispielclan",
        done: "Tour abgeschlossen",
        finish: "Logi verwenden",
        retry: "Speichern wiederholen",
        botPresent: "Bot verbunden",
        guide: "Einrichtungsanleitung",
    },
}
export function getOnboardingCopy(locale: Locale) {
    return {
        chapters:
            locale === "cs"
                ? cs
                : locale === "de"
                  ? de
                  : locale === "pl"
                    ? pl
                    : locale === "fr" ? fr : en,
        labels: labels[locale],
    }
}
export type OnboardingCopy = ReturnType<typeof getOnboardingCopy>
export function tourLabel(copy: OnboardingCopy, kind: TourKind) {
    return copy.labels[kind]
}
