import type { GameAccountCopy } from "@/domain/game-accounts/account-copy"

import { clanCopy, type ClanLanguage } from "./core"

export type GameAccountMessages = GameAccountCopy

/**
 * `/link` and its private guide (boards L4 "Herní účty a ověření" and M3
 * "/link"): linking a game account, the "Hrál jsi u nás?" search, the
 * linked accounts and unlinking. Bot copy says "ty" ("du"); Czech is
 * verbatim from the boards.
 */

const gameAccountMessages: Record<ClanLanguage, GameAccountMessages> = {
    cs: {
        label: "Herní účty",
        platformLabel: "Herní účty · {platform}",
        platforms: {
            steam: {
                name: "Steam",
                idName: "Steam64 ID",
                option: "Steam64 ID, 17 číslic",
                guideTitle: "Najdi své Steam64 ID",
                guideHelp: "Je to 17místné číslo, které začíná 7656119.",
                steps: [
                    "Otevři návod.",
                    "Zkopíruj číslo u Steam64 ID.",
                    "Vlož ho v dalším kroku.",
                ],
                enter: "Zadat Steam64 ID",
                modalTitle: "Propojit Steam",
                placeholder: "76561198…",
                invalidTitle: "Tohle nevypadá jako Steam64 ID",
                invalidBody:
                    "Má 17 číslic a začíná 7656119. Najdeš ho podle {guide}.",
            },
            epic: {
                name: "Epic Games",
                idName: "Epic Account ID",
                option: "Epic Account ID",
                guideTitle: "Najdi své Epic Account ID",
                guideHelp: "Je to 32místný kód z číslic a písmen a–f.",
                steps: [
                    "Otevři návod.",
                    "Zkopíruj kód u Account ID.",
                    "Vlož ho v dalším kroku.",
                ],
                enter: "Zadat Epic Account ID",
                modalTitle: "Propojit Epic Games",
                placeholder: "32 znaků, např. 8f3c…",
                invalidTitle: "Tohle nevypadá jako Epic Account ID",
                invalidBody:
                    "Má 32 znaků, jen číslice a písmena a–f. Najdeš ho podle {guide}.",
            },
            xbox: {
                name: "Xbox",
                idName: "ID profilu Xbox",
                option: "ID profilu Xbox",
                guideTitle: "Najdi své ID profilu Xbox",
                guideHelp:
                    "Je to tvoje jmenovka (gamertag), jak ji vidí ostatní hráči.",
                steps: [
                    "Otevři návod.",
                    "Zkopíruj svou jmenovku.",
                    "Vlož ji v dalším kroku.",
                ],
                enter: "Zadat ID profilu Xbox",
                modalTitle: "Propojit Xbox",
                placeholder: "Např. Hrac17CZ",
                invalidTitle: "Tohle nevypadá jako ID profilu Xbox",
                invalidBody:
                    "Jmenovka začíná písmenem a má nejvýš 15 znaků. Najdeš ji podle {guide}.",
            },
            playstation: {
                name: "PlayStation",
                idName: "ID profilu PlayStation",
                option: "ID profilu PlayStation",
                guideTitle: "Najdi své ID profilu PlayStation",
                guideHelp: "Je to tvoje online ID, jak ho vidí ostatní hráči.",
                steps: [
                    "Otevři návod.",
                    "Zkopíruj své online ID.",
                    "Vlož ho v dalším kroku.",
                ],
                enter: "Zadat ID profilu PlayStation",
                modalTitle: "Propojit PlayStation",
                placeholder: "Např. Hrac17_CZ",
                invalidTitle: "Tohle nevypadá jako ID profilu PlayStation",
                invalidBody:
                    "Má 3 až 16 znaků a začíná písmenem. Najdeš ho podle {guide}.",
            },
        },
        otherPlatform: "Jiné ID",
        start: {
            title: "Propoj svůj herní účet",
            body: "Podle ID tě Logi spáruje s tvými hrami, statistikami a přihláškou do klanu.",
            platformPlaceholder: "Vyber platformu",
            declaration:
                "Je to tvoje prohlášení, ne ověření vlastnictví. Ověřený Steam propojíš v Logi → Můj účet.",
            verifySteam: "Ověřit Steam na webu",
        },
        playedBefore: {
            title: "Hrál jsi už na serverech klanu?",
            placeholder: "Vyber jednu možnost",
            yes: "Ano, najděte mě",
            yesDescription: "Najdeme tě podle jména ve hře",
            no: "Ne, zadám ID",
            noDescription: "Vybereš platformu a ID zadáš sám",
        },
        search: {
            modalTitle: "Najít mě ve hře",
            label: "Jméno ve hře nebo ID",
            placeholder: "Napiš aspoň 3 znaky",
            resultsTitle: "Vyber se ze seznamu",
            resultsPlaceholder: "Vyber svoje jméno",
            resultsNote: "Hráči, kteří hráli na serverech klanu.",
            searchAgain: "Hledat znovu",
            enterManually: "Zadat ID ručně",
            lastSeen: "naposledy {date}",
            lastSeenOn: "naposledy {date} na {server}",
            noneTitle: "Na serverech klanu jsme tě nenašli",
            noneBody: "Zkus jiné jméno, nebo zadej ID ručně.",
            unavailableTitle: "Hledání teď nejde",
            unavailableBody:
                "Servery klanu neodpověděly. Zadej ID ručně, nebo to zkus za chvíli.",
        },
        guide: {
            guideLink: "Návod",
            guideInline: "návodu",
            back: "Zpět",
            continueApplication: "Zadat ID a pokračovat",
        },
        linked: {
            title: "Tvoje propojené účty",
            chip: "{platform} propojený",
            successTitle: "{platform} je propojený",
            successBody: "Logi tě teď spáruje s tvými hrami a statistikami.",
            addAnother: "Přidat další účet",
            unlink: "Odpojit účet",
        },
        unlink: {
            title: "Který účet odpojit?",
            placeholder: "Vyber účet",
            usedByApplication: "Používá ho tvoje přihláška do klanu",
            statsStop: "Statistiky z tohoto účtu se přestanou párovat",
            back: "Zpět",
        },
        errors: {
            retry: "Zadat znovu",
            staleTitle: "Tahle nabídka už neplatí",
            staleBody: "Spusť /link znovu.",
            takenTitle: "Tohle ID už má propojené jiný hráč",
            takenBody:
                "Zkontroluj, že je ID tvoje. Když ano, napiš správcům klanu.",
        },
    },
    pl: {
        label: "Konta gier",
        platformLabel: "Konta gier · {platform}",
        platforms: {
            steam: {
                name: "Steam",
                idName: "Steam64 ID",
                option: "Steam64 ID, 17 cyfr",
                guideTitle: "Znajdź swój Steam64 ID",
                guideHelp:
                    "Jest to 17-cyfrowy numer rozpoczynający się od 7656119.",
                steps: [
                    "Otwórz przewodnik.",
                    "Skopiuj numer obok Steam64 ID.",
                    "Wklej go w następnym kroku.",
                ],
                enter: "Wprowadź Steam64 ID",
                modalTitle: "Połącz Steam",
                placeholder: "76561198…",
                invalidTitle: "To nie wygląda na Steam64 ID",
                invalidBody:
                    "Ma 17 cyfr i zaczyna się od 7656119. {guide} pokazuje, gdzie go znaleźć.",
            },
            epic: {
                name: "Epic Games",
                idName: "Epic Account ID",
                option: "Epic Account ID",
                guideTitle: "Znajdź swój Epic Account ID",
                guideHelp:
                    "Jest to 32-znakowy kod składający się z cyfr i liter a–f.",
                steps: [
                    "Otwórz przewodnik.",
                    "Skopiuj kod obok identyfikatora konta.",
                    "Wklej go w następnym kroku.",
                ],
                enter: "Wprowadź Epic Account ID",
                modalTitle: "Połącz Epic Games",
                placeholder: "32 znaki, np. 8f3c…",
                invalidTitle: "To nie wygląda na Epic Account ID",
                invalidBody:
                    "Zawiera 32 znaki: tylko cyfry i litery a–f. {guide} pokazuje, gdzie go znaleźć.",
            },
            xbox: {
                name: "Xbox",
                idName: "Identyfikator profilu Xbox",
                option: "Identyfikator profilu Xbox",
                guideTitle: "Znajdź identyfikator swojego profilu Xbox",
                guideHelp: "To Twój tag gracza, widziany przez innych graczy.",
                steps: [
                    "Otwórz przewodnik.",
                    "Skopiuj swój tag gracza.",
                    "Wklej go w następnym kroku.",
                ],
                enter: "Wprowadź identyfikator profilu Xbox",
                modalTitle: "Połącz Xbox",
                placeholder: "np. Gracz17CZ",
                invalidTitle: "To nie wygląda na identyfikator profilu Xbox",
                invalidBody:
                    "Tag gracza zaczyna się od litery i ma maksymalnie 15 znaków. {guide} pokazuje, gdzie go znaleźć.",
            },
            playstation: {
                name: "PlayStation",
                idName: "Identyfikator profilu PlayStation",
                option: "Identyfikator profilu PlayStation",
                guideTitle: "Znajdź swój identyfikator profilu PlayStation",
                guideHelp:
                    "To Twój identyfikator online, widziany przez innych graczy.",
                steps: [
                    "Otwórz przewodnik.",
                    "Skopiuj swój identyfikator internetowy.",
                    "Wklej go w następnym kroku.",
                ],
                enter: "Wprowadź identyfikator profilu PlayStation",
                modalTitle: "Połącz PlayStation",
                placeholder: "np. Gracz17_CZ",
                invalidTitle:
                    "To nie wygląda na identyfikator profilu PlayStation",
                invalidBody:
                    "Zawiera od 3 do 16 znaków i zaczyna się od litery. {guide} pokazuje, gdzie go znaleźć.",
            },
        },
        otherPlatform: "Inny identyfikator",
        start: {
            title: "Połącz swoje konto gry",
            body: "Dzięki identyfikatorowi Logi powiąże Cię z rozgrywkami, statystykami i zgłoszeniem do klanu.",
            platformPlaceholder: "Wybierz platformę",
            declaration:
                "Podanie identyfikatora jest deklaracją, a nie potwierdzeniem własności konta. Steam zweryfikujesz w Logi → Moje konto.",
            verifySteam: "Zweryfikuj Steam na stronie",
        },
        playedBefore: {
            title: "Czy grałeś na serwerach klanu?",
            placeholder: "Wybierz jedną opcję",
            yes: "Tak, znajdź mnie",
            yesDescription: "Znajdziemy Cię po Twojej nazwie w grze",
            no: "Nie, wprowadzę swój identyfikator",
            noDescription:
                "Wybierasz platformę i samodzielnie wprowadzasz identyfikator",
        },
        search: {
            modalTitle: "Znajdź mnie w grze",
            label: "Nick w grze lub ID",
            placeholder: "Wpisz co najmniej 3 znaki",
            resultsTitle: "Wybierz siebie z listy",
            resultsPlaceholder: "Wybierz swój nick",
            resultsNote: "Gracze, którzy grali na serwerach klanu.",
            searchAgain: "Wyszukaj ponownie",
            enterManually: "Wprowadź identyfikator ręcznie",
            lastSeen: "ostatnio widziany {date}",
            lastSeenOn: "ostatnio widziany {date} na {server}",
            noneTitle: "Nie mogliśmy Cię znaleźć na serwerach klanu",
            noneBody:
                "Spróbuj innej nazwy lub wprowadź swój identyfikator ręcznie.",
            unavailableTitle: "Wyszukiwanie nie jest obecnie dostępne",
            unavailableBody:
                "Serwery klanu nie odpowiedziały. Wprowadź swój identyfikator ręcznie lub spróbuj ponownie za chwilę.",
        },
        guide: {
            guideLink: "Przewodnik",
            guideInline: "Przewodnik",
            back: "Wstecz",
            continueApplication: "Wprowadź identyfikator i kontynuuj",
        },
        linked: {
            title: "Twoje połączone konta",
            chip: "{platform} połączone",
            successTitle: "{platform} jest połączone",
            successBody:
                "Logi będzie teraz dopasowywał Cię do Twoich gier i statystyk.",
            addAnother: "Dodaj kolejne konto",
            unlink: "Odłącz konto",
        },
        unlink: {
            title: "Które konto chcesz odłączyć?",
            placeholder: "Wybierz konto",
            usedByApplication: "Konto jest używane w Twoim zgłoszeniu do klanu",
            statsStop: "Statystyki z tego konta nie będą już dopasowywane",
            back: "Wstecz",
        },
        errors: {
            retry: "Wprowadź ponownie",
            staleTitle: "Ta opcja wygasła",
            staleBody: "Uruchom ponownie /link.",
            takenTitle: "Inny gracz powiązał już ten identyfikator",
            takenBody:
                "Sprawdź, czy identyfikator jest Twój. Jeśli tak, napisz do adminów klanu.",
        },
    },
    fr: {
        label: "Comptes de jeu",
        platformLabel: "Comptes de jeu · {platform}",
        platforms: {
            steam: {
                name: "Steam",
                idName: "Steam64 ID",
                option: "Steam64 ID, 17 chiffres",
                guideTitle: "Trouver ton Steam64 ID",
                guideHelp: "C’est un nombre de 17 chiffres commençant par 7656119.",
                steps: [
                    "Ouvre le guide.",
                    "Copie le nombre indiqué à côté de Steam64 ID.",
                    "Colle-le à l’étape suivante.",
                ],
                enter: "Saisir le Steam64 ID",
                modalTitle: "Associer Steam",
                placeholder: "76561198…",
                invalidTitle: "Cela ne ressemble pas à un Steam64 ID",
                invalidBody:
                    "Il comporte 17 chiffres et commence par 7656119. {guide} indique où le trouver.",
            },
            epic: {
                name: "Epic Games",
                idName: "Epic Account ID",
                option: "Epic Account ID",
                guideTitle: "Trouver ton Epic Account ID",
                guideHelp:
                    "C’est un code de 32 caractères composé de chiffres et des lettres a à f.",
                steps: [
                    "Ouvre le guide.",
                    "Copie le code indiqué à côté de Account ID.",
                    "Colle-le à l’étape suivante.",
                ],
                enter: "Saisir l’Epic Account ID",
                modalTitle: "Associer Epic Games",
                placeholder: "32 caractères, ex. : 8f3c…",
                invalidTitle: "Cela ne ressemble pas à un Epic Account ID",
                invalidBody:
                    "Il comporte 32 caractères : uniquement des chiffres et les lettres a à f. {guide} indique où le trouver.",
            },
            xbox: {
                name: "Xbox",
                idName: "Identifiant du profil Xbox",
                option: "Identifiant du profil Xbox",
                guideTitle: "Trouver ton identifiant de profil Xbox",
                guideHelp: "Il s’agit de ton gamertag, tel que les autres joueurs le voient.",
                steps: [
                    "Ouvre le guide.",
                    "Copie ton gamertag.",
                    "Colle-le à l’étape suivante.",
                ],
                enter: "Saisir l’identifiant du profil Xbox",
                modalTitle: "Associer Xbox",
                placeholder: "ex. : Player17CZ",
                invalidTitle: "Cela ne ressemble pas à un identifiant de profil Xbox",
                invalidBody:
                    "Un gamertag commence par une lettre et comporte au maximum 15 caractères. {guide} indique où le trouver.",
            },
            playstation: {
                name: "PlayStation",
                idName: "Identifiant du profil PlayStation",
                option: "Identifiant du profil PlayStation",
                guideTitle: "Trouver ton identifiant de profil PlayStation",
                guideHelp: "Il s’agit de ton ID en ligne, tel que les autres joueurs le voient.",
                steps: [
                    "Ouvre le guide.",
                    "Copie ton ID en ligne.",
                    "Colle-le à l’étape suivante.",
                ],
                enter: "Saisir l’identifiant du profil PlayStation",
                modalTitle: "Associer PlayStation",
                placeholder: "ex. : Player17_CZ",
                invalidTitle: "Cela ne ressemble pas à un identifiant de profil PlayStation",
                invalidBody:
                    "Il comporte de 3 à 16 caractères et commence par une lettre. {guide} indique où le trouver.",
            },
        },
        otherPlatform: "Autre identifiant",
        start: {
            title: "Associer ton compte de jeu",
            body: "Logi utilise cet identifiant pour retrouver tes parties, tes statistiques et ta candidature au clan.",
            platformPlaceholder: "Choisir une plateforme",
            declaration:
                "Il s’agit d’une déclaration de ta part, pas d’une preuve de propriété. Pour associer un compte Steam vérifié, ouvre Logi → Mon compte.",
            verifySteam: "Vérifier Steam sur le site",
        },
        playedBefore: {
            title: "As-tu déjà joué sur les serveurs du clan ?",
            placeholder: "Choisis une option",
            yes: "Oui, me retrouver",
            yesDescription: "Nous te retrouverons à partir de ton pseudo en jeu",
            no: "Non, je saisirai mon identifiant",
            noDescription: "Tu choisis la plateforme et saisis toi-même ton identifiant",
        },
        search: {
            modalTitle: "Me retrouver en jeu",
            label: "Pseudo ou identifiant en jeu",
            placeholder: "Saisis au moins 3 caractères",
            resultsTitle: "Sélectionne ton compte dans la liste",
            resultsPlaceholder: "Choisis ton pseudo",
            resultsNote: "Joueurs ayant joué sur les serveurs du clan.",
            searchAgain: "Relancer la recherche",
            enterManually: "Saisir l’identifiant manuellement",
            lastSeen: "vu pour la dernière fois {date}",
            lastSeenOn: "vu pour la dernière fois {date} sur {server}",
            noneTitle: "Nous ne t’avons pas trouvé sur les serveurs du clan",
            noneBody: "Essaie un autre pseudo ou saisis ton identifiant manuellement.",
            unavailableTitle: "La recherche est indisponible pour le moment",
            unavailableBody:
                "Les serveurs du clan n’ont pas répondu. Saisis ton identifiant manuellement ou réessaie dans un instant.",
        },
        guide: {
            guideLink: "Guide",
            guideInline: "Le guide",
            back: "Retour",
            continueApplication: "Saisir l’identifiant et continuer",
        },
        linked: {
            title: "Tes comptes associés",
            chip: "{platform} associé",
            successTitle: "{platform} est associé",
            successBody: "Logi pourra désormais retrouver tes parties et tes statistiques.",
            addAnother: "Ajouter un autre compte",
            unlink: "Dissocier un compte",
        },
        unlink: {
            title: "Quel compte souhaites-tu dissocier ?",
            placeholder: "Choisis un compte",
            usedByApplication: "Ta candidature au clan l’utilise",
            statsStop: "Les statistiques de ce compte ne te seront plus associées",
            back: "Retour",
        },
        errors: {
            retry: "Saisir à nouveau",
            staleTitle: "Cette option a expiré",
            staleBody: "Relance /link.",
            takenTitle: "Un autre joueur a déjà associé cet identifiant",
            takenBody:
                "Vérifie que cet identifiant t’appartient. Si c’est le cas, contacte les administrateurs du clan.",
        },
    },
    en: {
        label: "Game accounts",
        platformLabel: "Game accounts · {platform}",
        platforms: {
            steam: {
                name: "Steam",
                idName: "Steam64 ID",
                option: "Steam64 ID, 17 digits",
                guideTitle: "Find your Steam64 ID",
                guideHelp: "It's a 17-digit number that starts with 7656119.",
                steps: [
                    "Open the guide.",
                    "Copy the number next to Steam64 ID.",
                    "Paste it in the next step.",
                ],
                enter: "Enter Steam64 ID",
                modalTitle: "Link Steam",
                placeholder: "76561198…",
                invalidTitle: "That doesn't look like a Steam64 ID",
                invalidBody:
                    "It has 17 digits and starts with 7656119. {guide} shows where to find it.",
            },
            epic: {
                name: "Epic Games",
                idName: "Epic Account ID",
                option: "Epic Account ID",
                guideTitle: "Find your Epic Account ID",
                guideHelp:
                    "It's a 32-character code of digits and the letters a–f.",
                steps: [
                    "Open the guide.",
                    "Copy the code next to Account ID.",
                    "Paste it in the next step.",
                ],
                enter: "Enter Epic Account ID",
                modalTitle: "Link Epic Games",
                placeholder: "32 characters, e.g. 8f3c…",
                invalidTitle: "That doesn't look like an Epic Account ID",
                invalidBody:
                    "It has 32 characters: digits and the letters a–f only. {guide} shows where to find it.",
            },
            xbox: {
                name: "Xbox",
                idName: "Xbox profile ID",
                option: "Xbox profile ID",
                guideTitle: "Find your Xbox profile ID",
                guideHelp: "It's your gamertag, as other players see it.",
                steps: [
                    "Open the guide.",
                    "Copy your gamertag.",
                    "Paste it in the next step.",
                ],
                enter: "Enter Xbox profile ID",
                modalTitle: "Link Xbox",
                placeholder: "e.g. Player17CZ",
                invalidTitle: "That doesn't look like an Xbox profile ID",
                invalidBody:
                    "A gamertag starts with a letter and has at most 15 characters. {guide} shows where to find it.",
            },
            playstation: {
                name: "PlayStation",
                idName: "PlayStation profile ID",
                option: "PlayStation profile ID",
                guideTitle: "Find your PlayStation profile ID",
                guideHelp: "It's your online ID, as other players see it.",
                steps: [
                    "Open the guide.",
                    "Copy your online ID.",
                    "Paste it in the next step.",
                ],
                enter: "Enter PlayStation profile ID",
                modalTitle: "Link PlayStation",
                placeholder: "e.g. Player17_CZ",
                invalidTitle: "That doesn't look like a PlayStation profile ID",
                invalidBody:
                    "It has 3 to 16 characters and starts with a letter. {guide} shows where to find it.",
            },
        },
        otherPlatform: "Other ID",
        start: {
            title: "Link your game account",
            body: "Logi uses the ID to match you with your games, your stats and your clan application.",
            platformPlaceholder: "Choose a platform",
            declaration:
                "This is your own statement, not proof of ownership. You link a verified Steam account in Logi → My account.",
            verifySteam: "Verify Steam on the web",
        },
        playedBefore: {
            title: "Have you played on the clan's servers?",
            placeholder: "Choose one option",
            yes: "Yes, find me",
            yesDescription: "We'll find you by your in-game name",
            no: "No, I'll enter my ID",
            noDescription: "You pick the platform and enter the ID yourself",
        },
        search: {
            modalTitle: "Find me in game",
            label: "In-game name or ID",
            placeholder: "Type at least 3 characters",
            resultsTitle: "Pick yourself from the list",
            resultsPlaceholder: "Choose your name",
            resultsNote: "Players who played on the clan's servers.",
            searchAgain: "Search again",
            enterManually: "Enter ID manually",
            lastSeen: "last seen {date}",
            lastSeenOn: "last seen {date} on {server}",
            noneTitle: "We couldn't find you on the clan's servers",
            noneBody: "Try another name, or enter your ID manually.",
            unavailableTitle: "Search isn't available right now",
            unavailableBody:
                "The clan's servers didn't answer. Enter your ID manually, or try again in a moment.",
        },
        guide: {
            guideLink: "Guide",
            guideInline: "The guide",
            back: "Back",
            continueApplication: "Enter ID and continue",
        },
        linked: {
            title: "Your linked accounts",
            chip: "{platform} linked",
            successTitle: "{platform} is linked",
            successBody: "Logi will now match you with your games and stats.",
            addAnother: "Add another account",
            unlink: "Unlink account",
        },
        unlink: {
            title: "Which account do you want to unlink?",
            placeholder: "Choose an account",
            usedByApplication: "Your clan application uses it",
            statsStop: "Stats from this account will no longer be matched",
            back: "Back",
        },
        errors: {
            retry: "Enter again",
            staleTitle: "This option has expired",
            staleBody: "Run /link again.",
            takenTitle: "Another player has already linked this ID",
            takenBody:
                "Check that the ID is yours. If it is, write to the clan's admins.",
        },
    },
    de: {
        label: "Spielkonten",
        platformLabel: "Spielkonten · {platform}",
        platforms: {
            steam: {
                name: "Steam",
                idName: "Steam64-ID",
                option: "Steam64-ID, 17 Ziffern",
                guideTitle: "Finde deine Steam64-ID",
                guideHelp:
                    "Sie ist eine 17-stellige Zahl, die mit 7656119 beginnt.",
                steps: [
                    "Öffne die Anleitung.",
                    "Kopiere die Zahl bei Steam64-ID.",
                    "Füge sie im nächsten Schritt ein.",
                ],
                enter: "Steam64-ID eingeben",
                modalTitle: "Steam verknüpfen",
                placeholder: "76561198…",
                invalidTitle: "Das sieht nicht nach einer Steam64-ID aus",
                invalidBody:
                    "Sie hat 17 Ziffern und beginnt mit 7656119. {guide} zeigt, wo du sie findest.",
            },
            epic: {
                name: "Epic Games",
                idName: "Epic-Konto-ID",
                option: "Epic-Konto-ID",
                guideTitle: "Finde deine Epic-Konto-ID",
                guideHelp:
                    "Sie ist ein 32-stelliger Code aus Ziffern und den Buchstaben a–f.",
                steps: [
                    "Öffne die Anleitung.",
                    "Kopiere den Code bei Konto-ID.",
                    "Füge ihn im nächsten Schritt ein.",
                ],
                enter: "Epic-Konto-ID eingeben",
                modalTitle: "Epic Games verknüpfen",
                placeholder: "32 Zeichen, z. B. 8f3c…",
                invalidTitle: "Das sieht nicht nach einer Epic-Konto-ID aus",
                invalidBody:
                    "Sie hat 32 Zeichen, nur Ziffern und die Buchstaben a–f. {guide} zeigt, wo du sie findest.",
            },
            xbox: {
                name: "Xbox",
                idName: "Xbox-Profil-ID",
                option: "Xbox-Profil-ID",
                guideTitle: "Finde deine Xbox-Profil-ID",
                guideHelp:
                    "Das ist dein Gamertag, so wie andere Spieler ihn sehen.",
                steps: [
                    "Öffne die Anleitung.",
                    "Kopiere deinen Gamertag.",
                    "Füge ihn im nächsten Schritt ein.",
                ],
                enter: "Xbox-Profil-ID eingeben",
                modalTitle: "Xbox verknüpfen",
                placeholder: "z. B. Spieler17CZ",
                invalidTitle: "Das sieht nicht nach einer Xbox-Profil-ID aus",
                invalidBody:
                    "Ein Gamertag beginnt mit einem Buchstaben und hat höchstens 15 Zeichen. {guide} zeigt, wo du ihn findest.",
            },
            playstation: {
                name: "PlayStation",
                idName: "PlayStation-Profil-ID",
                option: "PlayStation-Profil-ID",
                guideTitle: "Finde deine PlayStation-Profil-ID",
                guideHelp:
                    "Das ist deine Online-ID, so wie andere Spieler sie sehen.",
                steps: [
                    "Öffne die Anleitung.",
                    "Kopiere deine Online-ID.",
                    "Füge sie im nächsten Schritt ein.",
                ],
                enter: "PlayStation-Profil-ID eingeben",
                modalTitle: "PlayStation verknüpfen",
                placeholder: "z. B. Spieler17_CZ",
                invalidTitle:
                    "Das sieht nicht nach einer PlayStation-Profil-ID aus",
                invalidBody:
                    "Sie hat 3 bis 16 Zeichen und beginnt mit einem Buchstaben. {guide} zeigt, wo du sie findest.",
            },
        },
        otherPlatform: "Andere ID",
        start: {
            title: "Verknüpfe dein Spielkonto",
            body: "Über die ID ordnet Logi dir deine Spiele, deine Statistiken und deine Clan-Bewerbung zu.",
            platformPlaceholder: "Wähle eine Plattform",
            declaration:
                "Das ist deine eigene Angabe, kein Nachweis des Besitzes. Ein verifiziertes Steam-Konto verknüpfst du in Logi → Mein Konto.",
            verifySteam: "Steam im Web verifizieren",
        },
        playedBefore: {
            title: "Hast du schon auf den Servern des Clans gespielt?",
            placeholder: "Wähle eine Option",
            yes: "Ja, findet mich",
            yesDescription: "Wir finden dich über deinen Namen im Spiel",
            no: "Nein, ich gebe die ID ein",
            noDescription:
                "Du wählst die Plattform und gibst die ID selbst ein",
        },
        search: {
            modalTitle: "Finde mich im Spiel",
            label: "Name im Spiel oder ID",
            placeholder: "Mindestens 3 Zeichen",
            resultsTitle: "Wähle dich aus der Liste",
            resultsPlaceholder: "Wähle deinen Namen",
            resultsNote:
                "Spieler, die auf den Servern des Clans gespielt haben.",
            searchAgain: "Erneut suchen",
            enterManually: "ID selbst eingeben",
            lastSeen: "zuletzt {date}",
            lastSeenOn: "zuletzt {date} auf {server}",
            noneTitle:
                "Wir haben dich auf den Servern des Clans nicht gefunden",
            noneBody:
                "Versuch einen anderen Namen oder gib deine ID selbst ein.",
            unavailableTitle: "Die Suche geht gerade nicht",
            unavailableBody:
                "Die Server des Clans haben nicht geantwortet. Gib deine ID selbst ein oder versuch es gleich noch einmal.",
        },
        guide: {
            guideLink: "Anleitung",
            guideInline: "Die Anleitung",
            back: "Zurück",
            continueApplication: "ID eingeben und weiter",
        },
        linked: {
            title: "Deine verknüpften Konten",
            chip: "{platform} verknüpft",
            successTitle: "{platform} ist verknüpft",
            successBody:
                "Logi ordnet dir jetzt deine Spiele und Statistiken zu.",
            addAnother: "Weiteres Konto hinzufügen",
            unlink: "Konto trennen",
        },
        unlink: {
            title: "Welches Konto willst du trennen?",
            placeholder: "Wähle ein Konto",
            usedByApplication: "Deine Clan-Bewerbung nutzt es",
            statsStop: "Statistiken dieses Kontos werden nicht mehr zugeordnet",
            back: "Zurück",
        },
        errors: {
            retry: "Erneut eingeben",
            staleTitle: "Dieses Angebot ist nicht mehr gültig",
            staleBody: "Starte /link erneut.",
            takenTitle: "Ein anderer Spieler hat diese ID schon verknüpft",
            takenBody:
                "Prüfe, ob die ID deine ist. Wenn ja, schreib den Admins des Clans.",
        },
    },
}

export const getGameAccountMessages = clanCopy(gameAccountMessages)
