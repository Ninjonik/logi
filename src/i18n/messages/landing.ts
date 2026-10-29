/** Public landing-page copy. Keep the three locales structurally identical. */
export type LandingMessages = {
    metaTitle: string
    metaDescription: string
    nav: { workflow: string; setup: string; features: string; source: string }
    hero: {
        title: string
        accent: string
        description: string
        primary: string
        secondary: string
        proof: string[]
    }
    screens: {
        overview: string
        event: string
        roster: string
        performance: string
        calendar: string
        zoom: string
        caption: string
        close: string
    }
    setup: {
        eyebrow: string
        title: string
        description: string
        steps: Array<{ title: string; text: string }>
        guide: string
    }
    workflow: {
        eyebrow: string
        title: string
        description: string
        steps: Array<{
            short: string
            title: string
            text: string
            bullets: string[]
        }>
        example: string
        channel: string
    }
    roster: {
        eyebrow: string
        title: string
        description: string
        points: string[]
        guide: string
    }
    discord: {
        eyebrow: string
        title: string
        description: string
        labels: string[]
        note: string
    }
    performance: {
        eyebrow: string
        title: string
        description: string
        points: string[]
        guide: string
    }
    explore: {
        eyebrow: string
        title: string
        description: string
        cards: Array<{ title: string; text: string }>
        guide: string
    }
    ownership: {
        eyebrow: string
        title: string
        description: string
        source: string
        contribute: string
        host: string
    }
    faq: { title: string; items: Array<{ question: string; answer: string }> }
    comms: { title: string; description: string; download: string }
    closing: { title: string; description: string; action: string }
}

export const enLanding: LandingMessages = {
    metaTitle: "Logi — events, rosters and Discord for your clan",
    metaDescription:
        "Plan matches and trainings, collect sign-ups in Discord, publish rosters and follow your team’s progress. Open-source clan management with Logi.",
    nav: {
        workflow: "How it works",
        setup: "Getting started",
        features: "More in Logi",
        source: "GitHub",
    },
    hero: {
        title: "The Ultimate",
        accent: "Clan Management Tool.",
        description: "You organise in Logi. Your players respond in Discord.",
        primary: "Get started with Discord",
        secondary: "See how it works",
        proof: ["Open source", "All features free", "Self-hosting available"],
    },
    screens: {
        overview: "Your clan’s dashboard",
        event: "The match editor and its Discord preview",
        roster: "A published squad roster",
        performance: "Clan performance across recent matches",
        calendar: "The community calendar",
        zoom: "Enlarge screenshot",
        caption:
            "Real screens from the Valkyria community. Screenshots are in English; Logi supports English, Czech and German.",
        close: "Close screenshot",
    },
    setup: {
        eyebrow: "START SIMPLE",
        title: "Set it up once. Use it every week.",
        description:
            "Sign in, add your clan and connect the bot. Choose the channels, groups and roles your clan needs.",
        steps: [
            {
                title: "Sign in with Discord",
                text: "Use your existing account and open your clan’s workspace.",
            },
            {
                title: "Connect your server",
                text: "Invite the bot, grant its permissions and choose where event and roster messages go.",
            },
            {
                title: "Configure your clan",
                text: "Select your games, create player groups and configure Discord roles and sign-up permissions.",
            },
        ],
        guide: "Read the setup guide",
    },
    workflow: {
        eyebrow: "FROM A PLANNED FIXTURE TO A MATCH-READY TEAM",
        title: "From match details to a published roster.",
        description:
            "Here’s the part you’ll use every week: create the event, collect responses and publish the roster.",
        steps: [
            {
                short: "Plan",
                title: "Put the details in effortlessly.",
                text: "Choose the game, teams, map and schedule.",
                bullets: [
                    "Start from an event template",
                    "Set a meeting time and sign-up deadline",
                    "Check the announcement before publishing",
                ],
            },
            {
                short: "Collect sign-ups",
                title: "Players answer in Discord.",
                text: "Logi publishes the announcement. Players sign up for a group or say they can’t attend.",
                bullets: [
                    "Group choices and capacity limits",
                    "Sign up without opening the dashboard",
                    "Reminders for people who haven’t replied",
                ],
            },
            {
                short: "Publish the roster",
                title: "Make roster management trivial.",
                text: "Drag players into squads, assign their roles and publish the roster to Discord in a few clicks.",
                bullets: [
                    "Reusable squad presets",
                    "Drag players into their places",
                    "Attendance confirmations and reminders",
                ],
            },
        ],
        example: "Discord preview · illustrative players and match",
        channel: "match-signups",
    },
    roster: {
        eyebrow: "WHEN THE LINEUP CHANGES",
        title: "Roster updates and notifications, handled automatically.",
        description:
            "Publish your changes and Logi updates the roster on Discord. With change notifications enabled, affected players automatically receive their new squad and role by DM.",
        points: [
            "Squads, roles and reserves on the same board",
            "Published assignments players can check in Discord",
            "Availability, acknowledgement and attendance kept distinct",
        ],
        guide: "See how rosters work",
    },
    discord: {
        eyebrow: "FOR THE PEOPLE PLAYING",
        title: "The information reaches your players.",
        description:
            "Announcements, sign-ups and attendance reminders live on Discord.",
        labels: ["The announcement", "A player’s reminder"],
        note: "Rendered with Logi’s actual Discord message simulator. Example data; no messages are sent.",
    },
    performance: {
        eyebrow: "AFTER THE MATCH",
        title: "See how the team is doing over time.",
        description:
            "Review results, look through recorded games and compare performance across matches.",
        points: [
            "Match history and player statistics",
            "Performance graphs across recent games",
            "Game-specific data",
        ],
        guide: "Explore match history",
    },
    explore: {
        eyebrow: "AROUND THE MATCHES",
        title: "The rest of running a clan, too.",
        description: "Use the parts your community needs.",
        cards: [
            {
                title: "Trainings & calendar",
                text: "Schedule recurring sessions and keep matches, trainings and community dates together.",
            },
            {
                title: "Members & applications",
                text: "Manage memberships, applications, groups and Discord roles.",
            },
            {
                title: "Leagues & competitions",
                text: "Follow Wardogs League fixtures and manage your teams and competition entries.",
            },
            {
                title: "Briefings & tactical plans",
                text: "Keep instructions, maps and squad plans with the event they belong to.",
            },
            {
                title: "Tickets & requests",
                text: "Handle player questions and support requests through Discord tickets.",
            },
            {
                title: "Your website & tools",
                text: "Connect through the API, webhooks and optional SSO.",
            },
            {
                title: "Articles & announcements",
                text: "Publish clan news, guides, rules and briefings for your members.",
            },
        ],
        guide: "Explore the wiki",
    },
    ownership: {
        eyebrow: "OPEN SOURCE",
        title: "Use it. Host it. Help build it.",
        description:
            "Logi is MIT-licensed. You can use the hosted app or run the dashboard, Convex backend and Discord bot yourself. Issues, ideas and code contributions are welcome.",
        source: "View the source",
        contribute: "Contributing guide",
        host: "Self-hosting guide",
    },
    faq: {
        title: "A few things you might be wondering.",
        items: [
            {
                question: "Do all our players need to use the dashboard?",
                answer: "Players can sign up and respond to attendance reminders in Discord. The dashboard is where organisers set up events, build rosters and manage the clan.",
            },
            {
                question:
                    "Can we keep our existing Discord groups and channels?",
                answer: "Yes. Configure Logi around your server’s channels, roles and groups. The setup guide explains the bot permissions and connections it needs.",
            },
            {
                question: "Which games does Logi support?",
                answer: "Logi includes game-specific workflows for Hell Let Loose and Wardogs, alongside other game workspaces. Available maps, statistics and integrations depend on the selected game.",
            },
            {
                question: "What does it cost, and can we self-host?",
                answer: "The entire app and all its features are free. The source is MIT-licensed. Self-hosting instructions cover the dashboard, Convex and Discord bot; you provide the infrastructure and Discord application.",
            },
        ],
    },
    comms: {
        title: "Need squad voice tools as well?",
        description:
            "LogiComms is a companion Windows app for squad communication. It’s available separately from the clan dashboard.",
        download: "Download LogiComms",
    },
    closing: {
        title: "Get your next match organised.",
        description:
            "Start with your Discord account. The setup guide will take you through the rest.",
        action: "Open Logi",
    },
}

export const csLanding: LandingMessages = {
    metaTitle: "Logi — akce, soupisky a Discord pro váš klan",
    metaDescription:
        "Plánujte zápasy a tréninky, sbírejte přihlášky na Discordu, zveřejňujte soupisky a sledujte vývoj týmu. Otevřená správa klanu s Logi.",
    nav: {
        workflow: "Jak to funguje",
        setup: "Začínáme",
        features: "Další možnosti",
        source: "GitHub",
    },
    hero: {
        title: "Kompletní nástroj",
        accent: "pro správu klanu.",
        description: "Vy organizujete v Logi. Hráči odpovídají na Discordu.",
        primary: "Začít přes Discord",
        secondary: "Podívat se, jak to funguje",
        proof: [
            "Otevřený kód",
            "Všechny funkce zdarma",
            "Možnost vlastního hostingu",
        ],
    },
    screens: {
        overview: "Dashboard vašeho klanu",
        event: "Editor zápasu s náhledem Discordu",
        roster: "Zveřejněná soupiska družstev",
        performance: "Vývoj výkonů v posledních zápasech",
        calendar: "Komunitní kalendář",
        zoom: "Zvětšit snímek",
        caption:
            "Skutečné obrazovky komunity Valkyria. Snímky jsou v angličtině; Logi podporuje češtinu, angličtinu a němčinu.",
        close: "Zavřít snímek",
    },
    setup: {
        eyebrow: "ZAČNĚTE JEDNODUŠE",
        title: "Jednou nastavíte. Používáte každý týden.",
        description:
            "Přihlaste se, přidejte klan a připojte bota. Vyberte kanály, skupiny a role, které váš klan potřebuje.",
        steps: [
            {
                title: "Přihlaste se přes Discord",
                text: "Použijte svůj účet a otevřete pracovní prostor klanu.",
            },
            {
                title: "Připojte server",
                text: "Pozvěte bota, udělte mu oprávnění a vyberte kanály pro akce a soupisky.",
            },
            {
                title: "Nastavte klan",
                text: "Vyberte hry, vytvořte skupiny hráčů a nastavte Discord role a oprávnění k přihlašování.",
            },
        ],
        guide: "Přečíst průvodce nastavením",
    },
    workflow: {
        eyebrow: "OD NAPLÁNOVANÉHO ZÁPASU K PŘIPRAVENÉ SESTAVĚ",
        title: "Od podrobností akce ke zveřejněné soupisce.",
        description:
            "Tohle využijete každý týden: vytvořit akci, získat odpovědi a zveřejnit soupisku.",
        steps: [
            {
                short: "Plánování",
                title: "Vyplňte podrobnosti bez námahy.",
                text: "Vyberte hru, týmy, mapu a časy.",
                bullets: [
                    "Začněte ze šablony akce",
                    "Nastavte čas srazu a konec registrace",
                    "Před zveřejněním zkontrolujte oznámení",
                ],
            },
            {
                short: "Přihlášky",
                title: "Hráči odpovídají na Discordu.",
                text: "Logi zveřejní oznámení. Hráči se přihlásí do skupiny nebo oznámí neúčast.",
                bullets: [
                    "Výběr skupin a kapacitní limity",
                    "Přihlášení bez otevírání dashboardu",
                    "Připomínky pro hráče, kteří ještě neodpověděli",
                ],
            },
            {
                short: "Zveřejnění soupisky",
                title: "Správa soupisky jednoduše.",
                text: "Přetáhněte hráče do družstev, přiřaďte role a několika kliknutími zveřejněte soupisku na Discordu.",
                bullets: [
                    "Opakovaně použitelné šablony družstev",
                    "Přetahování hráčů do pozic",
                    "Potvrzení účasti a připomínky",
                ],
            },
        ],
        example: "Náhled Discordu · ukázkoví hráči a zápas",
        channel: "prihlasky-na-zapas",
    },
    roster: {
        eyebrow: "KDYŽ SE SESTAVA ZMĚNÍ",
        title: "Aktualizace soupisky a upozornění automaticky.",
        description:
            "Zveřejněte změny a Logi aktualizuje soupisku na Discordu. Při zapnutých upozorněních dostanou dotčení hráči automaticky soukromou zprávu s novým družstvem a rolí.",
        points: [
            "Družstva, role a náhradníci na jedné nástěnce",
            "Zveřejněné pozice si hráči ověří na Discordu",
            "Dostupnost, potvrzení hráčem a skutečná účast mají vlastní stavy",
        ],
        guide: "Jak fungují soupisky",
    },
    discord: {
        eyebrow: "PRO HRÁČE",
        title: "Informace se dostanou k vašim hráčům.",
        description:
            "Oznámení, přihlášky a připomínky účasti jsou na Discordu.",
        labels: ["Oznámení zápasu", "Připomínka pro hráče"],
        note: "Vykresleno skutečným simulátorem zpráv Logi. Ukázková data; žádné zprávy se neposílají.",
    },
    performance: {
        eyebrow: "PO ZÁPASE",
        title: "Sledujte, jak se týmu daří v čase.",
        description:
            "Projděte výsledky, záznamy her a srovnání výkonů napříč zápasy.",
        points: [
            "Historie zápasů a statistiky hráčů",
            "Grafy výkonů v posledních hrách",
            "Herní data",
        ],
        guide: "Prozkoumat historii zápasů",
    },
    explore: {
        eyebrow: "KOLEM ZÁPASŮ",
        title: "I ostatní věci, které správa klanu obnáší.",
        description: "Používejte to, co vaše komunita potřebuje.",
        cards: [
            {
                title: "Tréninky a kalendář",
                text: "Plánujte pravidelné tréninky a mějte zápasy i komunitní akce ve společném kalendáři.",
            },
            {
                title: "Členové a přihlášky",
                text: "Spravujte členství, přihlášky, skupiny a Discord role.",
            },
            {
                title: "Ligy a soutěže",
                text: "Sledujte zápasy Wardogs League a spravujte týmy i přihlášky do soutěží.",
            },
            {
                title: "Podklady a taktické plány",
                text: "Pokyny, mapy a plány družstev patří přímo k příslušné akci.",
            },
            {
                title: "Tickety a žádosti",
                text: "Vyřizujte dotazy hráčů a žádosti o podporu přes Discord tickety.",
            },
            {
                title: "Váš web a nástroje",
                text: "Propojte web přes API, webhooky a volitelné SSO.",
            },
            {
                title: "Články a oznámení",
                text: "Zveřejňujte klanové novinky, návody, pravidla a podklady pro členy.",
            },
        ],
        guide: "Prozkoumat wiki",
    },
    ownership: {
        eyebrow: "OTEVŘENÝ KÓD",
        title: "Používejte. Hostujte. Pomozte s vývojem.",
        description:
            "Logi má licenci MIT. Můžete používat hostovanou aplikaci nebo provozovat dashboard, Convex a Discord bota sami. Hlášení chyb, nápady i příspěvky do kódu jsou vítané.",
        source: "Zdrojový kód",
        contribute: "Jak přispět",
        host: "Vlastní hosting",
    },
    faq: {
        title: "Co vás možná ještě zajímá.",
        items: [
            {
                question: "Musí všichni hráči používat dashboard?",
                answer: "Hráči se mohou přihlašovat a odpovídat na připomínky účasti na Discordu. Dashboard slouží organizátorům k plánování akcí, sestavování soupisek a správě klanu.",
            },
            {
                question: "Můžeme si nechat vlastní Discord skupiny a kanály?",
                answer: "Ano. Logi nastavíte podle kanálů, rolí a skupin vašeho serveru. Průvodce popisuje oprávnění a propojení, která bot potřebuje.",
            },
            {
                question: "Jaké hry Logi podporuje?",
                answer: "Logi má herní funkce pro Hell Let Loose a Wardogs i prostory pro další hry. Dostupné mapy, statistiky a integrace závisejí na vybrané hře.",
            },
            {
                question: "Kolik to stojí a můžeme Logi hostovat sami?",
                answer: "Celá aplikace i všechny její funkce jsou zdarma. Kód má licenci MIT. Návod k vlastnímu provozu pokrývá dashboard, Convex i Discord bota; infrastrukturu a Discord aplikaci si zajistíte sami.",
            },
        ],
    },
    comms: {
        title: "Potřebujete také hlasové nástroje pro družstvo?",
        description:
            "LogiComms je doplňková aplikace pro Windows pro komunikaci družstva. Je dostupná samostatně vedle klanového dashboardu.",
        download: "Stáhnout LogiComms",
    },
    closing: {
        title: "Zorganizujte svůj příští zápas.",
        description:
            "Začněte přihlášením přes Discord. Průvodce nastavením vás provede dalšími kroky.",
        action: "Otevřít Logi",
    },
}

export const deLanding: LandingMessages = {
    metaTitle: "Logi — Events, Aufstellungen und Discord für deinen Clan",
    metaDescription:
        "Plane Matches und Trainings, sammle Anmeldungen in Discord, veröffentliche Aufstellungen und verfolge die Entwicklung deines Teams. Open-Source-Clanverwaltung mit Logi.",
    nav: {
        workflow: "So funktioniert’s",
        setup: "Erste Schritte",
        features: "Mehr in Logi",
        source: "GitHub",
    },
    hero: {
        title: "Das ultimative Tool",
        accent: "für deinen Clan.",
        description:
            "Du organisierst in Logi. Deine Spieler antworten in Discord.",
        primary: "Mit Discord starten",
        secondary: "So funktioniert’s",
        proof: ["Open Source", "Alle Funktionen kostenlos", "Selbst hostbar"],
    },
    screens: {
        overview: "Das Dashboard deines Clans",
        event: "Matcheditor mit Discord-Vorschau",
        roster: "Eine veröffentlichte Squad-Aufstellung",
        performance: "Clanleistung über die letzten Matches",
        calendar: "Der Community-Kalender",
        zoom: "Screenshot vergrößern",
        caption:
            "Echte Ansichten aus der Valkyria-Community. Screenshots sind auf Englisch; Logi unterstützt Deutsch, Englisch und Tschechisch.",
        close: "Screenshot schließen",
    },
    setup: {
        eyebrow: "EINFACH STARTEN",
        title: "Einmal einrichten. Jede Woche nutzen.",
        description:
            "Anmelden, Clan hinzufügen und den Bot verbinden. Wähle die Kanäle, Gruppen und Rollen, die euer Clan braucht.",
        steps: [
            {
                title: "Mit Discord anmelden",
                text: "Nutze deinen bestehenden Account und öffne den Arbeitsbereich deines Clans.",
            },
            {
                title: "Server verbinden",
                text: "Lade den Bot ein, erteile Berechtigungen und wähle die Kanäle für Events und Aufstellungen.",
            },
            {
                title: "Clan einrichten",
                text: "Wähle eure Spiele, erstelle Spielergruppen und konfiguriere Discord-Rollen und Anmeldeberechtigungen.",
            },
        ],
        guide: "Einrichtungsanleitung lesen",
    },
    workflow: {
        eyebrow: "VOM GEPLANTEN MATCH ZUM SPIELBEREITEN TEAM",
        title: "Von den Eventdetails zur veröffentlichten Aufstellung.",
        description:
            "Das nutzt du jede Woche: Event erstellen, Antworten sammeln und die Aufstellung veröffentlichen.",
        steps: [
            {
                short: "Planen",
                title: "Die Details mühelos eintragen.",
                text: "Wähle Spiel, Teams, Karte und Zeiten.",
                bullets: [
                    "Mit einer Eventvorlage starten",
                    "Treffpunkt und Anmeldeschluss festlegen",
                    "Die Ankündigung vorab prüfen",
                ],
            },
            {
                short: "Anmeldungen",
                title: "Spieler antworten in Discord.",
                text: "Logi veröffentlicht die Ankündigung. Spieler wählen eine Gruppe oder sagen ab.",
                bullets: [
                    "Gruppenauswahl und Kapazitätsgrenzen",
                    "Anmelden, ohne das Dashboard zu öffnen",
                    "Erinnerungen für Spieler ohne Antwort",
                ],
            },
            {
                short: "Aufstellung veröffentlichen",
                title: "Aufstellungen ganz einfach verwalten.",
                text: "Ziehe Spieler in Squads, weise Rollen zu und veröffentliche die Aufstellung mit wenigen Klicks auf Discord.",
                bullets: [
                    "Wiederverwendbare Squad-Vorlagen",
                    "Spieler in ihre Plätze ziehen",
                    "Teilnahmebestätigungen und Erinnerungen",
                ],
            },
        ],
        example: "Discord-Vorschau · fiktive Spieler und fiktives Match",
        channel: "match-anmeldungen",
    },
    roster: {
        eyebrow: "WENN SICH DIE AUFSTELLUNG ÄNDERT",
        title: "Aufstellung und Benachrichtigungen automatisch aktualisieren.",
        description:
            "Veröffentliche deine Änderungen und Logi aktualisiert die Aufstellung auf Discord. Bei aktivierten Änderungsbenachrichtigungen erhalten betroffene Spieler automatisch ihren neuen Squad und ihre Rolle per DM.",
        points: [
            "Squads, Rollen und Reserven auf einem Board",
            "Spieler können ihre veröffentlichten Plätze in Discord prüfen",
            "Verfügbarkeit, Bestätigung und Anwesenheit haben eigene Zustände",
        ],
        guide: "So funktionieren Aufstellungen",
    },
    discord: {
        eyebrow: "FÜR DIE SPIELER",
        title: "Die Informationen erreichen dein Team.",
        description:
            "Ankündigungen, Anmeldungen und Teilnahmeerinnerungen stehen auf Discord.",
        labels: ["Die Ankündigung", "Die Erinnerung für einen Spieler"],
        note: "Mit Logis echtem Discord-Nachrichtensimulator dargestellt. Beispieldaten; es werden keine Nachrichten gesendet.",
    },
    performance: {
        eyebrow: "NACH DEM MATCH",
        title: "Sehen, wie sich das Team entwickelt.",
        description:
            "Ergebnisse prüfen, aufgezeichnete Spiele ansehen und Leistungen über mehrere Matches vergleichen.",
        points: [
            "Matchhistorie und Spielerstatistiken",
            "Leistungsdiagramme über die letzten Spiele",
            "Spielspezifische Daten",
        ],
        guide: "Matchhistorie entdecken",
    },
    explore: {
        eyebrow: "RUND UM DIE MATCHES",
        title: "Auch der Rest der Clanverwaltung.",
        description: "Nutze die Bereiche, die eure Community braucht.",
        cards: [
            {
                title: "Trainings & Kalender",
                text: "Plane wiederkehrende Trainings und halte Matches und Community-Termine in einem Kalender zusammen.",
            },
            {
                title: "Mitglieder & Bewerbungen",
                text: "Verwalte Mitgliedschaften, Bewerbungen, Gruppen und Discord-Rollen.",
            },
            {
                title: "Ligen & Wettbewerbe",
                text: "Verfolge Wardogs-League-Termine und verwalte Teams und Wettbewerbsanmeldungen.",
            },
            {
                title: "Briefings & taktische Pläne",
                text: "Anweisungen, Karten und Squad-Pläne bleiben beim zugehörigen Event.",
            },
            {
                title: "Tickets & Anfragen",
                text: "Bearbeite Spielerfragen und Supportanfragen über Discord-Tickets.",
            },
            {
                title: "Deine Website & Tools",
                text: "Verbinde deine Website über API, Webhooks und optionales SSO mit Logi.",
            },
            {
                title: "Artikel & Ankündigungen",
                text: "Veröffentliche Clan-Neuigkeiten, Anleitungen, Regeln und Briefings für deine Mitglieder.",
            },
        ],
        guide: "Wiki entdecken",
    },
    ownership: {
        eyebrow: "OPEN SOURCE",
        title: "Nutzen. Hosten. Mitentwickeln.",
        description:
            "Logi steht unter der MIT-Lizenz. Nutze die gehostete App oder betreibe Dashboard, Convex und Discord-Bot selbst. Fehlermeldungen, Ideen und Codebeiträge sind willkommen.",
        source: "Quellcode ansehen",
        contribute: "Zum Beitragsleitfaden",
        host: "Anleitung zum Selbsthosten",
    },
    faq: {
        title: "Was du vielleicht noch wissen möchtest.",
        items: [
            {
                question: "Müssen alle Spieler das Dashboard nutzen?",
                answer: "Spieler können sich in Discord anmelden und auf Teilnahmeerinnerungen antworten. Organisatoren nutzen das Dashboard für Events, Aufstellungen und Clanverwaltung.",
            },
            {
                question:
                    "Können wir unsere Discord-Gruppen und Kanäle behalten?",
                answer: "Ja. Richte Logi nach den Kanälen, Rollen und Gruppen eures Servers ein. Die Anleitung erklärt, welche Berechtigungen und Verbindungen der Bot braucht.",
            },
            {
                question: "Welche Spiele unterstützt Logi?",
                answer: "Logi bietet spielspezifische Abläufe für Hell Let Loose und Wardogs sowie Arbeitsbereiche für weitere Spiele. Karten, Statistiken und Integrationen hängen vom gewählten Spiel ab.",
            },
            {
                question: "Was kostet es, und können wir selbst hosten?",
                answer: "Die gesamte App und alle Funktionen sind kostenlos. Der Quellcode steht unter MIT-Lizenz. Die Hosting-Anleitung deckt Dashboard, Convex und Discord-Bot ab; Infrastruktur und Discord-Anwendung stellst du selbst bereit.",
            },
        ],
    },
    comms: {
        title: "Auch Sprachwerkzeuge für den Squad gesucht?",
        description:
            "LogiComms ist eine ergänzende Windows-App für die Squad-Kommunikation. Sie ist separat vom Clan-Dashboard verfügbar.",
        download: "LogiComms herunterladen",
    },
    closing: {
        title: "Organisiere dein nächstes Match.",
        description:
            "Starte mit deinem Discord-Account. Die Einrichtungsanleitung führt dich durch die nächsten Schritte.",
        action: "Logi öffnen",
    },
}
