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
                    "Má 17 číslic a začíná 7656119. Najdeš ho podle návodu.",
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
                    "Má 32 znaků, jen číslice a písmena a–f. Najdeš ho podle návodu.",
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
                    "Jmenovka začíná písmenem a má nejvýš 15 znaků. Najdeš ji podle návodu.",
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
                    "Má 3 až 16 znaků a začíná písmenem. Najdeš ho podle návodu.",
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
                    "It has 17 digits and starts with 7656119. The guide shows where to find it.",
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
                    "It has 32 characters: digits and the letters a–f only. The guide shows where to find it.",
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
                    "A gamertag starts with a letter and has at most 15 characters. The guide shows where to find it.",
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
                    "It has 3 to 16 characters and starts with a letter. The guide shows where to find it.",
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
                    "Sie hat 17 Ziffern und beginnt mit 7656119. Die Anleitung zeigt, wo du sie findest.",
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
                    "Sie hat 32 Zeichen, nur Ziffern und die Buchstaben a–f. Die Anleitung zeigt, wo du sie findest.",
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
                    "Ein Gamertag beginnt mit einem Buchstaben und hat höchstens 15 Zeichen. Die Anleitung zeigt, wo du ihn findest.",
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
                    "Sie hat 3 bis 16 Zeichen und beginnt mit einem Buchstaben. Die Anleitung zeigt, wo du sie findest.",
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
