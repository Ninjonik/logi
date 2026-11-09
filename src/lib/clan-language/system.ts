import type { SettingsPreviewSamples } from "../../domain/discord-messages/settings-previews"
import type { TeamRequestDmCopy } from "../../domain/discord-messages/team-request-dm"
import type { ServiceStatusCopy } from "../../domain/discord-messages/service-status"
import type { MessageKitCopy } from "../../domain/discord-messages/message-layout"
import type { BotErrorsCopy } from "../../domain/discord-messages/bot-errors"

import { clanCopy, type ClanLanguage } from "./core"

/**
 * System copy that is not tied to one feature: the shared message kit (frame
 * footer, paging, error cards), managed-message delivery errors, the errors
 * channel, the Logi service status and the team request decisions (board
 * L5). Czech is the board's wording; bot copy says "ty" ("du").
 */
export type SystemMessages = {
    /** The team request decision DM (L5 1.3, L2-57..58). */
    teamRequests: TeamRequestDmCopy
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
    /** The errors channel for admins (L5 1.1). */
    errorsChannel: BotErrorsCopy
    /** "Stav služeb Logi" and its thread "Změny stavu" (L5 1.2). */
    serviceStatus: ServiceStatusCopy
    /**
     * Sample data of the "Náhled" previews on "Zprávy a panely" (N1-B07),
     * with the board's words for the cards whose builders are not shared yet.
     */
    previews: SettingsPreviewSamples
}

const csPreviews: SettingsPreviewSamples = {
    clan: "Vlci",
    clanCode: "VLK",
    opponentCode: "ROG",
    category: "Přátelák",
    map: "Foy · den",
    recapMap: "Carentan",
    players: ["Hráč 17", "Hráč 21", "Hráč 23", "Hráč 02", "Hráč 05", "Hráč 31"],
    leader: "Hráč 02",
    squads: ["Able", "Baker"],
    role: "Medic",
    meetingChannel: "Sraz",
    trainingTitle: "Trénink · komunikace a souhra",
    rewardRole: "Pěchota",
    memberRole: "Člen",
    clanRole: "Klan",
    announcement: {
        mention: "@Klan",
        groups: [
            ["Pěchota", 15, null],
            ["Tanky", 6, 6],
            ["Recon", 2, 2],
        ],
    },
    recruitmentPanel: {
        title: "Přidej se ke klanu {clan}",
        body: "Vyber, jak s námi chceš hrát. Přihláška zabere pár minut a když ještě nemáš propojený herní účet, provedeme tě tím.",
        categories: [
            ["Hlavní člen", "hell_let_loose", "zápasy každý týden"],
            ["Záloha", "hell_let_loose", "hraješ, když se uvolní místo"],
            ["Žoldák", "wardogs", "výpomoc na jednotlivé zápasy"],
        ],
    },
    application: {
        category: "Hlavní člen",
        answers: [
            ["Specializace", "Pěchota"],
            ["Kolik hodin týdně hraješ?", "10–15 hodin"],
            ["Proč chceš hrát s námi?", "Hledám klan na pravidelné zápasy."],
        ],
    },
    applicationClose: { reason: "Pohovor proběhl, vítej mezi námi." },
    ticketPanel: {
        title: "Potřebuješ pomoc?",
        body: "Vyber, s čím potřebuješ pomoct. Otevře se soukromé vlákno, které vidíš jen ty a správci.",
        categories: [
            ["Nahlásit hráče", "chování na serveru"],
            ["Žádost o roli", "tank, recon, velení"],
            ["Problém s botem", "něco nefunguje"],
            ["Jiné", "cokoli dalšího"],
        ],
    },
    ticket: {
        category: "Nahlásit hráče",
        title: "{author} nahlašuje hráče",
        answers: [
            ["Kdo? Jméno ve hře", "xX_Sniper_Xx"],
            ["Kde a kdy?", "Vlci #1, kolem 20:20"],
            ["Co se stalo?", "Opakovaně zabíjí spoluhráče na spawnu."],
        ],
    },
    ticketClose: { reason: "Hráč dostal ban na 7 dní. Díky za nahlášení." },
    playerReport: {
        player: "Hans_88",
        side: "Axis",
        reporter: "Ořech",
        reason: "Opakovaně zabíjí spoluhráče na spawnu.",
    },
    teamRequest: { game: "Hell Let Loose", team: "Vlci", code: "VLK" },
}

const plPreviews: SettingsPreviewSamples = {
    clan: "Wilki",
    clanCode: "VLK",
    opponentCode: "ROG",
    category: "Towarzyski",
    map: "Foy · dzień",
    recapMap: "Carentan",
    players: [
        "Gracz 17",
        "Gracz 21",
        "Gracz 23",
        "Gracz 02",
        "Gracz 05",
        "Gracz 31",
    ],
    leader: "Gracz 02",
    squads: ["Able", "Baker"],
    role: "Medyk",
    meetingChannel: "Zbiórka",
    trainingTitle: "Szkolenie · komunikacja i praca zespołowa",
    rewardRole: "Piechota",
    memberRole: "Członek",
    clanRole: "Klan",
    announcement: {
        mention: "@Klan",
        groups: [
            ["Piechota", 15, null],
            ["Czołgi", 6, 6],
            ["Zwiad", 2, 2],
        ],
    },
    recruitmentPanel: {
        title: "Dołącz do klanu {clan}",
        body: "Wybierz sposób, w jaki chcesz z nami grać. Zgłoszenie zajmuje kilka minut, a jeśli Twoje konto w grze nie jest jeszcze połączone, przeprowadzimy Cię przez to.",
        categories: [
            ["Główny członek", "hell_let_loose", "Mecze co tydzień"],
            ["Rezerwa", "hell_let_loose", "grasz, gdy otwiera się spot"],
            ["Najemnik", "wardogs", "pomaga w pojedynczych meczach"],
        ],
    },
    application: {
        category: "Główny członek",
        answers: [
            ["Specjalizacja", "Piechota"],
            ["Ile godzin tygodniowo grasz?", "10–15 godzin"],
            [
                "Dlaczego chcesz z nami zagrać?",
                "Szukam klanu z regularnymi meczami.",
            ],
        ],
    },
    applicationClose: {
        reason: "Rozmowa kwalifikacyjna przebiegła pomyślnie, witamy na pokładzie.",
    },
    ticketPanel: {
        title: "Potrzebujesz pomocy?",
        body: "Wybierz, w czym potrzebujesz pomocy. Otworzy się prywatny wątek, który będziesz widzieć tylko Ty i administratorzy.",
        categories: [
            ["Zgłoś gracza", "Zachowanie na serwerze"],
            ["Żądanie roli", "Czołg , rozpoznanie, dowództwo"],
            ["Problem z botem", "coś nie działa"],
            ["Inne", "cokolwiek innego"],
        ],
    },
    ticket: {
        category: "Zgłoś gracza",
        title: "{author} zgłasza gracza",
        answers: [
            ["Kto? Nazwa w grze", "xX_Sniper_Xx"],
            ["Gdzie i kiedy?", "Wilki #1, około 20:20"],
            [
                "Co się stało?",
                "Zabija członków drużyny podczas odradzania się.",
            ],
        ],
    },
    ticketClose: {
        reason: "Gracz dostał 7-dniową blokadę. Dziękujemy za zgłoszenie.",
    },
    playerReport: {
        player: "Hans_88",
        side: "Oś",
        reporter: "Nut",
        reason: "Zabija członków drużyny podczas odradzania się.",
    },
    teamRequest: { game: "Hell Let Loose", team: "Wilki", code: "VLK" },
}

const frPreviews: SettingsPreviewSamples = {
    clan: "Les Loups",
    clanCode: "VLK",
    opponentCode: "ROG",
    category: "Amical",
    map: "Foy · jour",
    recapMap: "Carentan",
    players: [
        "Joueur 17",
        "Joueur 21",
        "Joueur 23",
        "Joueur 02",
        "Joueur 05",
        "Joueur 31",
    ],
    leader: "Joueur 02",
    squads: ["Able", "Baker"],
    role: "Médecin",
    meetingChannel: "Rassemblement",
    trainingTitle: "Entraînement · communication et jeu d’équipe",
    rewardRole: "Infanterie",
    memberRole: "Membre",
    clanRole: "Clan",
    announcement: {
        mention: "@Clan",
        groups: [
            ["Infanterie", 15, null],
            ["Blindés", 6, 6],
            ["Reconnaissance", 2, 2],
        ],
    },
    recruitmentPanel: {
        title: "Rejoindre le clan {clan}",
        body: "Choisis comment tu souhaites jouer avec nous. La candidature prend quelques minutes ; si ton compte de jeu n’est pas encore associé, nous te guiderons.",
        categories: [
            ["Membre titulaire", "hell_let_loose", "des matchs chaque semaine"],
            ["Remplaçant", "hell_let_loose", "tu joues lorsqu’une place se libère"],
            ["Mercenaire", "wardogs", "renfort sur des matchs ponctuels"],
        ],
    },
    application: {
        category: "Membre titulaire",
        answers: [
            ["Spécialité", "Infanterie"],
            ["Combien d’heures joues-tu par semaine ?", "10 à 15 heures"],
            [
                "Pourquoi souhaites-tu jouer avec nous ?",
                "Je cherche un clan qui organise régulièrement des matchs.",
            ],
        ],
    },
    applicationClose: { reason: "L’entretien s’est bien passé, bienvenue parmi nous." },
    ticketPanel: {
        title: "Besoin d’aide ?",
        body: "Choisis le sujet de ta demande. Un fil privé s’ouvrira, visible uniquement par toi et les administrateurs.",
        categories: [
            ["Signaler un joueur", "comportement sur le serveur"],
            ["Demande de rôle", "blindés, reconnaissance, commandement"],
            ["Problème avec le bot", "quelque chose ne fonctionne pas"],
            ["Autre", "tout autre sujet"],
        ],
    },
    ticket: {
        category: "Signaler un joueur",
        title: "{author} signale un joueur",
        answers: [
            ["Qui ? Pseudo en jeu", "xX_Sniper_Xx"],
            ["Où et quand ?", "Les Loups nº 1, vers 20 h 20"],
            ["Que s’est-il passé ?", "Tue ses coéquipiers en boucle au spawn."],
        ],
    },
    ticketClose: {
        reason: "Le joueur a été banni pendant 7 jours. Merci pour le signalement.",
    },
    playerReport: {
        player: "Hans_88",
        side: "Axe",
        reporter: "Nut",
        reason: "Tue ses coéquipiers en boucle au spawn.",
    },
    teamRequest: { game: "Hell Let Loose", team: "Les Loups", code: "VLK" },
}

const enPreviews: SettingsPreviewSamples = {
    clan: "Wolves",
    clanCode: "VLK",
    opponentCode: "ROG",
    category: "Friendly",
    map: "Foy · day",
    recapMap: "Carentan",
    players: [
        "Player 17",
        "Player 21",
        "Player 23",
        "Player 02",
        "Player 05",
        "Player 31",
    ],
    leader: "Player 02",
    squads: ["Able", "Baker"],
    role: "Medic",
    meetingChannel: "Meeting",
    trainingTitle: "Training · communication and teamwork",
    rewardRole: "Infantry",
    memberRole: "Member",
    clanRole: "Clan",
    announcement: {
        mention: "@Clan",
        groups: [
            ["Infantry", 15, null],
            ["Tanks", 6, 6],
            ["Recon", 2, 2],
        ],
    },
    recruitmentPanel: {
        title: "Join the {clan} clan",
        body: "Pick how you want to play with us. The application takes a few minutes, and if your game account is not linked yet, we will walk you through it.",
        categories: [
            ["Main member", "hell_let_loose", "matches every week"],
            ["Reserve", "hell_let_loose", "you play when a spot opens"],
            ["Mercenary", "wardogs", "help out in single matches"],
        ],
    },
    application: {
        category: "Main member",
        answers: [
            ["Specialization", "Infantry"],
            ["How many hours a week do you play?", "10–15 hours"],
            [
                "Why do you want to play with us?",
                "Looking for a clan with regular matches.",
            ],
        ],
    },
    applicationClose: { reason: "The interview went well, welcome aboard." },
    ticketPanel: {
        title: "Need help?",
        body: "Pick what you need help with. A private thread opens that only you and the admins can see.",
        categories: [
            ["Report a player", "behaviour on the server"],
            ["Role request", "tank, recon, command"],
            ["Bot problem", "something doesn't work"],
            ["Other", "anything else"],
        ],
    },
    ticket: {
        category: "Report a player",
        title: "{author} reports a player",
        answers: [
            ["Who? In-game name", "xX_Sniper_Xx"],
            ["Where and when?", "Wolves #1, around 20:20"],
            ["What happened?", "Keeps killing teammates at spawn."],
        ],
    },
    ticketClose: {
        reason: "The player got a 7-day ban. Thanks for reporting.",
    },
    playerReport: {
        player: "Hans_88",
        side: "Axis",
        reporter: "Nut",
        reason: "Keeps killing teammates at spawn.",
    },
    teamRequest: { game: "Hell Let Loose", team: "Wolves", code: "VLK" },
}

const dePreviews: SettingsPreviewSamples = {
    clan: "Wölfe",
    clanCode: "VLK",
    opponentCode: "ROG",
    category: "Freundschaftsspiel",
    map: "Foy · Tag",
    recapMap: "Carentan",
    players: [
        "Spieler 17",
        "Spieler 21",
        "Spieler 23",
        "Spieler 02",
        "Spieler 05",
        "Spieler 31",
    ],
    leader: "Spieler 02",
    squads: ["Able", "Baker"],
    role: "Medic",
    meetingChannel: "Treffpunkt",
    trainingTitle: "Training · Kommunikation und Zusammenspiel",
    rewardRole: "Infanterie",
    memberRole: "Mitglied",
    clanRole: "Clan",
    announcement: {
        mention: "@Clan",
        groups: [
            ["Infanterie", 15, null],
            ["Panzer", 6, 6],
            ["Recon", 2, 2],
        ],
    },
    recruitmentPanel: {
        title: "Tritt dem Clan {clan} bei",
        body: "Wähl, wie du mit uns spielen willst. Die Bewerbung dauert ein paar Minuten, und wenn dein Spielkonto noch nicht verknüpft ist, führen wir dich durch.",
        categories: [
            ["Hauptmitglied", "hell_let_loose", "jede Woche Matches"],
            [
                "Reserve",
                "hell_let_loose",
                "du spielst, wenn ein Platz frei wird",
            ],
            ["Söldner", "wardogs", "Aushilfe bei einzelnen Matches"],
        ],
    },
    application: {
        category: "Hauptmitglied",
        answers: [
            ["Spezialisierung", "Infanterie"],
            ["Wie viele Stunden spielst du pro Woche?", "10–15 Stunden"],
            [
                "Warum willst du mit uns spielen?",
                "Ich suche einen Clan mit regelmäßigen Matches.",
            ],
        ],
    },
    applicationClose: { reason: "Das Gespräch lief gut, willkommen bei uns." },
    ticketPanel: {
        title: "Brauchst du Hilfe?",
        body: "Wähl, wobei du Hilfe brauchst. Es öffnet sich ein privater Thread, den nur du und die Admins sehen.",
        categories: [
            ["Spieler melden", "Verhalten auf dem Server"],
            ["Rollenanfrage", "Panzer, Recon, Führung"],
            ["Problem mit dem Bot", "etwas funktioniert nicht"],
            ["Sonstiges", "alles andere"],
        ],
    },
    ticket: {
        category: "Spieler melden",
        title: "{author} meldet einen Spieler",
        answers: [
            ["Wer? Name im Spiel", "xX_Sniper_Xx"],
            ["Wo und wann?", "Wölfe #1, gegen 20:20"],
            ["Was ist passiert?", "Tötet am Spawn wiederholt Mitspieler."],
        ],
    },
    ticketClose: {
        reason: "Der Spieler hat 7 Tage Bann bekommen. Danke für die Meldung.",
    },
    playerReport: {
        player: "Hans_88",
        side: "Axis",
        reporter: "Nuss",
        reason: "Tötet am Spawn wiederholt Mitspieler.",
    },
    teamRequest: { game: "Hell Let Loose", team: "Wölfe", code: "VLK" },
}

const systemMessages: Record<ClanLanguage, SystemMessages> = {
    pl: {
        teamRequests: {
            label: "Katalog drużyn Logi · {game}",
            approvedTitle: "Drużyna znajduje się w katalogu",
            mergedTitle: "Drużyna już była w katalogu",
            rejectedTitle: "Wniosek dotyczący drużyny został odrzucony",
            approvedChip: "Zatwierdzono",
            mergedChip: "Połączone",
            rejectedChip: "Odrzucono",
            newTeam: "nowa drużyna",
            changedTeam: "zmieniono dane",
            requested: ", prosiłeś o „{name}”",
            approvedCreateBody: "Możesz teraz wybrać drużynę na mecze.",
            approvedUpdateBody: "Zobaczysz teraz zmiany w swoich meczach.",
            mergedBody:
                "Twój wniosek połączono z istniejącą drużyną. Możesz wybrać ją do swoich meczów.",
            kindCreate: "Wniosek o nową drużynę",
            kindUpdate: "Wniosek o zmianę",
            requestLine: "{kind} · drużyna {name}",
            rejectedNext: "Wyślij poprawioną prośbę w Logi → Drużyny.",
            openTeam: "Otwórz drużynę w Logi",
            openTeams: "Otwórz drużyny w Logi",
        },
        kit: {
            updated: "Zaktualizowano {time}",
            refreshEvery: "odświeża co {seconds} s",
            managed: "Zarządzane w Logi",
            dmClan: "Klan {clan}",
            dmSettings: "Ustawienia wiadomości",
            page: "Strona {page} z {pages}",
            paused: "Wstrzymano",
            lastData: "ostatnie dane {time}",
        },
        paging: { previous: "Wstecz", next: "Dalej" },
        errors: {
            unknownTitle: "To nie zadziałało",
            unknownBody:
                "Spróbuj ponownie za chwilę. Jeśli nadal się nie powiedzie, wyślij wiadomość do administratorów klanu.",
            adminNotified: "Administratorzy zostali powiadomieni.",
        },
        publication: {
            deliveryFailed:
                "Nie można dostarczyć wiadomości do Discord. Sprawdź, czy bot może przeglądać kanał, wysyłać wiadomości i czytać na nim historię wiadomości. Logi ponawia próbę samodzielnie.",
            deliveryUncertain:
                "Nie jest jasne, czy wiadomość dotarła do Discord, więc Logi nie wysyła jej ponownie, aby uniknąć duplikowania. Sprawdź kanał i skontaktuj się z obsługą Logi.",
        },
        errorsChannel: {
            label: "Błąd bota",
            labelWithArea: "Błąd bota · {area}",
            areas: {
                match: "Mecz",
                forum: "Forum wydarzeń",
                eventRoles: "Role zdarzeń",
                scheduledEvent: "Wydarzenie Discord",
                memberRoles: "Role członków",
                panels: "Panele",
                reminders: "Przypomnienia o obecności",
                tickets: "Pomoc",
                applications: "Zgłoszenia",
                playerReports: "Raporty graczy",
                seed: "Seeding",
            },
            titles: {
                announcement: "Ogłoszenie o meczu nie zostało wysłane",
                roster: "skład nie został opublikowany",
                forumCreate: "Nie można utworzyć forum meczów",
                forumUpdate: "Nie można zaktualizować forum meczowego",
                forumAccess: "Nie można przyznać graczom dostępu do forum",
                eventRoles: "Nie można ustawić ról graczy meczowych",
                scheduledEventCreate: "Nie można utworzyć zdarzenia Discord",
                scheduledEventUpdate:
                    "Nie można zaktualizować zdarzenia Discord",
                scheduledEventCancel: "Nie można anulować zdarzenia Discord",
                adminAccess: "Nie można odczytać dostępu administratora",
                ticketPanel: "Panel zgłoszeń nie został zaktualizowany",
                applicationPanel: "Panel rekrutacji nie został zaktualizowany",
                calendarPanel: "Kalendarz nie został zaktualizowany",
                publicPanel: "Panel nie został zaktualizowany",
                attendanceReminders:
                    "Przypomnienia o obecności nie zostały wysłane",
                ticketOpen: "Nie udało się otworzyć zgłoszenia",
                ticketSupport: "Nie można dodać wsparcia do zgłoszenia",
                ticketIntro: "Wprowadzenie do zgłoszenia nie zostało wysłane",
                ticketRename: "Nie można zmienić nazwy zgłoszenia",
                ticketCloseCard:
                    "Podsumowanie zamkniętego zgłoszenia nie zostało opublikowane w wątku",
                ticketCloseThread:
                    "Nie można zmienić nazwy, zablokować ani zarchiwizować wątku zamkniętego zgłoszenia",
                applicationOpen:
                    "Nie udało się otworzyć zgłoszenia rekrutacyjnego",
                applicationRecruiters:
                    "Nie można dodać rekruterów do zgłoszenia",
                applicationIntro:
                    "Wprowadzenie do zgłoszenia nie zostało wysłane",
                applicationRename: "Nie można zmienić nazwy zgłoszenia",
                playerReport: "Raport gracza nie został otwarty",
                panelPassword: "Hasło serwera zostało usunięte z panelu",
                seedControl: "Elementy sterujące serwera nie zostały wysłane",
                general: "Bot nie mógł zakończyć działania",
            },
            memberRolesTitle: {
                one: "Nie można zmienić ról członka {count}",
                other: "Nie można zmienić ról członków {count}",
            },
            reasonHeading: "Dlaczego",
            fixHeading: "Co robić",
            retry: {
                afterFix: "Ponowna próba po naprawieniu",
                byItself: "Próbuje samodzielnie",
                playerTold: "Graczowi polecono spróbować później",
                notRetried: "Nie zostanie ponowiona próba",
            },
            reasons: {
                missingPermission:
                    "Botowi brakuje uprawnienia {permissions} w kanale {channel}.",
                missingPermissionServer:
                    "Rola Logi nie ma uprawnienia {permissions} na serwerze.",
                missingPermissionUnknown:
                    "Botowi brakuje potrzebnych uprawnień.",
                privateThreads:
                    "Bot nie może tworzyć prywatnych wątków w kanale {channel}.",
                missingAccess: "Bot nie widzi kanału {channel}.",
                unknownChannel: "Kanał {channel} już nie istnieje na serwerze.",
                unknownRole: "Rola {role} już nie istnieje.",
                roleAbove:
                    "Rola {role} znajduje się nad rolą Logi na liście ról, więc bot nie może jej dodać ani usunąć.",
                fullCategory:
                    "Kategoria {category} ma już 50 kanałów; Discord nie pozwala na więcej w jednej kategorii.",
                fullServer:
                    "Serwer ma już 500 kanałów; Discord nie pozwala na więcej.",
                wrongChannelType: "Kanał {channel} nie jest kanałem tekstowym.",
                panelPasswordPublic:
                    "Kanał {channel} jest widoczny dla wszystkich (@everyone). Hasło jest pokazywane tylko na kanale niewidocznym dla @everyone.",
                seedControlPublic:
                    "Każdy (@everyone) może widzieć kanał {channel}, a sterowanie serwerem jest przeznaczone wyłącznie dla administratorów.",
                timeout: "Discord nie odpowiedział na czas.",
                other: "Discord odmówił podjęcia działania.",
            },
            fixes: {
                missingPermissionSync:
                    "W Discord otwórz {channel} → Edytuj kanał → Uprawnienia → Logi i zezwól na {permissions}.",
                missingPermissionInteraction:
                    "Zezwól na rolę Logi {permissions} w {channel}.",
                missingPermissionServer:
                    "W Discord → Ustawienia serwera → Role → Logi zezwól na {permissions}.",
                missingPermissionGeneric:
                    "Zezwól na rolę Logi {permissions} w ustawieniach kanału.",
                missingPermissionUnknown:
                    "Sprawdź uprawnienia roli Logi w kanale i ustawieniach serwera.",
                missingAccess:
                    "Dodaj rolę Logi do kanału lub wybierz inny kanał w Logi.",
                unknownChannel: "Wybierz nowy kanał w Logi → Kanały i język.",
                unknownRole: "Wybierz inną rolę w Logi → Role i dostęp.",
                roleAbove:
                    "W Discord → Ustawienia serwera → Role przeciągnij rolę Logi nad {role}.",
                fullCategoryForum:
                    "Usuń kanały starych wydarzeń lub wybierz inną kategorię dla forów w Logi → Kanały i język.",
                fullCategory: "Usuń stare kanały lub wybierz inną kategorię.",
                fullServer: "Usuń stare kanały z serwera.",
                wrongChannelType:
                    "Wybierz kanał tekstowy w Logi → Kanały i język.",
                panelPasswordPublic:
                    "W Discord otwórz {channel} → Edytuj kanał → Uprawnienia → @everyone i odmów oglądania kanału.",
                seedControlPublic:
                    "Ustaw kanał {channel} jako prywatny lub wybierz inny kanał sterowania w Logi → Seeding serwera.",
                timeoutSync:
                    "Nic. Bot spróbuje ponownie przy następnej synchronizacji. Jeśli problem będzie się powtarzał przez ponad godzinę, skontaktuj się z pomocą techniczną Logi.",
                timeoutInteraction:
                    "Nic, gracz może spróbować ponownie. Jeśli problem będzie się powtarzał przez ponad godzinę, skontaktuj się z pomocą techniczną Logi.",
                other: "Spróbuj ponownie. Jeśli problem będzie się powtarzał, skontaktuj się z obsługą Logi i wyślij godzinę wystąpienia błędu.",
                timeoutBackground:
                    "Jeśli problem będzie się powtarzał przez ponad godzinę, skontaktuj się z pomocą techniczną Logi.",
                otherBackground:
                    "Jeśli problem będzie się powtarzał, skontaktuj się z pomocą techniczną Logi i wyślij godzinę wystąpienia błędu.",
            },
            followUps: {
                announcement:
                    "Powiadomienie gaśnie samoistnie przy następnej synchronizacji, w ciągu 5 minut.",
                roster: "skład jest publikowany samodzielnie przy następnej synchronizacji w ciągu 5 minut.",
                forum: "Forum zostanie zakończone samoczynnie przy następnej synchronizacji, w ciągu 5 minut.",
                eventRoles:
                    "Role zostaną ustawione podczas następnej synchronizacji.",
                scheduledEvent:
                    "Zdarzenie jest aktualizowane samoczynnie przy następnej synchronizacji.",
                memberRoles:
                    "Role zostaną wypełnione przy następnej synchronizacji.",
                panel: "Panel odświeża się sam przy następnej synchronizacji.",
                reminders:
                    "Następne przypomnienie zostanie wysłane zgodnie z planem.",
                ticket: "Następnie powiedz graczowi, aby ponownie otworzył zgłoszenie.",
                ticketClose:
                    "Zgłoszenie jest zamknięty w Logi; ręcznie wykończyć gwint w Discord.",
                application:
                    "Następnie poproś wnioskodawcę o ponowne przesłanie wniosku.",
                playerReport:
                    "Następnie powiedz graczowi, aby zgłosił się ponownie.",
                ticketSupport:
                    "Następnie ręcznie dodaj obsługę do zgłoszenia; bot nie będzie próbował więcej.",
                ticketIntro:
                    "Zgłoszenie jest otwarty bez intro; odpowiedz graczowi bezpośrednio w wątku.",
                ticketRename:
                    "Zgłoszenie nadal działa pod starą nazwą; możesz zmienić jego nazwę ręcznie.",
                applicationRecruiters:
                    "Następnie ręcznie dodaj rekruterów do zgłoszenia; bot nie będzie próbował więcej.",
                applicationIntro:
                    "Zgłoszenie jest otwarta bez wprowadzenia; odpowiedz wnioskodawcy bezpośrednio w wątku.",
                applicationRename:
                    "Zgłoszenie nadal działa pod starą nazwą; możesz zmienić jego nazwę ręcznie.",
                panelPassword:
                    "Hasło samo wraca do panelu przy następnym odświeżeniu, w ciągu minuty.",
                seedControl: "Kontrole są następnie wysyłane samodzielnie.",
            },
            context: {
                channel: "Kanał {channel}",
                category: "Kategoria {category}",
                role: "Rola {role}",
                meetingChannel: "Kanał spotkań {channel}",
                tried: "wypróbowane przez {user}",
                author: "Autor {user}",
                applicant: "Wnioskodawca {user}",
                ticketNumber: "Zgłoszenie #{number}",
                applicationNumber: "Zgłoszenie #{number}",
                panel: "Panel {panel}",
                moreMembers: "i {count} więcej",
                players: { one: "{count} gracz", other: "{count} graczy" },
            },
            unnamed: {
                channel: "ustawione w Logi",
                category: "ustawione w Logi",
                role: "ustawione w Logi",
            },
            and: "i",
            links: {
                match: "Otwórz mecz",
                channels: "Kanały w Logi",
                tickets: "Zgłoszenia w Logi",
                roles: "Role i dostęp w Logi",
                membership: "Członkostwo w Logi",
                panels: "Panele w Logi",
                seed: "Seeding serwera w Logi",
            },
            permissions: {
                ViewChannel: "Wyświetl kanał",
                SendMessages: "Wyślij wiadomości",
                SendMessagesInThreads: "Wysyłaj wiadomości w wątkach",
                EmbedLinks: "Osadzanie łączy",
                AttachFiles: "Dołącz pliki",
                ReadMessageHistory: "Przeczytaj historię wiadomości",
                ManageChannels: "Zarządzaj kanałami",
                ManageRoles: "Zarządzaj rolami",
                ManageThreads: "Zarządzaj wątkami",
                ManageMessages: "Zarządzaj wiadomościami",
                CreatePublicThreads: "Utwórz wątki publiczne",
                CreatePrivateThreads: "Utwórz wątki prywatne",
                ManageEvents: "Zarządzaj zdarzeniami",
                Connect: "Połącz",
            },
        },
        serviceStatus: {
            label: "Usługi Logi",
            allRunning: "Wszystko działa",
            oneDown: "{service} nie działa",
            manyDown: "{services} nie działa",
            unknownTitle: "Nie znamy teraz statusu",
            unknownChip: "Monitoring nie odpowiada",
            unknownBody:
                "Usługi mogą działać normalnie. Status pojawia się, gdy tylko monitorowanie ponownie odpowie.",
            checked: "Sprawdzane co {seconds} · ostatnio dzisiaj o {time}",
            up: "Działa",
            down: "Niedostępne",
            threadNote: "Zmiany statusu znajdują się w wątku",
            threadName: "Zmiany stanu",
            changeDownTitle: "{service} nie działa",
            changeDownBody: "Przerwa rozpoczęła się o godzinie {time}.",
            changeUpTitle: "{service} działa ponownie",
            changeUpBody: "Przestój trwał {duration}.",
            changeUpBodyUnknown: "Nie wiemy, jak długo trwała przerwa.",
            duration: {
                lessThanMinute: "mniej niż minuta",
                minutes: {
                    one: "{count} minuta",
                    few: "{count} minuty",
                    many: "{count} minut",
                    other: "{count} minuty",
                },
                hours: {
                    one: "{count} godzina",
                    few: "{count} godziny",
                    many: "{count} godzin",
                    other: "{count} godziny",
                },
                days: {
                    one: "{count} dzień",
                    few: "{count} dni",
                    many: "{count} dni",
                    other: "{count} dnia",
                },
                pair: "{first} i {second}",
            },
            and: "i",
        },
        previews: plPreviews,
    },
    fr: {
        teamRequests: {
            label: "Catalogue des équipes Logi · {game}",
            approvedTitle: "L’équipe figure dans le catalogue",
            mergedTitle: "L’équipe figurait déjà dans le catalogue",
            rejectedTitle: "La demande concernant l’équipe n’a pas été acceptée",
            approvedChip: "Approuvée",
            mergedChip: "Fusionnée",
            rejectedChip: "Refusée",
            newTeam: "nouvelle équipe",
            changedTeam: "équipe modifiée",
            requested: "tu avais demandé « {name} »",
            approvedCreateBody: "Tu peux maintenant sélectionner cette équipe pour les matchs.",
            approvedUpdateBody: "Les modifications sont désormais visibles dans tes matchs.",
            mergedBody:
                "Ta demande a été rattachée à l’équipe existante. Sélectionne cette équipe pour tes matchs.",
            kindCreate: "Demande de nouvelle équipe",
            kindUpdate: "Demande de modification",
            requestLine: "{kind} · équipe {name}",
            rejectedNext: "Envoie une demande corrigée dans Logi → Équipes.",
            openTeam: "Ouvrir l’équipe dans Logi",
            openTeams: "Ouvrir les équipes dans Logi",
        },
        kit: {
            updated: "Mis à jour {time}",
            refreshEvery: "actualisation toutes les {seconds} s",
            managed: "Géré dans Logi",
            dmClan: "Clan {clan}",
            dmSettings: "Paramètres des messages",
            page: "Page {page} sur {pages}",
            paused: "En pause",
            lastData: "dernières données {time}",
        },
        paging: { previous: "Précédent", next: "Suivant" },
        errors: {
            unknownTitle: "L’action a échoué",
            unknownBody:
                "Réessaie dans un instant. Si le problème persiste, contacte les administrateurs du clan.",
            adminNotified: "Les administrateurs ont été informés.",
        },
        publication: {
            deliveryFailed:
                "Le message n’a pas pu être envoyé sur Discord. Vérifie que le bot peut voir le salon, y envoyer des messages et lire l’historique. Logi réessaiera automatiquement.",
            deliveryUncertain:
                "Impossible de savoir si le message a atteint Discord. Pour éviter un doublon, Logi ne le renvoie pas. Vérifie le salon et contacte le support Logi.",
        },
        errorsChannel: {
            label: "Erreur du bot",
            labelWithArea: "Erreur du bot · {area}",
            areas: {
                match: "Match",
                forum: "Forum de l’événement",
                eventRoles: "Rôles d’événement",
                scheduledEvent: "Événement Discord",
                memberRoles: "Rôles des membres",
                panels: "Panneaux",
                reminders: "Rappels de présence",
                tickets: "Tickets",
                applications: "Candidatures",
                playerReports: "Signalements de joueurs",
                seed: "Seeding",
            },
            titles: {
                announcement: "L’annonce du match n’a pas été envoyée",
                roster: "La composition n’a pas été publiée",
                forumCreate: "Impossible de créer le forum du match",
                forumUpdate: "Impossible de mettre à jour le forum du match",
                forumAccess: "Impossible de donner aux joueurs accès au forum",
                eventRoles: "Impossible d’attribuer les rôles des joueurs du match",
                scheduledEventCreate: "Impossible de créer l’événement Discord",
                scheduledEventUpdate: "Impossible de mettre à jour l’événement Discord",
                scheduledEventCancel:
                    "Impossible d’annuler l’événement Discord",
                adminAccess: "Impossible de vérifier les accès administrateur",
                ticketPanel: "Le panneau des tickets n’a pas été mis à jour",
                applicationPanel: "Le panneau des candidatures n’a pas été mis à jour",
                calendarPanel: "Le calendrier n’a pas été mis à jour",
                publicPanel: "Le panneau n’a pas été mis à jour",
                attendanceReminders: "Les rappels de présence n’ont pas été envoyés",
                ticketOpen: "Le ticket n’a pas été ouvert",
                ticketSupport: "Impossible d’ajouter le support au ticket",
                ticketIntro: "Le message d’accueil du ticket n’a pas été envoyé",
                ticketRename: "Impossible de renommer le ticket",
                ticketCloseCard:
                    "Le résumé du ticket fermé n’a pas été publié dans son fil",
                ticketCloseThread:
                    "Impossible de renommer, verrouiller ou archiver le fil du ticket fermé",
                applicationOpen: "La candidature n’a pas été ouverte",
                applicationRecruiters:
                    "Impossible d’ajouter les recruteurs à la candidature",
                applicationIntro: "Le message d’accueil de la candidature n’a pas été envoyé",
                applicationRename: "Impossible de renommer la candidature",
                playerReport: "Le signalement de joueur n’a pas été ouvert",
                panelPassword: "Le mot de passe du serveur a été retiré du panneau",
                seedControl: "Les commandes du serveur n’ont pas été publiées",
                general: "Le bot n’a pas pu terminer une action",
            },
            memberRolesTitle: {
                one: "Impossible de modifier les rôles de {count} membre",
                other: "Impossible de modifier les rôles de {count} membres",
            },
            reasonHeading: "Cause",
            fixHeading: "Marche à suivre",
            retry: {
                afterFix: "Nouvelle tentative après correction",
                byItself: "Nouvelle tentative automatique",
                playerTold: "Le joueur a été invité à réessayer plus tard",
                notRetried: "Aucune nouvelle tentative",
            },
            reasons: {
                missingPermission:
                    "Le bot n’a pas la permission {permissions} dans le salon {channel}.",
                missingPermissionServer:
                    "Le rôle Logi n’a pas la permission {permissions} sur le serveur.",
                missingPermissionUnknown:
                    "Il manque une permission nécessaire au bot.",
                privateThreads:
                    "Le bot ne peut pas créer de fils privés dans le salon {channel}.",
                missingAccess: "Le bot ne peut pas voir le salon {channel}.",
                unknownChannel:
                    "Le salon {channel} n’existe plus sur le serveur.",
                unknownRole: "Le rôle {role} n’existe plus.",
                roleAbove:
                    "Le rôle {role} est placé au-dessus du rôle Logi ; le bot ne peut donc ni l’attribuer ni le retirer.",
                fullCategory:
                    "La catégorie {category} contient déjà 50 salons, la limite autorisée par Discord pour une catégorie.",
                fullServer:
                    "Le serveur contient déjà 500 salons, la limite autorisée par Discord.",
                wrongChannelType:
                    "Le salon {channel} n’est pas un salon textuel.",
                panelPasswordPublic:
                    "Tout le monde (@everyone) peut désormais voir le salon {channel}. Le mot de passe n’est affiché que dans un salon invisible pour @everyone.",
                seedControlPublic:
                    "Tout le monde (@everyone) peut voir le salon {channel}, alors que les commandes du serveur sont réservées aux administrateurs.",
                timeout: "Discord n’a pas répondu à temps.",
                other: "Discord a refusé l’action.",
            },
            fixes: {
                missingPermissionSync:
                    "Dans Discord, ouvre {channel} → Modifier le salon → Permissions → Logi et autorise {permissions}.",
                missingPermissionInteraction:
                    "Autorise {permissions} pour le rôle Logi dans {channel}.",
                missingPermissionServer:
                    "Dans Discord → Paramètres du serveur → Rôles → Logi, autorise {permissions}.",
                missingPermissionGeneric:
                    "Autorise {permissions} pour le rôle Logi dans les paramètres du salon.",
                missingPermissionUnknown:
                    "Vérifie les permissions du rôle Logi dans le salon et dans les paramètres du serveur.",
                missingAccess:
                    "Ajoute le rôle Logi au salon ou sélectionne un autre salon dans Logi.",
                unknownChannel:
                    "Choisis un nouveau salon dans Logi → Salons et langue.",
                unknownRole: "Choisis un autre rôle dans Logi → Rôles et accès.",
                roleAbove:
                    "Dans Discord → Paramètres du serveur → Rôles, déplace le rôle Logi au-dessus de {role}.",
                fullCategoryForum:
                    "Supprime les salons d’anciens événements ou choisis une autre catégorie pour les forums dans Logi → Salons et langue.",
                fullCategory: "Supprime d’anciens salons ou choisis une autre catégorie.",
                fullServer: "Supprime d’anciens salons sur le serveur.",
                wrongChannelType:
                    "Choisis un salon textuel dans Logi → Salons et langue.",
                panelPasswordPublic:
                    "Dans Discord, ouvre {channel} → Modifier le salon → Permissions → @everyone et refuse Voir le salon.",
                seedControlPublic:
                    "Rends {channel} privé ou choisis un autre salon de gestion dans Logi → Seeding des serveurs.",
                timeoutSync:
                    "Rien à faire. Le bot réessaiera à la prochaine synchronisation. Si le problème dure plus d’une heure, contacte le support Logi.",
                timeoutInteraction:
                    "Rien à faire, le joueur peut réessayer. Si le problème dure plus d’une heure, contacte le support Logi.",
                other: "Réessaie. Si le problème persiste, contacte le support Logi en indiquant l’heure de l’erreur.",
                timeoutBackground:
                    "Si le problème dure plus d’une heure, contacte le support Logi.",
                otherBackground:
                    "Si le problème persiste, contacte le support Logi en indiquant l’heure de l’erreur.",
            },
            followUps: {
                announcement:
                    "L’annonce sera envoyée automatiquement à la prochaine synchronisation, sous 5 minutes.",
                roster: "La composition sera publiée automatiquement à la prochaine synchronisation, sous 5 minutes.",
                forum: "Le forum sera complété automatiquement à la prochaine synchronisation, sous 5 minutes.",
                eventRoles: "Les rôles seront attribués à la prochaine synchronisation.",
                scheduledEvent:
                    "L’événement sera mis à jour automatiquement à la prochaine synchronisation.",
                memberRoles: "Les rôles seront complétés à la prochaine synchronisation.",
                panel: "Le panneau sera actualisé automatiquement à la prochaine synchronisation.",
                reminders: "Le prochain rappel sera envoyé comme prévu.",
                ticket: "Demande ensuite au joueur d’ouvrir à nouveau le ticket.",
                ticketClose:
                    "Le ticket est fermé dans Logi ; termine manuellement son fil dans Discord.",
                application:
                    "Demande ensuite au candidat de renvoyer sa candidature.",
                playerReport: "Demande ensuite au joueur de refaire son signalement.",
                ticketSupport:
                    "Ajoute ensuite le support au ticket manuellement ; le bot ne réessaiera pas.",
                ticketIntro:
                    "Le ticket est ouvert sans message d’accueil ; réponds directement au joueur dans le fil.",
                ticketRename:
                    "Le ticket fonctionne toujours sous son ancien nom ; tu peux le renommer manuellement.",
                applicationRecruiters:
                    "Ajoute ensuite les recruteurs à la candidature manuellement ; le bot ne réessaiera pas.",
                applicationIntro:
                    "La candidature est ouverte sans message d’accueil ; réponds directement au candidat dans le fil.",
                applicationRename:
                    "La candidature fonctionne toujours sous son ancien nom ; tu peux la renommer manuellement.",
                panelPassword:
                    "Le mot de passe réapparaîtra automatiquement dans le panneau à la prochaine actualisation, sous une minute.",
                seedControl: "Les commandes seront ensuite publiées automatiquement.",
            },
            context: {
                channel: "Salon {channel}",
                category: "Catégorie {category}",
                role: "Rôle {role}",
                meetingChannel: "salon de rassemblement {channel}",
                tried: "tentative de {user}",
                author: "auteur {user}",
                applicant: "candidat {user}",
                ticketNumber: "ticket nº {number}",
                applicationNumber: "candidature nº {number}",
                panel: "Panneau {panel}",
                moreMembers: "et {count} autres",
                players: { one: "{count} joueur", other: "{count} joueurs" },
            },
            unnamed: {
                channel: "défini dans Logi",
                category: "défini dans Logi",
                role: "défini dans Logi",
            },
            and: "et",
            links: {
                match: "Ouvrir le match",
                channels: "Salons dans Logi",
                tickets: "Tickets dans Logi",
                roles: "Rôles et accès dans Logi",
                membership: "Recrutement dans Logi",
                panels: "Panneaux dans Logi",
                seed: "Seeding des serveurs dans Logi",
            },
            permissions: {
                ViewChannel: "Voir le salon",
                SendMessages: "Envoyer des messages",
                SendMessagesInThreads: "Envoyer des messages dans les fils",
                EmbedLinks: "Intégrer des liens",
                AttachFiles: "Joindre des fichiers",
                ReadMessageHistory: "Voir les anciens messages",
                ManageChannels: "Gérer les salons",
                ManageRoles: "Gérer les rôles",
                ManageThreads: "Gérer les fils",
                ManageMessages: "Gérer les messages",
                CreatePublicThreads: "Créer des fils publics",
                CreatePrivateThreads: "Créer des fils privés",
                ManageEvents: "Gérer les événements",
                Connect: "Se connecter",
            },
        },
        serviceStatus: {
            label: "Services Logi",
            allRunning: "Tous les services sont opérationnels",
            oneDown: "{service} est indisponible",
            manyDown: "{services} sont indisponibles",
            unknownTitle: "État actuellement inconnu",
            unknownChip: "La supervision ne répond pas",
            unknownBody:
                "Les services peuvent fonctionner normalement. Leur état s’affichera dès que la supervision répondra à nouveau.",
            checked: "Vérification toutes les {seconds} s · dernière aujourd’hui à {time}",
            up: "Opérationnel",
            down: "Indisponible",
            threadNote: "Les changements d’état sont dans le fil",
            threadName: "Changements d’état",
            changeDownTitle: "{service} est indisponible",
            changeDownBody: "La panne a commencé à {time}.",
            changeUpTitle: "{service} est à nouveau opérationnel",
            changeUpBody: "La panne a duré {duration}.",
            changeUpBodyUnknown: "La durée de la panne est inconnue.",
            duration: {
                lessThanMinute: "moins d’une minute",
                minutes: { one: "{count} minute", other: "{count} minutes" },
                hours: { one: "{count} heure", other: "{count} heures" },
                days: { one: "{count} jour", other: "{count} jours" },
                pair: "{first} et {second}",
            },
            and: "et",
        },
        previews: frPreviews,
    },
    en: {
        teamRequests: {
            label: "Logi team catalogue · {game}",
            approvedTitle: "The team is in the catalogue",
            mergedTitle: "The team was already in the catalogue",
            rejectedTitle: "The team request was not accepted",
            approvedChip: "Approved",
            mergedChip: "Merged",
            rejectedChip: "Rejected",
            newTeam: "new team",
            changedTeam: "team changed",
            requested: "you asked for “{name}”",
            approvedCreateBody: "You can now pick the team for matches.",
            approvedUpdateBody: "You will see the changes at your matches now.",
            mergedBody:
                "Your request joined the existing team. Pick this team for your matches.",
            kindCreate: "New team request",
            kindUpdate: "Change request",
            requestLine: "{kind} · team {name}",
            rejectedNext: "Send a corrected request in Logi → Teams.",
            openTeam: "Open the team in Logi",
            openTeams: "Open Teams in Logi",
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
        errorsChannel: {
            label: "Bot error",
            labelWithArea: "Bot error · {area}",
            areas: {
                match: "Match",
                forum: "Event forum",
                eventRoles: "Event roles",
                scheduledEvent: "Discord event",
                memberRoles: "Member roles",
                panels: "Panels",
                reminders: "Attendance reminders",
                tickets: "Tickets",
                applications: "Applications",
                playerReports: "Player reports",
                seed: "Seeding",
            },
            titles: {
                announcement: "The match announcement was not sent",
                roster: "The roster was not published",
                forumCreate: "The match forum could not be created",
                forumUpdate: "The match forum could not be updated",
                forumAccess: "Players could not be given access to the forum",
                eventRoles: "The roles for the match players could not be set",
                scheduledEventCreate: "The Discord event could not be created",
                scheduledEventUpdate: "The Discord event could not be updated",
                scheduledEventCancel:
                    "The Discord event could not be cancelled",
                adminAccess: "Admin access could not be read",
                ticketPanel: "The ticket panel was not updated",
                applicationPanel: "The application panel was not updated",
                calendarPanel: "The calendar was not updated",
                publicPanel: "The panel was not updated",
                attendanceReminders: "The attendance reminders were not sent",
                ticketOpen: "The ticket did not open",
                ticketSupport: "Support could not be added to the ticket",
                ticketIntro: "The ticket intro was not sent",
                ticketRename: "The ticket could not be renamed",
                ticketCloseCard:
                    "The closed ticket's summary was not posted in its thread",
                ticketCloseThread:
                    "The closed ticket's thread could not be renamed, locked or archived",
                applicationOpen: "The application did not open",
                applicationRecruiters:
                    "Recruiters could not be added to the application",
                applicationIntro: "The application intro was not sent",
                applicationRename: "The application could not be renamed",
                playerReport: "The player report did not open",
                panelPassword: "The server password was removed from the panel",
                seedControl: "The server controls were not posted",
                general: "The bot could not finish an action",
            },
            memberRolesTitle: {
                one: "The roles of {count} member could not be changed",
                other: "The roles of {count} members could not be changed",
            },
            reasonHeading: "Why",
            fixHeading: "What to do",
            retry: {
                afterFix: "Retries after the fix",
                byItself: "Retries by itself",
                playerTold: "The player was told to try later",
                notRetried: "Won't be retried",
            },
            reasons: {
                missingPermission:
                    "The bot is missing the {permissions} permission in the channel {channel}.",
                missingPermissionServer:
                    "The Logi role is missing the {permissions} permission on the server.",
                missingPermissionUnknown:
                    "The bot is missing a permission it needs.",
                privateThreads:
                    "The bot cannot create private threads in the channel {channel}.",
                missingAccess: "The bot cannot see the channel {channel}.",
                unknownChannel:
                    "The channel {channel} no longer exists on the server.",
                unknownRole: "The role {role} no longer exists.",
                roleAbove:
                    "The role {role} is above the Logi role in the role list, so the bot cannot add or remove it.",
                fullCategory:
                    "The category {category} already has 50 channels; Discord allows no more in one category.",
                fullServer:
                    "The server already has 500 channels; Discord allows no more.",
                wrongChannelType:
                    "The channel {channel} is not a text channel.",
                panelPasswordPublic:
                    "Everyone (@everyone) can now see the channel {channel}. The password only shows in a channel @everyone cannot see.",
                seedControlPublic:
                    "Everyone (@everyone) can see the channel {channel}, and the server controls are for admins only.",
                timeout: "Discord did not answer in time.",
                other: "Discord refused the action.",
            },
            fixes: {
                missingPermissionSync:
                    "In Discord, open {channel} → Edit Channel → Permissions → Logi and allow {permissions}.",
                missingPermissionInteraction:
                    "Allow the Logi role {permissions} in {channel}.",
                missingPermissionServer:
                    "In Discord → Server Settings → Roles → Logi, allow {permissions}.",
                missingPermissionGeneric:
                    "Allow the Logi role {permissions} in the channel settings.",
                missingPermissionUnknown:
                    "Check the Logi role's permissions in the channel and in the server settings.",
                missingAccess:
                    "Add the Logi role to the channel, or pick another channel in Logi.",
                unknownChannel:
                    "Pick a new channel in Logi → Channels and language.",
                unknownRole: "Pick another role in Logi → Roles and access.",
                roleAbove:
                    "In Discord → Server Settings → Roles, drag the Logi role above {role}.",
                fullCategoryForum:
                    "Delete the channels of old events, or pick another category for forums in Logi → Channels and language.",
                fullCategory: "Delete old channels, or pick another category.",
                fullServer: "Delete old channels on the server.",
                wrongChannelType:
                    "Pick a text channel in Logi → Channels and language.",
                panelPasswordPublic:
                    "In Discord, open {channel} → Edit Channel → Permissions → @everyone and deny View Channel.",
                seedControlPublic:
                    "Make {channel} private, or pick another control channel in Logi → Server seeding.",
                timeoutSync:
                    "Nothing. The bot tries again at the next sync. If this keeps coming for more than an hour, contact Logi support.",
                timeoutInteraction:
                    "Nothing, the player can try again. If it keeps happening for more than an hour, contact Logi support.",
                other: "Try again. If it keeps happening, contact Logi support and send the time of the error.",
                timeoutBackground:
                    "If it keeps happening for more than an hour, contact Logi support.",
                otherBackground:
                    "If it keeps happening, contact Logi support and send the time of the error.",
            },
            followUps: {
                announcement:
                    "The announcement goes out by itself at the next sync, within 5 minutes.",
                roster: "The roster is published by itself at the next sync, within 5 minutes.",
                forum: "The forum is completed by itself at the next sync, within 5 minutes.",
                eventRoles: "The roles are set at the next sync.",
                scheduledEvent:
                    "The event is updated by itself at the next sync.",
                memberRoles: "The roles are filled in at the next sync.",
                panel: "The panel refreshes by itself at the next sync.",
                reminders: "The next reminder goes out as planned.",
                ticket: "Then tell the player to open the ticket again.",
                ticketClose:
                    "The ticket is closed in Logi; finish its thread in Discord by hand.",
                application:
                    "Then tell the applicant to send the application again.",
                playerReport: "Then tell the player to report again.",
                ticketSupport:
                    "Then add support to the ticket by hand; the bot won't try again.",
                ticketIntro:
                    "The ticket is open without its intro; answer the player right in the thread.",
                ticketRename:
                    "The ticket keeps working under its old name; you can rename it by hand.",
                applicationRecruiters:
                    "Then add the recruiters to the application by hand; the bot won't try again.",
                applicationIntro:
                    "The application is open without its intro; answer the applicant right in the thread.",
                applicationRename:
                    "The application keeps working under its old name; you can rename it by hand.",
                panelPassword:
                    "The password comes back to the panel by itself at the next refresh, within a minute.",
                seedControl: "The controls are then posted by themselves.",
            },
            context: {
                channel: "Channel {channel}",
                category: "Category {category}",
                role: "Role {role}",
                meetingChannel: "meeting channel {channel}",
                tried: "tried by {user}",
                author: "author {user}",
                applicant: "applicant {user}",
                ticketNumber: "ticket #{number}",
                applicationNumber: "application #{number}",
                panel: "Panel {panel}",
                moreMembers: "and {count} more",
                players: { one: "{count} player", other: "{count} players" },
            },
            unnamed: {
                channel: "set in Logi",
                category: "set in Logi",
                role: "set in Logi",
            },
            and: "and",
            links: {
                match: "Open match",
                channels: "Channels in Logi",
                tickets: "Tickets in Logi",
                roles: "Roles and access in Logi",
                membership: "Membership in Logi",
                panels: "Panels in Logi",
                seed: "Server seeding in Logi",
            },
            permissions: {
                ViewChannel: "View Channel",
                SendMessages: "Send Messages",
                SendMessagesInThreads: "Send Messages in Threads",
                EmbedLinks: "Embed Links",
                AttachFiles: "Attach Files",
                ReadMessageHistory: "Read Message History",
                ManageChannels: "Manage Channels",
                ManageRoles: "Manage Roles",
                ManageThreads: "Manage Threads",
                ManageMessages: "Manage Messages",
                CreatePublicThreads: "Create Public Threads",
                CreatePrivateThreads: "Create Private Threads",
                ManageEvents: "Manage Events",
                Connect: "Connect",
            },
        },
        serviceStatus: {
            label: "Logi services",
            allRunning: "Everything is running",
            oneDown: "{service} is down",
            manyDown: "{services} are down",
            unknownTitle: "We don't know the status right now",
            unknownChip: "Monitoring is not answering",
            unknownBody:
                "The services may be running normally. The status shows up as soon as monitoring answers again.",
            checked: "Checked every {seconds} s · last today at {time}",
            up: "Running",
            down: "Unavailable",
            threadNote: "Status changes are in the thread",
            threadName: "Status changes",
            changeDownTitle: "{service} is down",
            changeDownBody: "The outage started at {time}.",
            changeUpTitle: "{service} is running again",
            changeUpBody: "The outage lasted {duration}.",
            changeUpBodyUnknown: "We don't know how long the outage lasted.",
            duration: {
                lessThanMinute: "less than a minute",
                minutes: { one: "{count} minute", other: "{count} minutes" },
                hours: { one: "{count} hour", other: "{count} hours" },
                days: { one: "{count} day", other: "{count} days" },
                pair: "{first} and {second}",
            },
            and: "and",
        },
        previews: enPreviews,
    },
    cs: {
        teamRequests: {
            label: "Katalog týmů Logi · {game}",
            approvedTitle: "Tým je v katalogu",
            mergedTitle: "Tým už v katalogu byl",
            rejectedTitle: "Žádost o tým nebyla přijata",
            approvedChip: "Schváleno",
            mergedChip: "Sloučeno",
            rejectedChip: "Zamítnuto",
            newTeam: "nový tým",
            changedTeam: "změna týmu",
            requested: "žádal(a) jsi „{name}“",
            approvedCreateBody: "Tým teď můžeš vybrat u zápasů.",
            approvedUpdateBody: "Změny týmu teď uvidíš u zápasů.",
            mergedBody:
                "Tvoje žádost se připojila k existujícímu týmu. U zápasů vyber tento tým.",
            kindCreate: "Žádost o nový tým",
            kindUpdate: "Žádost o změnu",
            requestLine: "{kind} · tým {name}",
            rejectedNext: "Opravenou žádost pošleš v Logi → Týmy.",
            openTeam: "Otevřít tým v Logi",
            openTeams: "Otevřít Týmy v Logi",
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
        errorsChannel: {
            label: "Chyba bota",
            labelWithArea: "Chyba bota · {area}",
            areas: {
                match: "Zápas",
                forum: "Fórum akce",
                eventRoles: "Role akce",
                scheduledEvent: "Událost na Discordu",
                memberRoles: "Role členů",
                panels: "Panely",
                reminders: "Připomínky docházky",
                tickets: "Tickety",
                applications: "Přihlášky",
                playerReports: "Nahlášení hráče",
                seed: "Seed",
            },
            titles: {
                announcement: "Ohlášení zápasu se neodeslalo",
                roster: "Soupiska se nezveřejnila",
                forumCreate: "Fórum zápasu se nepodařilo založit",
                forumUpdate: "Fórum zápasu se nepodařilo upravit",
                forumAccess: "Hráčům se nepodařilo dát přístup do fóra",
                eventRoles: "Role pro účastníky zápasu se nepodařilo nastavit",
                scheduledEventCreate:
                    "Událost na Discordu se nepodařilo vytvořit",
                scheduledEventUpdate:
                    "Událost na Discordu se nepodařilo upravit",
                scheduledEventCancel:
                    "Událost na Discordu se nepodařilo zrušit",
                adminAccess: "Přístup správců se nepodařilo načíst",
                ticketPanel: "Panel ticketů se neaktualizoval",
                applicationPanel: "Panel přihlášek se neaktualizoval",
                calendarPanel: "Kalendář se neaktualizoval",
                publicPanel: "Panel se neaktualizoval",
                attendanceReminders: "Připomínky docházky se neodeslaly",
                ticketOpen: "Ticket se neotevřel",
                ticketSupport: "Do ticketu se nepodařilo přidat podporu",
                ticketIntro: "Úvod ticketu se neodeslal",
                ticketRename: "Ticket se nepodařilo přejmenovat",
                ticketCloseCard:
                    "Shrnutí uzavřeného ticketu se do vlákna neodeslalo",
                ticketCloseThread:
                    "Vlákno uzavřeného ticketu se nepodařilo přejmenovat, zamknout ani archivovat",
                applicationOpen: "Přihláška se neotevřela",
                applicationRecruiters:
                    "Do přihlášky se nepodařilo přidat nábor",
                applicationIntro: "Úvod přihlášky se neodeslal",
                applicationRename: "Přihlášku se nepodařilo přejmenovat",
                playerReport: "Nahlášení hráče se neotevřelo",
                panelPassword: "Heslo serveru bylo z panelu odstraněno",
                seedControl: "Ovládání serverů se neodeslalo",
                general: "Bot nemohl dokončit akci",
            },
            memberRolesTitle: {
                one: "Role se {count} členovi nepodařilo upravit",
                few: "Role se {count} členům nepodařilo upravit",
                many: "Role se {count} členům nepodařilo upravit",
                other: "Role se {count} členům nepodařilo upravit",
            },
            reasonHeading: "Proč",
            fixHeading: "Co udělat",
            retry: {
                afterFix: "Zkusí se znovu po opravě",
                byItself: "Zkusí se znovu sám",
                playerTold: "Hráč dostal zprávu, ať to zkusí později",
                notRetried: "Bot to znovu nezkusí",
            },
            reasons: {
                missingPermission:
                    "Bot nemá v kanálu {channel} oprávnění {permissions}.",
                missingPermissionServer:
                    "Role Logi nemá na serveru oprávnění {permissions}.",
                missingPermissionUnknown: "Bot nemá potřebné oprávnění.",
                privateThreads:
                    "Bot nemůže v kanálu {channel} zakládat soukromá vlákna.",
                missingAccess: "Bot do kanálu {channel} nevidí.",
                unknownChannel: "Kanál {channel} už na serveru není.",
                unknownRole: "Role {role} už neexistuje.",
                roleAbove:
                    "Role {role} je v seznamu rolí výš než role Logi, takže ji bot nemůže přidávat ani brát.",
                fullCategory:
                    "Kategorie {category} už má 50 kanálů, víc Discord do jedné kategorie nedovolí.",
                fullServer: "Na serveru je 500 kanálů, víc Discord nedovolí.",
                wrongChannelType: "Kanál {channel} není textový kanál.",
                panelPasswordPublic:
                    "Kanál {channel} teď vidí všichni (@everyone). Heslo se ukazuje jen v kanálu, který @everyone nevidí.",
                seedControlPublic:
                    "Kanál {channel} vidí všichni (@everyone), a ovládání serverů patří jen správcům.",
                timeout: "Discord neodpověděl včas.",
                other: "Discord akci odmítl.",
            },
            fixes: {
                missingPermissionSync:
                    "V Discordu otevři {channel} → Upravit kanál → Oprávnění → Logi a povol {permissions}.",
                missingPermissionInteraction:
                    "Povol roli Logi v {channel} oprávnění {permissions}.",
                missingPermissionServer:
                    "V Discordu → Nastavení serveru → Role → Logi povol {permissions}.",
                missingPermissionGeneric:
                    "Povol roli Logi oprávnění {permissions} v nastavení kanálu.",
                missingPermissionUnknown:
                    "Zkontroluj oprávnění role Logi v kanálu i v nastavení serveru.",
                missingAccess:
                    "Přidej roli Logi do kanálu, nebo vyber jiný kanál v Logi.",
                unknownChannel: "Vyber nový kanál v Logi → Kanály a jazyk.",
                unknownRole: "Vyber jinou roli v Logi → Role a přístup.",
                roleAbove:
                    "V Discordu → Nastavení serveru → Role přetáhni roli Logi nad {role}.",
                fullCategoryForum:
                    "Smaž kanály starých akcí, nebo vyber jinou kategorii pro fóra v Logi → Kanály a jazyk.",
                fullCategory: "Smaž staré kanály, nebo vyber jinou kategorii.",
                fullServer: "Smaž staré kanály na serveru.",
                wrongChannelType:
                    "Vyber textový kanál v Logi → Kanály a jazyk.",
                panelPasswordPublic:
                    "V Discordu otevři {channel} → Upravit kanál → Oprávnění → @everyone a zakaž Zobrazit kanál.",
                seedControlPublic:
                    "Nastav {channel} jako soukromý, nebo v Logi → Seed serverů vyber jiný kanál pro ovládání.",
                timeoutSync:
                    "Nic. Bot to zkusí znovu při další synchronizaci. Když se zpráva opakuje déle než hodinu, napiš podpoře Logi.",
                timeoutInteraction:
                    "Nic, hráč to může zkusit znovu. Když se to opakuje přes hodinu, napiš podpoře Logi.",
                other: "Zkus to znovu. Když se to opakuje, napiš podpoře Logi a pošli čas chyby.",
                timeoutBackground:
                    "Když se to opakuje přes hodinu, napiš podpoře Logi.",
                otherBackground:
                    "Když se to opakuje, napiš podpoře Logi a pošli čas chyby.",
            },
            followUps: {
                announcement:
                    "Ohlášení se pošle samo při další synchronizaci, do 5 minut.",
                roster: "Soupiska se zveřejní sama při další synchronizaci, do 5 minut.",
                forum: "Fórum se doplní samo při další synchronizaci, do 5 minut.",
                eventRoles: "Role se nastaví při další synchronizaci.",
                scheduledEvent:
                    "Událost se upraví sama při další synchronizaci.",
                memberRoles: "Role se doplní při další synchronizaci.",
                panel: "Panel se obnoví sám při další synchronizaci.",
                reminders: "Další připomínka se pošle podle plánu.",
                ticket: "Pak hráči napiš, ať ticket otevře znovu.",
                ticketClose:
                    "Ticket je v Logi uzavřený, vlákno pak v Discordu dokonči ručně.",
                application: "Pak uchazeči napiš, ať přihlášku podá znovu.",
                playerReport: "Pak hráči napiš, ať hráče nahlásí znovu.",
                ticketSupport:
                    "Podporu pak do ticketu přidej ručně, bot to znovu nezkusí.",
                ticketIntro:
                    "Ticket je otevřený bez úvodní zprávy, hráči odpověz přímo ve vlákně.",
                ticketRename:
                    "Ticket funguje dál pod původním názvem, přejmenovat ho můžeš ručně.",
                applicationRecruiters:
                    "Nábor pak do přihlášky přidej ručně, bot to znovu nezkusí.",
                applicationIntro:
                    "Přihláška je otevřená bez úvodní zprávy, uchazeči odpověz přímo ve vlákně.",
                applicationRename:
                    "Přihláška funguje dál pod původním názvem, přejmenovat ji můžeš ručně.",
                panelPassword:
                    "Heslo se do panelu vrátí samo při dalším obnovení, do minuty.",
                seedControl: "Ovládání se pak pošle samo.",
            },
            context: {
                channel: "Kanál {channel}",
                category: "Kategorie {category}",
                role: "Role {role}",
                meetingChannel: "kanál srazu {channel}",
                tried: "zkoušel {user}",
                author: "autor {user}",
                applicant: "uchazeč {user}",
                ticketNumber: "ticket #{number}",
                applicationNumber: "přihláška #{number}",
                panel: "Panel {panel}",
                moreMembers: "a další {count}",
                players: {
                    one: "{count} hráč",
                    few: "{count} hráči",
                    many: "{count} hráče",
                    other: "{count} hráčů",
                },
            },
            unnamed: {
                channel: "z nastavení Logi",
                category: "z nastavení Logi",
                role: "z nastavení Logi",
            },
            and: "a",
            links: {
                match: "Otevřít zápas",
                channels: "Kanály v Logi",
                tickets: "Tickety v Logi",
                roles: "Role a přístup v Logi",
                membership: "Členství v Logi",
                panels: "Panely v Logi",
                seed: "Seed serverů v Logi",
            },
            permissions: {
                ViewChannel: "Zobrazit kanál",
                SendMessages: "Posílat zprávy",
                SendMessagesInThreads: "Posílat zprávy ve vláknech",
                EmbedLinks: "Vkládat odkazy",
                AttachFiles: "Přikládat soubory",
                ReadMessageHistory: "Číst historii zpráv",
                ManageChannels: "Spravovat kanály",
                ManageRoles: "Spravovat role",
                ManageThreads: "Spravovat vlákna",
                ManageMessages: "Spravovat zprávy",
                CreatePublicThreads: "Vytvářet veřejná vlákna",
                CreatePrivateThreads: "Vytvářet soukromá vlákna",
                ManageEvents: "Spravovat události",
                Connect: "Připojit se",
            },
        },
        serviceStatus: {
            label: "Služby Logi",
            allRunning: "Všechno běží",
            oneDown: "{service} nefunguje",
            manyDown: "{services} nefungují",
            unknownTitle: "Stav teď neznáme",
            unknownChip: "Monitoring neodpovídá",
            unknownBody:
                "Služby můžou běžet normálně. Stav se ukáže, jakmile monitoring zase odpoví.",
            checked: "Kontrola každých {seconds} s · naposledy dnes v {time}",
            up: "V provozu",
            down: "Nedostupné",
            threadNote: "Změny stavu jsou ve vlákně",
            threadName: "Změny stavu",
            changeDownTitle: "{service} nefunguje",
            changeDownBody: "Výpadek začal v {time}.",
            changeUpTitle: "{service} zase běží",
            changeUpBody: "Výpadek trval {duration}.",
            changeUpBodyUnknown: "Jak dlouho výpadek trval, nevíme.",
            duration: {
                lessThanMinute: "méně než minutu",
                minutes: {
                    one: "{count} minutu",
                    few: "{count} minuty",
                    many: "{count} minuty",
                    other: "{count} minut",
                },
                hours: {
                    one: "{count} hodinu",
                    few: "{count} hodiny",
                    many: "{count} hodiny",
                    other: "{count} hodin",
                },
                days: {
                    one: "{count} den",
                    few: "{count} dny",
                    many: "{count} dne",
                    other: "{count} dní",
                },
                pair: "{first} a {second}",
            },
            and: "a",
        },
        previews: csPreviews,
    },
    de: {
        teamRequests: {
            label: "Logi-Teamkatalog · {game}",
            approvedTitle: "Das Team ist im Katalog",
            mergedTitle: "Das Team war schon im Katalog",
            rejectedTitle: "Die Teamanfrage wurde nicht angenommen",
            approvedChip: "Genehmigt",
            mergedChip: "Zusammengeführt",
            rejectedChip: "Abgelehnt",
            newTeam: "neues Team",
            changedTeam: "Team geändert",
            requested: "du hast „{name}“ angefragt",
            approvedCreateBody: "Du kannst das Team jetzt bei Matches wählen.",
            approvedUpdateBody:
                "Die Änderungen siehst du jetzt bei deinen Matches.",
            mergedBody:
                "Deine Anfrage wurde dem bestehenden Team zugeordnet. Wähl dieses Team bei deinen Matches.",
            kindCreate: "Anfrage für ein neues Team",
            kindUpdate: "Änderungsanfrage",
            requestLine: "{kind} · Team {name}",
            rejectedNext:
                "Eine korrigierte Anfrage schickst du in Logi → Teams.",
            openTeam: "Team in Logi öffnen",
            openTeams: "Teams in Logi öffnen",
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
        errorsChannel: {
            label: "Bot-Fehler",
            labelWithArea: "Bot-Fehler · {area}",
            areas: {
                match: "Match",
                forum: "Event-Forum",
                eventRoles: "Event-Rollen",
                scheduledEvent: "Discord-Event",
                memberRoles: "Mitgliederrollen",
                panels: "Panels",
                reminders: "Anwesenheitserinnerungen",
                tickets: "Tickets",
                applications: "Bewerbungen",
                playerReports: "Spielermeldungen",
                seed: "Seeding",
            },
            titles: {
                announcement: "Die Match-Ankündigung wurde nicht gesendet",
                roster: "Der Kader wurde nicht veröffentlicht",
                forumCreate: "Das Match-Forum konnte nicht angelegt werden",
                forumUpdate: "Das Match-Forum konnte nicht bearbeitet werden",
                forumAccess:
                    "Die Spieler konnten keinen Zugang zum Forum bekommen",
                eventRoles:
                    "Die Rollen für die Match-Teilnehmer konnten nicht gesetzt werden",
                scheduledEventCreate:
                    "Das Discord-Event konnte nicht erstellt werden",
                scheduledEventUpdate:
                    "Das Discord-Event konnte nicht bearbeitet werden",
                scheduledEventCancel:
                    "Das Discord-Event konnte nicht abgesagt werden",
                adminAccess: "Der Admin-Zugang konnte nicht gelesen werden",
                ticketPanel: "Das Ticket-Panel wurde nicht aktualisiert",
                applicationPanel:
                    "Das Bewerbungs-Panel wurde nicht aktualisiert",
                calendarPanel: "Der Kalender wurde nicht aktualisiert",
                publicPanel: "Das Panel wurde nicht aktualisiert",
                attendanceReminders:
                    "Die Anwesenheitserinnerungen wurden nicht gesendet",
                ticketOpen: "Das Ticket hat sich nicht geöffnet",
                ticketSupport:
                    "Der Support konnte nicht zum Ticket hinzugefügt werden",
                ticketIntro: "Die Ticket-Einleitung wurde nicht gesendet",
                ticketRename: "Das Ticket konnte nicht umbenannt werden",
                ticketCloseCard:
                    "Die Zusammenfassung des geschlossenen Tickets wurde nicht im Thread gepostet",
                ticketCloseThread:
                    "Der Thread des geschlossenen Tickets konnte nicht umbenannt, gesperrt oder archiviert werden",
                applicationOpen: "Die Bewerbung hat sich nicht geöffnet",
                applicationRecruiters:
                    "Das Recruiting konnte nicht zur Bewerbung hinzugefügt werden",
                applicationIntro:
                    "Die Bewerbungs-Einleitung wurde nicht gesendet",
                applicationRename:
                    "Die Bewerbung konnte nicht umbenannt werden",
                playerReport: "Die Spielermeldung hat sich nicht geöffnet",
                panelPassword:
                    "Das Serverpasswort wurde aus dem Panel entfernt",
                seedControl: "Die Serversteuerung wurde nicht gesendet",
                general: "Der Bot konnte eine Aktion nicht abschließen",
            },
            memberRolesTitle: {
                one: "Die Rollen von {count} Mitglied konnten nicht geändert werden",
                other: "Die Rollen von {count} Mitgliedern konnten nicht geändert werden",
            },
            reasonHeading: "Warum",
            fixHeading: "Was tun",
            retry: {
                afterFix: "Neuer Versuch nach der Korrektur",
                byItself: "Versucht es selbst erneut",
                playerTold: "Der Spieler soll es später erneut versuchen",
                notRetried: "Wird nicht wiederholt",
            },
            reasons: {
                missingPermission:
                    "Dem Bot fehlt im Kanal {channel} die Berechtigung {permissions}.",
                missingPermissionServer:
                    "Der Logi-Rolle fehlt auf dem Server die Berechtigung {permissions}.",
                missingPermissionUnknown:
                    "Dem Bot fehlt eine nötige Berechtigung.",
                privateThreads:
                    "Der Bot kann im Kanal {channel} keine privaten Threads erstellen.",
                missingAccess: "Der Bot sieht den Kanal {channel} nicht.",
                unknownChannel:
                    "Den Kanal {channel} gibt es auf dem Server nicht mehr.",
                unknownRole: "Die Rolle {role} gibt es nicht mehr.",
                roleAbove:
                    "Die Rolle {role} steht in der Rollenliste über der Logi-Rolle, deshalb kann der Bot sie weder vergeben noch entfernen.",
                fullCategory:
                    "Die Kategorie {category} hat schon 50 Kanäle, mehr erlaubt Discord in einer Kategorie nicht.",
                fullServer:
                    "Der Server hat schon 500 Kanäle, mehr erlaubt Discord nicht.",
                wrongChannelType: "Der Kanal {channel} ist kein Textkanal.",
                panelPasswordPublic:
                    "Alle (@everyone) können den Kanal {channel} jetzt sehen. Das Passwort erscheint nur in einem Kanal, den @everyone nicht sieht.",
                seedControlPublic:
                    "Alle (@everyone) können den Kanal {channel} sehen, und die Serversteuerung ist nur für Admins.",
                timeout: "Discord hat nicht rechtzeitig geantwortet.",
                other: "Discord hat die Aktion abgelehnt.",
            },
            fixes: {
                missingPermissionSync:
                    "Öffne in Discord {channel} → Kanal bearbeiten → Berechtigungen → Logi und erlaube {permissions}.",
                missingPermissionInteraction:
                    "Erlaube der Logi-Rolle in {channel} die Berechtigung {permissions}.",
                missingPermissionServer:
                    "Erlaube in Discord → Servereinstellungen → Rollen → Logi die Berechtigung {permissions}.",
                missingPermissionGeneric:
                    "Erlaube der Logi-Rolle in den Kanaleinstellungen die Berechtigung {permissions}.",
                missingPermissionUnknown:
                    "Prüf die Berechtigungen der Logi-Rolle im Kanal und in den Servereinstellungen.",
                missingAccess:
                    "Füg die Logi-Rolle zum Kanal hinzu oder wähl in Logi einen anderen Kanal.",
                unknownChannel:
                    "Wähl in Logi → Kanäle und Sprache einen neuen Kanal.",
                unknownRole:
                    "Wähl in Logi → Rollen und Zugriff eine andere Rolle.",
                roleAbove:
                    "Zieh in Discord → Servereinstellungen → Rollen die Logi-Rolle über {role}.",
                fullCategoryForum:
                    "Lösch die Kanäle alter Events oder wähl in Logi → Kanäle und Sprache eine andere Kategorie für Foren.",
                fullCategory:
                    "Lösch alte Kanäle oder wähl eine andere Kategorie.",
                fullServer: "Lösch alte Kanäle auf dem Server.",
                wrongChannelType:
                    "Wähl in Logi → Kanäle und Sprache einen Textkanal.",
                panelPasswordPublic:
                    "Öffne in Discord {channel} → Kanal bearbeiten → Berechtigungen → @everyone und verbiete Kanal ansehen.",
                seedControlPublic:
                    "Mach {channel} privat oder wähl in Logi → Server-Seeding einen anderen Steuerkanal.",
                timeoutSync:
                    "Nichts. Der Bot versucht es bei der nächsten Synchronisierung erneut. Wenn die Meldung länger als eine Stunde wiederkommt, schreib dem Logi-Support.",
                timeoutInteraction:
                    "Nichts, der Spieler kann es erneut versuchen. Wenn es länger als eine Stunde passiert, schreib dem Logi-Support.",
                other: "Versuch es erneut. Wenn es wieder passiert, schreib dem Logi-Support und schick die Uhrzeit des Fehlers.",
                timeoutBackground:
                    "Wenn es länger als eine Stunde passiert, schreib dem Logi-Support.",
                otherBackground:
                    "Wenn es wieder passiert, schreib dem Logi-Support und schick die Uhrzeit des Fehlers.",
            },
            followUps: {
                announcement:
                    "Die Ankündigung geht bei der nächsten Synchronisierung von selbst raus, innerhalb von 5 Minuten.",
                roster: "Der Kader wird bei der nächsten Synchronisierung von selbst veröffentlicht, innerhalb von 5 Minuten.",
                forum: "Das Forum wird bei der nächsten Synchronisierung von selbst ergänzt, innerhalb von 5 Minuten.",
                eventRoles:
                    "Die Rollen werden bei der nächsten Synchronisierung gesetzt.",
                scheduledEvent:
                    "Das Event wird bei der nächsten Synchronisierung von selbst aktualisiert.",
                memberRoles:
                    "Die Rollen werden bei der nächsten Synchronisierung ergänzt.",
                panel: "Das Panel wird bei der nächsten Synchronisierung von selbst aktualisiert.",
                reminders: "Die nächste Erinnerung geht wie geplant raus.",
                ticket: "Sag dem Spieler dann, dass er das Ticket erneut öffnen soll.",
                ticketClose:
                    "Das Ticket ist in Logi geschlossen; schließe den Thread danach in Discord von Hand ab.",
                application:
                    "Sag dem Bewerber dann, dass er die Bewerbung erneut abschicken soll.",
                playerReport:
                    "Sag dem Spieler dann, dass er die Meldung erneut abschicken soll.",
                ticketSupport:
                    "Füg den Support dann von Hand zum Ticket hinzu, der Bot versucht es nicht erneut.",
                ticketIntro:
                    "Das Ticket ist ohne Einleitung offen, antworte dem Spieler direkt im Thread.",
                ticketRename:
                    "Das Ticket funktioniert unter dem alten Namen weiter, umbenennen kannst du es von Hand.",
                applicationRecruiters:
                    "Füg das Recruiting dann von Hand zur Bewerbung hinzu, der Bot versucht es nicht erneut.",
                applicationIntro:
                    "Die Bewerbung ist ohne Einleitung offen, antworte dem Bewerber direkt im Thread.",
                applicationRename:
                    "Die Bewerbung funktioniert unter dem alten Namen weiter, umbenennen kannst du sie von Hand.",
                panelPassword:
                    "Das Passwort erscheint bei der nächsten Aktualisierung von selbst wieder im Panel, innerhalb einer Minute.",
                seedControl: "Die Steuerung wird dann von selbst gesendet.",
            },
            context: {
                channel: "Kanal {channel}",
                category: "Kategorie {category}",
                role: "Rolle {role}",
                meetingChannel: "Treffpunkt {channel}",
                tried: "versucht von {user}",
                author: "Autor {user}",
                applicant: "Bewerber {user}",
                ticketNumber: "Ticket #{number}",
                applicationNumber: "Bewerbung #{number}",
                panel: "Panel {panel}",
                moreMembers: "und {count} weitere",
                players: { one: "{count} Spieler", other: "{count} Spieler" },
            },
            unnamed: {
                channel: "aus den Logi-Einstellungen",
                category: "aus den Logi-Einstellungen",
                role: "aus den Logi-Einstellungen",
            },
            and: "und",
            links: {
                match: "Match öffnen",
                channels: "Kanäle in Logi",
                tickets: "Tickets in Logi",
                roles: "Rollen und Zugriff in Logi",
                membership: "Mitgliedschaft in Logi",
                panels: "Panels in Logi",
                seed: "Server-Seeding in Logi",
            },
            permissions: {
                ViewChannel: "Kanal ansehen",
                SendMessages: "Nachrichten senden",
                SendMessagesInThreads: "Nachrichten in Threads senden",
                EmbedLinks: "Links einbetten",
                AttachFiles: "Dateien anhängen",
                ReadMessageHistory: "Nachrichtenverlauf anzeigen",
                ManageChannels: "Kanäle verwalten",
                ManageRoles: "Rollen verwalten",
                ManageThreads: "Threads verwalten",
                ManageMessages: "Nachrichten verwalten",
                CreatePublicThreads: "Öffentliche Threads erstellen",
                CreatePrivateThreads: "Private Threads erstellen",
                ManageEvents: "Events verwalten",
                Connect: "Verbinden",
            },
        },
        serviceStatus: {
            label: "Logi-Dienste",
            allRunning: "Alles läuft",
            oneDown: "{service} funktioniert nicht",
            manyDown: "{services} funktionieren nicht",
            unknownTitle: "Den Status kennen wir gerade nicht",
            unknownChip: "Monitoring antwortet nicht",
            unknownBody:
                "Die Dienste können normal laufen. Der Status erscheint, sobald das Monitoring wieder antwortet.",
            checked: "Prüfung alle {seconds} s · zuletzt heute um {time}",
            up: "In Betrieb",
            down: "Nicht verfügbar",
            threadNote: "Statusänderungen stehen im Thread",
            threadName: "Statusänderungen",
            changeDownTitle: "{service} funktioniert nicht",
            changeDownBody: "Der Ausfall begann um {time}.",
            changeUpTitle: "{service} läuft wieder",
            changeUpBody: "Der Ausfall dauerte {duration}.",
            changeUpBodyUnknown:
                "Wie lange der Ausfall dauerte, wissen wir nicht.",
            duration: {
                lessThanMinute: "weniger als eine Minute",
                minutes: { one: "{count} Minute", other: "{count} Minuten" },
                hours: { one: "{count} Stunde", other: "{count} Stunden" },
                days: { one: "{count} Tag", other: "{count} Tage" },
                pair: "{first} und {second}",
            },
            and: "und",
        },
        previews: dePreviews,
    },
}

/** The system copy in the clan language; unknown languages read English. */
export const getSystemMessages = clanCopy(systemMessages)
