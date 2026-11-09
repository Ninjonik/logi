import type { PluralForms } from "../discord-messages/format"

/**
 * The `/stats` replies (board M2 1.2) in the clan language, never the
 * member's Discord language. Czech is verbatim from the board; the bot says
 * "ty" ("du"). The command's description and options live with the other
 * registration texts in `src/lib/clan-language/commands.ts`.
 */
export type StatsCopy = {
    periodLabels: { "7d": string; "30d": string; "90d": string; all: string }
    periodPhrases: { "7d": string; "30d": string; "90d": string; all: string }
    /** The "období" choices as Discord shows them, for the next-step hint. */
    periodChoices: { "7d": string; "30d": string; "90d": string; all: string }
    games: { hll: string; wardogs: string }
    kills: string
    deaths: string
    kd: string
    wins: string
    matches: string
    winRate: string
    playtime: string
    cash: string
    coverage: string
    coverageNames: {
        killsKd: string
        kills: string
        deaths: string
        cashDelta: string
        seconds: string
    }
    hllDetail: string
    form: string
    stale: string
    recentTitle: string
    factionsTitle: string
    weaponsTitle: string
    mapsTitle: string
    results: { win: string; loss: string; draw: string; unknown: string }
    recentRow: string
    factionRow: string
    noItems: string
    overview: string
    recent: string
    factions: string
    weapons: string
    maps: string
    share: string
    hllProfile: string
    addSteam: string
    chooseSteam: string
    sourceWarcon: string
    sourceGames: string
    dataAt: string
    gamesCount: PluralForms
    sourceHll: string
    sharedBy: string
    sharedWarcon: string
    sharedHll: string
    missingTitle: string
    missingBody: string
    declared: string
    ambiguousTitle: string
    ambiguousBody: string
    otherMissingTitle: string
    otherMissingBody: string
    otherAmbiguousTitle: string
    otherAmbiguousBody: string
    otherFallbackName: string
    emptySelf: string
    emptyOther: string
    emptyNext: string
    emptyHll: string
    modalTitle: string
    modalLabel: string
    modalPlaceholder: string
    retry: string
    errors: {
        unavailableTitle: string
        unavailableWarcon: string
        unavailableHll: string
        blockedTitle: string
        blockedBody: string
        gameDisabledTitle: string
        gameDisabledBody: string
        invalidTitle: string
        invalidBody: string
        hllOnlyTitle: string
        hllOnlyBody: string
        busyTitle: string
        busyBody: string
        expiredTitle: string
        expiredBody: string
        ownOnlyTitle: string
        ownOnlyBody: string
        forbiddenTitle: string
        forbiddenBody: string
        incompleteTitle: string
        incompleteBody: string
        notConfiguredTitle: string
        notConfiguredBody: string
        linkChangedTitle: string
        linkChangedBody: string
        alreadyLinkedTitle: string
        alreadyLinkedBody: string
        invalidSteamTitle: string
        invalidSteamBody: string
        linkErrorTitle: string
        linkErrorBody: string
    }
    shareFlow: {
        promptTitle: string
        selectChannel: string
        back: string
        sharedTitle: string
        viewMessage: string
        deniedTitle: string
        deniedBody: string
        chooseOther: string
        failedTitle: string
        failedBody: string
        alreadyTitle: string
        alreadyBody: string
    }
}

const pl: StatsCopy = {
    periodChoices: {
        "7d": "7 dni",
        "30d": "30 dni",
        "90d": "90 dni",
        all: "Cała historia",
    },
    periodLabels: {
        "7d": "Ostatnie 7 dni",
        "30d": "Ostatnie 30 dni",
        "90d": "Ostatnie 90 dni",
        all: "Cała historia",
    },
    periodPhrases: {
        "7d": "z ostatnich 7 dni",
        "30d": "z ostatnich 30 dni",
        "90d": "z ostatnich 90 dni",
        all: "cała historia",
    },
    games: { hll: "Hell Let Loose", wardogs: "Wardogs" },
    kills: "Zabójstwa",
    deaths: "Zgony",
    kd: "K/D",
    wins: "Wygrane",
    matches: "Rozegrane gry",
    winRate: "Współczynnik wygranych {rate} %",
    playtime: "czas gry: {hours} h",
    cash: "zmiana salda: {cash}",
    coverage: "Dane {metrics} są dostępne dla {known} z {total} rozgrywek.",
    coverageNames: {
        killsKd: "zabójstwa i K/D",
        kills: "zabójstwa",
        deaths: "zgony",
        cashDelta: "zmiana salda",
        seconds: "czas gry",
    },
    hllDetail: "Czas gry: {hours} h · ELO piechoty {elo} · teamkille {tk}",
    form: "Forma: {rate} % wygranych w ostatnich 100 rozgrywkach trwających ponad 20 minut",
    stale: "Wyświetlanie ostatniego odczytu danych; w tej chwili nie można odświeżyć źródła.",
    recentTitle: "{name} · ostatnie gry",
    factionsTitle: "{name} · frakcje",
    weaponsTitle: "{name} · broń",
    mapsTitle: "{name} · mapy",
    results: {
        win: "Wygrana",
        loss: "Porażka",
        draw: "Remis",
        unknown: "Brak wyniku",
    },
    recentRow: "{map} · {day} · zabójstwa: {kills}, zgony: {deaths}",
    factionRow: "Wygrane: {wins} z {matches} · zabójstwa: {kills}",
    noItems: "Nie ma jeszcze żadnych szczegółów.",
    overview: "Przegląd",
    recent: "Ostatnie gry",
    factions: "Frakcje",
    weapons: "Broń",
    maps: "Mapy",
    share: "Udostępnij",
    hllProfile: "Profil w HLL Records",
    addSteam: "Dodaj Steam",
    chooseSteam: "Wybierz Steam",
    sourceWarcon: "Źródło: Warcon klanu",
    sourceGames: "{games} na serwerach klanu",
    dataAt: "Dane z {time}",
    gamesCount: {
        one: "{count} rozgrywka",
        few: "{count} rozgrywki",
        many: "{count} rozgrywek",
        other: "{count} rozgrywek",
    },
    sourceHll:
        "Źródło: HLL Records · Tylko śledzone serwery społeczności · + oznacza co najmniej",
    sharedBy: "Udostępnione przez {user} · od {time}",
    sharedWarcon: "Warcon klanu",
    sharedHll: "HLL Records",
    missingTitle: "Nie dodałeś konta Steam",
    missingBody:
        "Sprawdzamy statystyki według identyfikatora Steam. Dodaj go, a my załadujemy je od razu.",
    declared:
        "Podany identyfikator służy do odczytu publicznych statystyk i nie potwierdza własności konta. Steam zweryfikujesz w Logi → Moje konto.",
    ambiguousTitle: "Masz połączonych kilka kont Steam",
    ambiguousBody: "Wybierz ten, który ma być używany do statystyk.",
    otherMissingTitle: "{name} nie ma połączonego Steam",
    otherMissingBody:
        "Ta osoba może samodzielnie dodać konto za pomocą /stats.",
    otherAmbiguousTitle: "{name} ma kilka połączonych kont Steam",
    otherAmbiguousBody:
        "Ta osoba musi samodzielnie wybrać konto za pomocą /stats.",
    otherFallbackName: "Ten gracz",
    emptySelf:
        "Nie masz zapisanych rozgrywek na serwerach klanu — okres: {period}.",
    emptyOther:
        "Brak zapisanych rozgrywek na serwerach klanu — okres: {period}.",
    emptyNext: "Wypróbuj dłuższy okres: /stats gra: {game} okres: {next}.",
    emptyHll: "Brak rozgrywek w HLL Records — okres: {period}.",
    modalTitle: "Połącz Steam",
    modalLabel: "Steam ID lub link do profilu",
    modalPlaceholder: "76561198… lub steamcommunity.com/profiles/…",
    retry: "Wprowadź ponownie",
    errors: {
        unavailableTitle: "Nie można teraz załadować statystyk",
        unavailableWarcon:
            "Warcon klanu nie odpowiada. Twój Steam pozostaje zapisany, spróbuj ponownie za kilka minut.",
        unavailableHll:
            "HLL Records nie odpowiada. Twój Steam pozostaje zapisany, spróbuj ponownie za kilka minut.",
        blockedTitle: "HLL Records nie wpuszcza teraz bota",
        blockedBody:
            "Otwórz profil samodzielnie. Twój Steam pozostaje zapisany.",
        gameDisabledTitle: "Statystyki {game} są tutaj wyłączone",
        gameDisabledBody:
            "Menedżer może je włączyć w Logi → Ustawienia → Polecenia.",
        invalidTitle: "Wybierz tylko jednego gracza",
        invalidBody: "Członek serwera lub gracz Wardogs z sugestii.",
        hllOnlyTitle: "Ta opcja działa tylko w Wardogs",
        hllOnlyBody:
            "Wyszukiwanie graczy i filtrowanie serwerów dotyczy Wardogs. Dla Hell Let Loose wybierz członka serwera.",
        busyTitle: "Poczekaj chwilę",
        busyBody:
            "Twoje poprzednie żądanie jest nadal aktywne. Spróbuj ponownie za kilka sekund.",
        expiredTitle: "Ta oferta nie jest już aktualna",
        expiredBody: "Uruchom ponownie /stats.",
        ownOnlyTitle: "Te przyciski należą do kogoś innego",
        ownOnlyBody:
            "Może z nich korzystać tylko osoba, która uruchomiła /stats.",
        forbiddenTitle: "Nie jest to teraz możliwe",
        forbiddenBody:
            "Uruchom ponownie /stats na serwerze, którego jesteś członkiem.",
        incompleteTitle: "Nie można odczytać całej historii",
        incompleteBody: "Spróbuj ponownie lub wybierz krótszy okres.",
        notConfiguredTitle: "Logi nie jest jeszcze tutaj skonfigurowane",
        notConfiguredBody:
            "Menedżer serwera łączy Discord z Logi w Internecie.",
        linkChangedTitle: "Powiązanie konta zmieniło się w międzyczasie",
        linkChangedBody: "Uruchom ponownie /stats.",
        alreadyLinkedTitle: "Inny gracz ma już ten Steam",
        alreadyLinkedBody:
            "Poproś zarządzających klanem o sprawdzenie powiązania konta.",
        invalidSteamTitle: "To nie wygląda na identyfikator Steam",
        invalidSteamBody:
            "Ma 17 cyfr i zaczyna się od 7656119 lub jest to link do steamcommunity.com/profiles/….",
        linkErrorTitle: "Nie można potwierdzić zapisu",
        linkErrorBody:
            "Uruchom /stats, aby sprawdzić, czy Twój Steam jest połączony. Menedżer może pomóc.",
    },
    shareFlow: {
        promptTitle: "Gdzie powinna zostać umieszczona karta?",
        selectChannel: "Wybierz kanał",
        back: "Wstecz",
        sharedTitle: "Udostępniono na {channel}",
        viewMessage: "Wyświetl wiadomość",
        deniedTitle: "Nie możesz teraz udostępnić karty na {channel}",
        deniedBody:
            "Ty i bot potrzebujecie uprawnień do wysyłania wiadomości i osadzania łączy w tym kanale. Wybierz inny kanał.",
        chooseOther: "Wybierz inny kanał",
        failedTitle: "Nie można potwierdzić udostępniania",
        failedBody:
            "Sprawdź kanał przed ponownym udostępnieniem, karta może już tam być.",
        alreadyTitle: "Ta karta jest już udostępniona",
        alreadyBody: "Uruchom ponownie /stats, aby uzyskać nową kartę.",
    },
}

const fr: StatsCopy = {
    periodChoices: {
        "7d": "7 jours",
        "30d": "30 jours",
        "90d": "90 jours",
        all: "Tout l’historique",
    },
    periodLabels: {
        "7d": "7 derniers jours",
        "30d": "30 derniers jours",
        "90d": "90 derniers jours",
        all: "Tout l’historique",
    },
    periodPhrases: {
        "7d": "les 7 derniers jours",
        "30d": "les 30 derniers jours",
        "90d": "les 90 derniers jours",
        all: "tout l’historique",
    },
    games: { hll: "Hell Let Loose", wardogs: "Wardogs" },
    kills: "Kills",
    deaths: "Morts",
    kd: "K/D",
    wins: "Victoires",
    matches: "Jeux",
    winRate: "Taux de victoire : {rate} %",
    playtime: "{hours} h jouées",
    cash: "variation d’argent : {cash}",
    coverage: "Nous disposons de {metrics} pour {known} parties sur {total}.",
    coverageNames: {
        killsKd: "les kills et le K/D",
        kills: "kills",
        deaths: "morts",
        cashDelta: "la variation d’argent",
        seconds: "le temps de jeu",
    },
    hllDetail: "{hours} h jouées · ELO infanterie {elo} · kills alliés {tk}",
    form: "Forme : {rate} % de victoires sur les 100 dernières parties de plus de 20 min",
    stale: "Les dernières données lues sont affichées ; la source n’a pas pu être actualisée pour le moment.",
    recentTitle: "{name} · parties récentes",
    factionsTitle: "{name} · factions",
    weaponsTitle: "{name} · armes",
    mapsTitle: "{name} · cartes",
    results: { win: "Victoire", loss: "Défaite", draw: "Match nul", unknown: "Sans résultat" },
    recentRow: "{map} · {day} · {kills} kills, {deaths} morts",
    factionRow: "{wins} victoires sur {matches} matchs · {kills} kills",
    noItems: "Aucun détail pour le moment.",
    overview: "Vue d’ensemble",
    recent: "Parties récentes",
    factions: "Factions",
    weapons: "Armes",
    maps: "Cartes",
    share: "Partager",
    hllProfile: "Profil HLL Records",
    addSteam: "Ajouter Steam",
    chooseSteam: "Choisir Steam",
    sourceWarcon: "Source : Warcon du clan",
    sourceGames: "{games} sur les serveurs du clan",
    dataAt: "données de {time}",
    gamesCount: { one: "{count} partie", other: "{count} parties" },
    sourceHll:
        "Source : HLL Records · serveurs communautaires suivis uniquement · + signifie au moins",
    sharedBy: "Partagé par {user} · données au {time}",
    sharedWarcon: "Warcon du clan",
    sharedHll: "HLL Records",
    missingTitle: "Tu n’as pas ajouté de compte Steam",
    missingBody:
        "Nous recherchons les statistiques par identifiant Steam. Ajoute-le pour les charger immédiatement.",
    declared:
        "Cette déclaration sert aux statistiques publiques et ne vérifie pas ton compte. Pour associer un compte Steam vérifié, ouvre Logi → Mon compte.",
    ambiguousTitle: "Tu as plusieurs comptes Steam associés",
    ambiguousBody: "Choisis celui à utiliser pour les statistiques.",
    otherMissingTitle: "{name} n’a pas de compte Steam associé",
    otherMissingBody: "Ce joueur peut l’ajouter avec /stats.",
    otherAmbiguousTitle: "{name} a plusieurs comptes Steam associés",
    otherAmbiguousBody: "Ce joueur doit en choisir un avec /stats.",
    otherFallbackName: "Ce joueur",
    emptySelf: "Tu n’as joué aucune partie sur les serveurs du clan sur la période : {period}.",
    emptyOther: "Aucune partie sur les serveurs du clan sur la période : {period}.",
    emptyNext: "Essaie une période plus longue : /stats game: {game} period: {next}.",
    emptyHll: "HLL Records ne contient aucune partie sur la période : {period}.",
    modalTitle: "Associer Steam",
    modalLabel: "Steam ID ou lien du profil",
    modalPlaceholder: "76561198… ou steamcommunity.com/profiles/…",
    retry: "Saisir à nouveau",
    errors: {
        unavailableTitle: "Impossible de charger les statistiques pour le moment",
        unavailableWarcon:
            "Le Warcon du clan ne répond pas. Ton compte Steam reste enregistré ; réessaie dans quelques minutes.",
        unavailableHll:
            "HLL Records ne répond pas. Ton compte Steam reste enregistré ; réessaie dans quelques minutes.",
        blockedTitle: "HLL Records bloque l’accès du bot pour le moment",
        blockedBody: "Ouvre le profil directement. Ton compte Steam reste enregistré.",
        gameDisabledTitle: "Les statistiques {game} sont désactivées ici",
        gameDisabledBody:
            "Un responsable peut les activer dans Logi → Paramètres → Commandes.",
        invalidTitle: "Choisis un seul joueur",
        invalidBody:
            "Un membre du serveur ou un joueur Wardogs parmi les suggestions.",
        hllOnlyTitle: "Cette option fonctionne uniquement pour Wardogs",
        hllOnlyBody:
            "La recherche de joueurs et le filtre de serveur concernent Wardogs. Pour Hell Let Loose, choisis un membre du serveur.",
        busyTitle: "Patiente un instant",
        busyBody:
            "Ta demande précédente est encore en cours. Réessaie dans quelques secondes.",
        expiredTitle: "Cette proposition n’est plus valide",
        expiredBody: "Relance /stats.",
        ownOnlyTitle: "Ces boutons appartiennent à quelqu’un d’autre",
        ownOnlyBody: "Seule la personne qui a lancé /stats peut les utiliser.",
        forbiddenTitle: "Ce n’est pas possible pour le moment",
        forbiddenBody: "Relance /stats sur un serveur dont tu es membre.",
        incompleteTitle: "L’historique n’a pas pu être lu entièrement",
        incompleteBody: "Réessaie ou choisis une période plus courte.",
        notConfiguredTitle: "Logi n’est pas encore configuré ici",
        notConfiguredBody:
            "Un responsable du serveur doit associer Discord à Logi sur le site.",
        linkChangedTitle: "L’association a changé entre-temps",
        linkChangedBody: "Relance /stats.",
        alreadyLinkedTitle: "Ce compte Steam est déjà associé à un autre joueur",
        alreadyLinkedBody: "Demande aux responsables du clan de vérifier l’association.",
        invalidSteamTitle: "Cela ne ressemble pas à un identifiant Steam",
        invalidSteamBody:
            "Il comporte 17 chiffres et commence par 7656119, ou prend la forme d’un lien steamcommunity.com/profiles/….",
        linkErrorTitle: "L’enregistrement n’a pas pu être confirmé",
        linkErrorBody:
            "Lance /stats pour vérifier si ton compte Steam est associé. Un responsable peut t’aider.",
    },
    shareFlow: {
        promptTitle: "Où publier la fiche ?",
        selectChannel: "Choisir un salon",
        back: "Retour",
        sharedTitle: "Partagé dans {channel}",
        viewMessage: "Voir le message",
        deniedTitle: "Tu ne peux pas partager dans {channel} pour le moment",
        deniedBody:
            "Le bot et toi devez pouvoir envoyer des messages et intégrer des liens dans ce salon. Choisis un autre salon.",
        chooseOther: "Choisis un autre salon",
        failedTitle: "Impossible de confirmer le partage",
        failedBody:
            "Vérifie le salon avant de partager à nouveau : la fiche s’y trouve peut-être déjà.",
        alreadyTitle: "Cette fiche a déjà été partagée",
        alreadyBody: "Relance /stats pour générer une nouvelle fiche.",
    },
}

const en: StatsCopy = {
    periodChoices: {
        "7d": "7 days",
        "30d": "30 days",
        "90d": "90 days",
        all: "All history",
    },
    periodLabels: {
        "7d": "Last 7 days",
        "30d": "Last 30 days",
        "90d": "Last 90 days",
        all: "All history",
    },
    periodPhrases: {
        "7d": "the last 7 days",
        "30d": "the last 30 days",
        "90d": "the last 90 days",
        all: "the whole history",
    },
    games: { hll: "Hell Let Loose", wardogs: "Wardogs" },
    kills: "Kills",
    deaths: "Deaths",
    kd: "K/D",
    wins: "Wins",
    matches: "Games",
    winRate: "Win rate {rate} %",
    playtime: "played {hours} h",
    cash: "cash change {cash}",
    coverage: "We know {metrics} for {known} of {total} games.",
    coverageNames: {
        killsKd: "kills and K/D",
        kills: "kills",
        deaths: "deaths",
        cashDelta: "the cash change",
        seconds: "the playtime",
    },
    hllDetail: "Played {hours} h · infantry ELO {elo} · team kills {tk}",
    form: "Form: {rate} % wins in the last 100 games longer than 20 min",
    stale: "Showing the last data read; the source couldn't be refreshed just now.",
    recentTitle: "{name} · recent games",
    factionsTitle: "{name} · factions",
    weaponsTitle: "{name} · weapons",
    mapsTitle: "{name} · maps",
    results: { win: "Win", loss: "Loss", draw: "Draw", unknown: "No result" },
    recentRow: "{map} · {day} · {kills} kills, {deaths} deaths",
    factionRow: "{wins} of {matches} wins · {kills} kills",
    noItems: "No details yet.",
    overview: "Overview",
    recent: "Recent games",
    factions: "Factions",
    weapons: "Weapons",
    maps: "Maps",
    share: "Share",
    hllProfile: "Profile on HLL Records",
    addSteam: "Add Steam",
    chooseSteam: "Choose Steam",
    sourceWarcon: "Source: the clan's Warcon",
    sourceGames: "{games} on the clan's servers",
    dataAt: "data from {time}",
    gamesCount: { one: "{count} game", other: "{count} games" },
    sourceHll:
        "Source: HLL Records · tracked community servers only · + means at least",
    sharedBy: "Shared by {user} · as of {time}",
    sharedWarcon: "The clan's Warcon",
    sharedHll: "HLL Records",
    missingTitle: "You haven't added a Steam account",
    missingBody:
        "We look statistics up by Steam ID. Add it and we'll load them right away.",
    declared:
        "It's your statement for public statistics, not a verification. You link a verified Steam in Logi → My account.",
    ambiguousTitle: "You have several Steam accounts linked",
    ambiguousBody: "Choose the one to use for statistics.",
    otherMissingTitle: "{name} has no Steam linked",
    otherMissingBody: "They can add it themselves with /stats.",
    otherAmbiguousTitle: "{name} has several Steam accounts linked",
    otherAmbiguousBody: "They have to choose one themselves with /stats.",
    otherFallbackName: "This player",
    emptySelf: "You have no game on the clan's servers in {period}.",
    emptyOther: "No game on the clan's servers in {period}.",
    emptyNext: "Try a longer period: /stats game: {game} period: {next}.",
    emptyHll: "HLL Records has no game in {period}.",
    modalTitle: "Link Steam",
    modalLabel: "Steam ID or profile link",
    modalPlaceholder: "76561198… or steamcommunity.com/profiles/…",
    retry: "Enter again",
    errors: {
        unavailableTitle: "Statistics can't be loaded right now",
        unavailableWarcon:
            "The clan's Warcon isn't answering. Your Steam stays saved, try again in a few minutes.",
        unavailableHll:
            "HLL Records isn't answering. Your Steam stays saved, try again in a few minutes.",
        blockedTitle: "HLL Records isn't letting the bot in right now",
        blockedBody: "Open the profile yourself. Your Steam stays saved.",
        gameDisabledTitle: "{game} statistics are switched off here",
        gameDisabledBody:
            "A manager can switch them on in Logi → Settings → Commands.",
        invalidTitle: "Choose just one player",
        invalidBody:
            "Either a server member, or a Wardogs player from the suggestions.",
        hllOnlyTitle: "That works only for Wardogs",
        hllOnlyBody:
            "Player search and the server filter are for Wardogs. For Hell Let Loose choose a server member.",
        busyTitle: "Give it a moment",
        busyBody:
            "Your previous request is still running. Try again in a few seconds.",
        expiredTitle: "This offer is no longer valid",
        expiredBody: "Run /stats again.",
        ownOnlyTitle: "These buttons belong to someone else",
        ownOnlyBody: "Only the person who ran /stats can use them.",
        forbiddenTitle: "That isn't possible right now",
        forbiddenBody: "Run /stats again in a server you're a member of.",
        incompleteTitle: "The history couldn't be read completely",
        incompleteBody: "Try again or choose a shorter period.",
        notConfiguredTitle: "Logi isn't set up here yet",
        notConfiguredBody:
            "A server manager connects Discord to Logi on the web.",
        linkChangedTitle: "The link changed in the meantime",
        linkChangedBody: "Run /stats again.",
        alreadyLinkedTitle: "Another player already has this Steam",
        alreadyLinkedBody: "Ask the clan's managers to check the link.",
        invalidSteamTitle: "That doesn't look like a Steam ID",
        invalidSteamBody:
            "It has 17 digits and starts with 7656119, or it's a steamcommunity.com/profiles/… link.",
        linkErrorTitle: "Saving couldn't be confirmed",
        linkErrorBody:
            "Run /stats to check whether your Steam is linked. A manager can help.",
    },
    shareFlow: {
        promptTitle: "Where should the card go?",
        selectChannel: "Choose a channel",
        back: "Back",
        sharedTitle: "Shared to {channel}",
        viewMessage: "View message",
        deniedTitle: "You can't share to {channel} right now",
        deniedBody:
            "You and the bot need permission to send messages and embed links in that channel. Choose another channel.",
        chooseOther: "Choose another channel",
        failedTitle: "Sharing couldn't be confirmed",
        failedBody:
            "Check the channel before you share again, the card may already be there.",
        alreadyTitle: "This card is already shared",
        alreadyBody: "Run /stats again for a new card.",
    },
}

const cs: StatsCopy = {
    periodChoices: {
        "7d": "7 dní",
        "30d": "30 dní",
        "90d": "90 dní",
        all: "Celá historie",
    },
    periodLabels: {
        "7d": "Posledních 7 dní",
        "30d": "Posledních 30 dní",
        "90d": "Posledních 90 dní",
        all: "Celá historie",
    },
    periodPhrases: {
        "7d": "posledních 7 dní",
        "30d": "posledních 30 dní",
        "90d": "posledních 90 dní",
        all: "celou historii",
    },
    games: { hll: "Hell Let Loose", wardogs: "Wardogs" },
    kills: "Zabití",
    deaths: "Úmrtí",
    kd: "K/D",
    wins: "Výhry",
    matches: "Hry",
    winRate: "Úspěšnost {rate} %",
    playtime: "odehráno {hours} h",
    cash: "změna cash {cash}",
    coverage: "{metrics} známe {from} {known} {fromTotal} {total} her.",
    coverageNames: {
        killsKd: "Zabití a K/D",
        kills: "Zabití",
        deaths: "Úmrtí",
        cashDelta: "Změnu cash",
        seconds: "Odehraný čas",
    },
    hllDetail:
        "Odehráno {hours} h · ELO pěchoty {elo} · zabití spoluhráčů {tk}",
    form: "Forma: {rate} % výher v posledních 100 hrách delších než 20 min",
    stale: "Ukazuju poslední načtená data, zdroj se teď nepodařilo obnovit.",
    recentTitle: "{name} · poslední hry",
    factionsTitle: "{name} · frakce",
    weaponsTitle: "{name} · zbraně",
    mapsTitle: "{name} · mapy",
    results: {
        win: "Výhra",
        loss: "Prohra",
        draw: "Remíza",
        unknown: "Bez výsledku",
    },
    recentRow: "{map} · {day} · {kills} zabití, {deaths} úmrtí",
    factionRow: "{wins} {from} {matches} výher · {kills} zabití",
    noItems: "Podrobnosti zatím nejsou k dispozici.",
    overview: "Přehled",
    recent: "Poslední hry",
    factions: "Frakce",
    weapons: "Zbraně",
    maps: "Mapy",
    share: "Sdílet",
    hllProfile: "Profil na HLL Records",
    addSteam: "Přidat Steam",
    chooseSteam: "Vybrat Steam",
    sourceWarcon: "Zdroj: Warcon klanu",
    sourceGames: "{games} na serverech klanu",
    dataAt: "data z {time}",
    gamesCount: {
        one: "{count} hra",
        few: "{count} hry",
        other: "{count} her",
    },
    sourceHll:
        "Zdroj: HLL Records · jen sledované komunitní servery · + znamená nejméně",
    sharedBy: "Sdílel {user} · stav k {time}",
    sharedWarcon: "Warcon klanu",
    sharedHll: "HLL Records",
    missingTitle: "Chybí ti Steam účet",
    missingBody:
        "Statistiky hledáme podle Steam ID. Přidej ho a hned je načteme.",
    declared:
        "Je to tvoje prohlášení pro veřejné statistiky, ne ověření. Ověřený Steam propojíš v Logi → Můj účet.",
    ambiguousTitle: "Máš propojených víc Steam účtů",
    ambiguousBody: "Vyber, který z nich se má pro statistiky použít.",
    otherMissingTitle: "{name} nemá propojený Steam",
    otherMissingBody: "Může si ho přidat sám přes /stats.",
    otherAmbiguousTitle: "{name} má propojených víc Steam účtů",
    otherAmbiguousBody: "Vybrat si ho musí sám přes /stats.",
    otherFallbackName: "Tento hráč",
    emptySelf: "Za {period} nemáš na serverech klanu žádnou hru.",
    emptyOther: "Za {period} nemá na serverech klanu žádnou hru.",
    emptyNext: "Zkus delší období: /stats hra: {game} období: {next}.",
    emptyHll: "HLL Records za {period} nemá žádnou hru.",
    modalTitle: "Propojit Steam",
    modalLabel: "Steam ID nebo odkaz na profil",
    modalPlaceholder: "76561198… nebo steamcommunity.com/profiles/…",
    retry: "Zadat znovu",
    errors: {
        unavailableTitle: "Statistiky se teď nedají načíst",
        unavailableWarcon:
            "Warcon klanu neodpovídá. Tvůj Steam zůstává uložený, zkus to za pár minut.",
        unavailableHll:
            "HLL Records neodpovídá. Tvůj Steam zůstává uložený, zkus to za pár minut.",
        blockedTitle: "HLL Records teď bota nepustí",
        blockedBody: "Profil si otevři sám. Tvůj Steam zůstává uložený.",
        gameDisabledTitle: "Statistiky {game} jsou tu vypnuté",
        gameDisabledBody:
            "Zapnout je může správce v Logi → Nastavení → Příkazy.",
        invalidTitle: "Vyber jen jednoho hráče",
        invalidBody: "Buď člena serveru, nebo hráče Wardogs z nabídky.",
        hllOnlyTitle: "Tohle jde jen u Wardogs",
        hllOnlyBody:
            "Hledání hráče a výběr serveru jsou pro Wardogs. U Hell Let Loose vyber člena serveru.",
        busyTitle: "Chvilku počkej",
        busyBody: "Předchozí požadavek ještě běží. Zkus to za pár sekund.",
        expiredTitle: "Tahle nabídka už neplatí",
        expiredBody: "Spusť /stats znovu.",
        ownOnlyTitle: "Tahle tlačítka patří někomu jinému",
        ownOnlyBody: "Použít je může jen ten, kdo spustil /stats.",
        forbiddenTitle: "Tohle teď nejde",
        forbiddenBody: "Spusť /stats znovu na serveru, kde jsi členem.",
        incompleteTitle: "Historii se nepodařilo načíst celou",
        incompleteBody: "Zkus to znovu nebo vyber kratší období.",
        notConfiguredTitle: "Logi tu ještě není nastavené",
        notConfiguredBody: "Správce serveru propojí Discord s Logi na webu.",
        linkChangedTitle: "Propojení se mezitím změnilo",
        linkChangedBody: "Spusť /stats znovu.",
        alreadyLinkedTitle: "Tenhle Steam už má jiný hráč",
        alreadyLinkedBody: "Požádej správce klanu, ať propojení zkontroluje.",
        invalidSteamTitle: "Tohle nevypadá jako Steam ID",
        invalidSteamBody:
            "Má 17 číslic a začíná 7656119, nebo je to odkaz steamcommunity.com/profiles/….",
        linkErrorTitle: "Uložení se nepodařilo ověřit",
        linkErrorBody:
            "Spusť /stats a podívej se, jestli je Steam propojený. Pomoct ti může správce.",
    },
    shareFlow: {
        promptTitle: "Kam kartu poslat?",
        selectChannel: "Vyber kanál",
        back: "Zpět",
        sharedTitle: "Sdíleno do {channel}",
        viewMessage: "Zobrazit zprávu",
        deniedTitle: "Do {channel} teď sdílet nejde",
        deniedBody:
            "Ty i bot potřebujete v kanálu právo psát zprávy a vkládat odkazy. Vyber jiný kanál.",
        chooseOther: "Vybrat jiný kanál",
        failedTitle: "Sdílení se nepodařilo ověřit",
        failedBody:
            "Než to zkusíš znovu, podívej se do kanálu, karta tam už může být.",
        alreadyTitle: "Tahle karta už je sdílená",
        alreadyBody: "Pro novou kartu spusť /stats znovu.",
    },
}

const de: StatsCopy = {
    periodChoices: {
        "7d": "7 Tage",
        "30d": "30 Tage",
        "90d": "90 Tage",
        all: "Gesamte Historie",
    },
    periodLabels: {
        "7d": "Letzte 7 Tage",
        "30d": "Letzte 30 Tage",
        "90d": "Letzte 90 Tage",
        all: "Gesamte Historie",
    },
    periodPhrases: {
        "7d": "den letzten 7 Tagen",
        "30d": "den letzten 30 Tagen",
        "90d": "den letzten 90 Tagen",
        all: "der gesamten Historie",
    },
    games: { hll: "Hell Let Loose", wardogs: "Wardogs" },
    kills: "Kills",
    deaths: "Tode",
    kd: "K/D",
    wins: "Siege",
    matches: "Spiele",
    winRate: "Siegquote {rate} %",
    playtime: "gespielt {hours} h",
    cash: "Cash-Änderung {cash}",
    coverage: "{metrics} kennen wir aus {known} von {total} Spielen.",
    coverageNames: {
        killsKd: "Kills und K/D",
        kills: "Kills",
        deaths: "Tode",
        cashDelta: "Die Cash-Änderung",
        seconds: "Die Spielzeit",
    },
    hllDetail: "Gespielt {hours} h · Infanterie-ELO {elo} · Teamkills {tk}",
    form: "Form: {rate} % Siege in den letzten 100 Spielen über 20 min",
    stale: "Ich zeige die zuletzt gelesenen Daten, die Quelle ließ sich gerade nicht aktualisieren.",
    recentTitle: "{name} · letzte Spiele",
    factionsTitle: "{name} · Fraktionen",
    weaponsTitle: "{name} · Waffen",
    mapsTitle: "{name} · Karten",
    results: {
        win: "Sieg",
        loss: "Niederlage",
        draw: "Unentschieden",
        unknown: "Kein Ergebnis",
    },
    recentRow: "{map} · {day} · {kills} Kills, {deaths} Tode",
    factionRow: "{wins} von {matches} Siegen · {kills} Kills",
    noItems: "Noch keine Details.",
    overview: "Übersicht",
    recent: "Letzte Spiele",
    factions: "Fraktionen",
    weapons: "Waffen",
    maps: "Karten",
    share: "Teilen",
    hllProfile: "Profil auf HLL Records",
    addSteam: "Steam hinzufügen",
    chooseSteam: "Steam wählen",
    sourceWarcon: "Quelle: Warcon des Clans",
    sourceGames: "{games} auf den Clan-Servern",
    dataAt: "Daten von {time}",
    gamesCount: { one: "{count} Spiel", other: "{count} Spiele" },
    sourceHll:
        "Quelle: HLL Records · nur erfasste Community-Server · + heißt mindestens",
    sharedBy: "Geteilt von {user} · Stand {time}",
    sharedWarcon: "Warcon des Clans",
    sharedHll: "HLL Records",
    missingTitle: "Dir fehlt ein Steam-Konto",
    missingBody:
        "Statistiken suchen wir über die Steam-ID. Füg sie hinzu und wir laden sie sofort.",
    declared:
        "Das ist deine Angabe für öffentliche Statistiken, keine Verifizierung. Ein verifiziertes Steam verknüpfst du in Logi → Mein Konto.",
    ambiguousTitle: "Du hast mehrere Steam-Konten verknüpft",
    ambiguousBody: "Wähle, welches für Statistiken gelten soll.",
    otherMissingTitle: "{name} hat kein Steam verknüpft",
    otherMissingBody: "Er kann es selbst über /stats hinzufügen.",
    otherAmbiguousTitle: "{name} hat mehrere Steam-Konten verknüpft",
    otherAmbiguousBody: "Er muss selbst eins über /stats wählen.",
    otherFallbackName: "Dieser Spieler",
    emptySelf: "In {period} hast du auf den Clan-Servern kein Spiel.",
    emptyOther: "In {period} gibt es auf den Clan-Servern kein Spiel.",
    emptyNext:
        "Versuch einen längeren Zeitraum: /stats spiel: {game} zeitraum: {next}.",
    emptyHll: "HLL Records hat in {period} kein Spiel.",
    modalTitle: "Steam verknüpfen",
    modalLabel: "Steam-ID oder Profil-Link",
    modalPlaceholder: "76561198… oder steamcommunity.com/profiles/…",
    retry: "Erneut eingeben",
    errors: {
        unavailableTitle: "Statistiken lassen sich gerade nicht laden",
        unavailableWarcon:
            "Warcon des Clans antwortet nicht. Dein Steam bleibt gespeichert, versuch es in ein paar Minuten.",
        unavailableHll:
            "HLL Records antwortet nicht. Dein Steam bleibt gespeichert, versuch es in ein paar Minuten.",
        blockedTitle: "HLL Records lässt den Bot gerade nicht rein",
        blockedBody: "Öffne das Profil selbst. Dein Steam bleibt gespeichert.",
        gameDisabledTitle: "{game}-Statistiken sind hier ausgeschaltet",
        gameDisabledBody:
            "Ein Verwalter kann sie in Logi → Einstellungen → Befehle einschalten.",
        invalidTitle: "Wähle nur einen Spieler",
        invalidBody:
            "Entweder ein Servermitglied oder einen Wardogs-Spieler aus den Vorschlägen.",
        hllOnlyTitle: "Das geht nur bei Wardogs",
        hllOnlyBody:
            "Spielersuche und Serverfilter gelten für Wardogs. Bei Hell Let Loose wähle ein Servermitglied.",
        busyTitle: "Einen Moment",
        busyBody:
            "Deine vorige Anfrage läuft noch. Versuch es in ein paar Sekunden.",
        expiredTitle: "Dieses Angebot gilt nicht mehr",
        expiredBody: "Starte /stats erneut.",
        ownOnlyTitle: "Diese Buttons gehören jemand anderem",
        ownOnlyBody: "Nur wer /stats gestartet hat, kann sie nutzen.",
        forbiddenTitle: "Das geht gerade nicht",
        forbiddenBody:
            "Starte /stats erneut auf einem Server, dessen Mitglied du bist.",
        incompleteTitle: "Die Historie ließ sich nicht ganz lesen",
        incompleteBody: "Versuch es erneut oder wähle einen kürzeren Zeitraum.",
        notConfiguredTitle: "Logi ist hier noch nicht eingerichtet",
        notConfiguredBody:
            "Ein Serververwalter verbindet Discord im Web mit Logi.",
        linkChangedTitle: "Die Verknüpfung hat sich inzwischen geändert",
        linkChangedBody: "Starte /stats erneut.",
        alreadyLinkedTitle: "Dieses Steam gehört schon einem anderen Spieler",
        alreadyLinkedBody:
            "Bitte die Clan-Verwalter, die Verknüpfung zu prüfen.",
        invalidSteamTitle: "Das sieht nicht nach einer Steam-ID aus",
        invalidSteamBody:
            "Sie hat 17 Ziffern und beginnt mit 7656119, oder es ist ein Link steamcommunity.com/profiles/….",
        linkErrorTitle: "Das Speichern ließ sich nicht bestätigen",
        linkErrorBody:
            "Starte /stats und prüfe, ob dein Steam verknüpft ist. Ein Verwalter kann helfen.",
    },
    shareFlow: {
        promptTitle: "Wohin soll die Karte?",
        selectChannel: "Kanal wählen",
        back: "Zurück",
        sharedTitle: "In {channel} geteilt",
        viewMessage: "Nachricht anzeigen",
        deniedTitle: "In {channel} kannst du gerade nicht teilen",
        deniedBody:
            "Du und der Bot braucht in dem Kanal das Recht, Nachrichten zu senden und Links einzubetten. Wähle einen anderen Kanal.",
        chooseOther: "Anderen Kanal wählen",
        failedTitle: "Das Teilen ließ sich nicht bestätigen",
        failedBody:
            "Schau in den Kanal, bevor du erneut teilst, die Karte kann schon dort sein.",
        alreadyTitle: "Diese Karte ist schon geteilt",
        alreadyBody: "Starte /stats erneut für eine neue Karte.",
    },
}

/** The `/stats` copy in the clan language (`cs`, `de`, else English). */
export function statsCopy(language: string | null | undefined): StatsCopy {
    const value = (language ?? "").toLowerCase()
    return value.startsWith("cs")
        ? cs
        : value.startsWith("de")
          ? de
          : value.startsWith("pl")
            ? pl
            : value.startsWith("fr") ? fr : en
}
