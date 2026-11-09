export const integrationsMessages = {
    membershipIntegration: {
        title: "Integrace členství Discordu",
        description:
            "Vyberte, které role Discordu smí jednotlivé integrace číst. Přístup vyžaduje také klíč pouze pro čtení s oprávněním ke členství Discordu. O využití těchto údajů rozhoduje web.",
        enabled: "Povolit tomuto klíči ověřování členství",
        roles: "Povolené role",
        rolesHelp:
            "Bez rolí web uvidí jen přítomnost a zařazení v Logi. Změny použijete uložením.",
        empty: "Vytvořte API klíč pouze pro čtení s oprávněním ke členství Discordu a obnovte seznam.",
        loading: "Načítání…",
        refresh: "Obnovit",
        saving: "Ukládání…",
        save: "Uložit pravidla",
        saved: "Pravidla přístupu ke členství byla uložena.",
        error: "Pravidla členství nelze načíst nebo uložit. Obnovte seznam a zkuste to znovu.",
        invalid: "Použijte platná ID rolí Discordu, nejvýše 100 rolí na hru.",
    },
    websiteEventPolicies: {
        title: "Příkazy webu pro události",
        description:
            "Umožněte připojenému webu vytvářet, upravovat nebo rušit události přes jeho servisní klíč. Pravidlo spojuje jednu registrovanou aplikaci jednotného přihlášení s jedním omezeným API klíčem a pro každou hru uvádí role Discordu, jejichž členové smí příkazy používat.",
        application: "Aplikace jednotného přihlášení",
        applicationPlaceholder: "Vyberte aplikaci",
        noApplications:
            "Nejdřív zaregistrujte aplikaci jednotného přihlášení. Pravidlo váže příkazy webu na tuto aplikaci.",
        noKeys: "Vytvořte omezený API klíč pro backend webu a obnovte seznam. Starší neomezené klíče pravidlo pro příkazy nést nemohou.",
        enabled: "Povolit tomuto klíči příkazy pro události",
        roles: "Povolené role",
        rolesHelp:
            "Hra bez rolí zůstává jen pro čtení. Uložení zapnutého pravidla udělí zápis příkazů pro hry s rolemi; vypnutí oprávnění odebere.",
        granted: "Zápis udělen pro: {games}",
        notGranted: "Zápis příkazů pro události není udělen.",
        loading: "Načítání…",
        refresh: "Obnovit",
        saving: "Ukládání…",
        save: "Uložit pravidlo",
        saved: "Pravidlo příkazů pro události bylo uloženo.",
        error: "Pravidlo příkazů pro události nelze načíst nebo uložit. Obnovte seznam a zkuste to znovu.",
        denied: "Pravidlo bylo odmítnuto. Použijte platný omezený klíč tohoto pracovního prostoru a aplikaci v něm registrovanou.",
        invalid:
            "Použijte platná ID rolí Discordu, nejvýše 64 na hru, pro hry zapnuté v tomto pracovním prostoru.",
    },
    apiKeys: {
        revokeTitle: "Zrušit klíč {name}?",
        groupsLegend: "Oblasti",
        groups: {
            matches: {
                label: "Zápasy",
                short: "zápasy",
                help: "Akce, zápasy, jejich souhrny a taktické mapy.",
            },
            rosters: {
                label: "Soupisky",
                short: "soupisky",
                help: "Soupisky, čety a zařazení hráčů.",
            },
            results: {
                label: "Výsledky",
                short: "výsledky",
                help: "Potvrzené výsledky, statistiky hráčů a historie her.",
            },
            members: {
                label: "Členové",
                short: "členové",
                help: "Členové klanu a jejich stav. Čtení členství má navíc vlastní pravidla.",
            },
            servers: {
                label: "Herní servery",
                short: "servery",
                help: "Živý stav serverů, Warcon, HLL a zdraví připojení.",
            },
            league: {
                label: "Liga a týmy",
                short: "liga",
                help: "Zápasy Wardogs League a katalog týmů.",
            },
        },
        partialGroup: "{group} (část)",
        readOnlyShort: "jen čtení",
        everyGame: "všechny hry",
        createdOn: "vytvořen {date}",
        revokeDescription:
            "Vše, co klíč používá, třeba váš web, hned přestane dostávat data z Logi. Nejde to vrátit; přístup obnoví jen nový klíč.",
        revokeConfirm: "Zrušit klíč",
        emptyTitle: "Zatím žádný API klíč",
        emptyDescription:
            "Vytvořte klíč pro server svého webu. Vyberte jen data a hry, které potřebuje.",
        description:
            "Vytvořte klíč pro integraci a uchovávejte ho na svém serveru. Vyberte jen potřebná data a hry.",
        name: "Název klíče",
        namePlaceholder: "Název webu, např. hlavní web",
        access: "Oprávnění",
        readOnly: "Pouze pro čtení",
        fullAccess: "Plný přístup (původní režim)",
        readOnlyHelp:
            "Může číst pouze vybrané zdroje a hry. Nemůže vytvářet, měnit ani mazat data.",
        fullAccessHelp:
            "Může číst a měnit všechna klanová data napříč hrami. Použijte jen pro integrace, které potřebují zápis.",
        resources: "Zdroje dat",
        games: "Hry",
        selectScope: "Vyberte alespoň jeden zdroj dat a jednu hru.",
        privateData:
            "Úplné záznamy mohou obsahovat neveřejné provozní údaje. Před zveřejněním data zkontrolujte.",
        createReadOnly: "Vytvořit klíč pro čtení",
        createFullAccess: "Vytvořit klíč s plným přístupem",
        copyNow:
            "Nyní klíč zkopírujte. Znovu ho nelze zobrazit. Uchovávejte ho na svém serveru.",
        copy: "Zkopírovat API klíč",
        copied: "API klíč zkopírován.",
        copyFailed:
            "Klíč se nepodařilo zkopírovat. Před skrytím ho zkopírujte ručně.",
        hide: "Skrýt klíč",
        createFailed:
            "Klíč se nepodařilo vytvořit. Zkontrolujte výběr a zkuste to znovu.",
        invalidKey: "Server vrátil neplatný API klíč.",
        revoke: "Zneplatnit",
        revokeFailed: "Klíč se nepodařilo zneplatnit. Zkuste to znovu.",
        revoked: "zneplatněný",
        created: "vytvořeno",
        existingKeys: "Existující klíče",
        rotateHelp:
            "Oprávnění změníte vytvořením nového klíče. Přepojte na něj integraci a pak zneplatněte starý klíč.",
        allGames: "všechny hry; čtení i zápis",
        loading: "Načítání klíčů…",
        loadFailed:
            "Seznam klíčů se nepodařilo obnovit. Zobrazená oprávnění nemusí být aktuální.",
        retry: "Zkusit znovu",
        empty: "Zatím nebyly vytvořeny žádné API klíče.",
        invalidPolicy: "Nerozpoznaná omezení; backend přístup zamítne.",
        resourceLabels: {
            "server-game-history":
                "Historie serverových her (jména hráčů a Steam ID)",
            "league-matches": "Veřejné zápasy Wardogs League",
            "league-fixtures": "Sledované zápasy Wardogs League",
            "hll-live": "Živý HLL scoreboard (včetně jmen hráčů a platform ID)",
            "warcon-data": "Herní data Warconu (včetně jmen hráčů a Steam ID)",
            "member-summaries": "Seznam členů (pouze čtení)",
            "roster-summaries": "Publikované sestavy a účast (pouze čtení)",
            "player-stat-summaries":
                "Ověřené statistiky hráčů ze serverových kol",
            "membership-summaries":
                "Členství Discordu (vyžaduje samostatná pravidla)",
            "server-snapshots": "Stav herních serverů",
            "integration-health": "Stav sběru dat",
            "event-summaries": "Souhrny událostí",
            "match-summaries": "Souhrny zápasů",
            "result-summaries": "Souhrny posouzených výsledků",
            events: "Události (úplné záznamy)",
            matches: "Zápasy (surové statistiky)",
            groups: "Skupiny",
            rosters: "Soupisky",
            assignments: "Zařazení členů",
            stratmaps: "Taktické mapy",
            teams: "Adresář týmů (aktivní týmy, názvy a loga)",
        },
    },
    verifiedPlatformLinks: {
        title: "Ověřený účet Steam",
        description:
            "Vlastnictví účtu ověříte přihlášením na Steamu. ID ručně zadaná do profilu nejsou ověřená.",
        loading: "Načítání…",
        refresh: "Obnovit",
        error: "Propojení se Steamem není dostupné. Obnovte přehled nebo to zkuste za chvíli.",
        callbackFailed:
            "Ověření přes Steam se nepodařilo dokončit. Zahajte nový pokus.",
        verified: "Ověřeno přes Steam",
        empty: "Žádný ověřený účet Steam",
        verifiedAt: "Ověřeno",
        revokedAt: "Odpojeno",
        link: "Ověřit přes Steam",
        unlink: "Odpojit Steam",
        history: "Poslední změny propojení",
        effect: "Odpojení zastaví budoucí přiřazování hráče. Ověření nepřidává role na Discordu, nepotvrzuje vlastnictví hry ani nezveřejňuje profil na webu.",
    },
    integrationSettings: {
        cancel: "Zpět",
        web: {
            stepKey: "API klíč pro web",
            stepLogin: "Přihlášení přes Logi",
            stepMembers: "Co smí web dělat za členy",
            newKey: "Nový klíč",
            closeForm: "Zavřít",
            keyShownOnce:
                "Klíč se ukáže jen jednou, hned po vytvoření. Uložte ho na server svého webu.",
            loginPage: "Přihlašovací stránka klanu",
            ssoApps: "Aplikace pro jednotné přihlášení",
            addApplication: "Přidat aplikaci",
            membersRowHelp: "Přes klíč {key}. Člen musí mít jednu z rolí.",
            saveRoles: "Uložit role",
            membersTitle: "Zjistit, kdo je člen",
            membersHelp:
                "Přes klíč jen pro čtení s přístupem k členství v Discordu. Web uvidí jen členy s jednou z vybraných rolí.",
            eventsTitle: "Zakládat a upravovat akce",
            eventsHelp:
                "Přes aplikaci pro jednotné přihlášení a její klíč. Jen lidé s jednou z vybraných rolí.",
            footer: "Klíče a aplikace se ukládají hned. Role se uloží tlačítkem u každého klíče.",
            rolesPlaceholder: "Vyberte role",
            rolesUnavailable:
                "Role z Discordu se nenačetly. Zkuste stránku obnovit.",
        },
        sso: {
            emptyTitle: "Zatím žádná přihlašovací aplikace",
            emptyDescription:
                "Přidejte svůj web jako aplikaci a členové se na něj budou moct přihlásit účtem Discordu přes Logi.",
            redirects: "Adresy pro návrat po přihlášení: {count}",
            clientId: "Client ID",
            edit: "Upravit",
            save: "Uložit změny",
            saved: "Aplikace uložena.",
            removeTitle: "Odebrat {name}?",
            removeDescription:
                "Členové se na {website} přes Logi už nepřihlásí. Client ID a tajný klíč aplikace přestanou platit a zastaví se i akce, které přes ni web zakládá. Nejde to vrátit.",
            removeConfirm: "Odebrat aplikaci",
        },
        webhooks: {
            emptyTitle: "Zatím žádný webhook",
            emptyDescription:
                "Zadejte HTTPS adresu a Logi na ni bude posílat změny akcí, soupisek, článků a nastavení, podepsané tajným klíčem.",
            deleteTitle: "Smazat tento webhook?",
            deleteDescription:
                "Logi hned přestane posílat změny na {url} a jeho podpisový klíč přestane platit. Nejde to vrátit.",
            deleteConfirm: "Smazat webhook",
            loadFailed:
                "Webhooky se nenačetly. Obnovte stránku a zkuste to znovu.",
            createFailed:
                "Webhook se nepovedlo vytvořit. Zkontrolujte adresu a zkuste to znovu.",
            actionFailed: "Změna se neuložila. Zkuste to znovu.",
            rotateFailed: "Podpisový klíč se nepovedlo vyměnit.",
            historyFailed: "Historie doručení se nenačetla.",
        },
        calendar: {
            emptyTitle: "Zatím žádný odkaz na kalendář",
            emptyDescription:
                "Vytvořte soukromý odkaz a přidejte ho do Kalendáře Google nebo jiné aplikace. Kdo má odkaz, uvidí akce klanu.",
            rotateTitle: "Vytvořit nový odkaz na kalendář?",
            rotateDescription:
                "Současný odkaz přestane fungovat. Každý, kdo ho odebírá, si musí přidat nový odkaz.",
            rotateConfirm: "Vytvořit nový odkaz",
        },
        league: {
            title: "Sledování Wardogs League",
            cadence:
                "Nové zápasy kontrolujeme po {scan} minutách, sledované detaily po {refresh} minutách. Web i Discord používají stejný záznam.",
            enable: "Sledovat Wardogs League a odkazy na zápasy",
            teamCodes: "Kódy sledovaných týmů (oddělené čárkou)",
            scanEvery: "Hledat nové zápasy každých",
            refreshEvery: "Obnovovat sledované detaily každých",
            minutes: "{minutes} minut",
            scanNote:
                "Společné procházení seznamu běží v nejkratším intervalu, který si některý zapnutý klan přeje; tento klan převezme nový seznam až po uplynutí vlastního intervalu. Omezení zdroje může intervaly prodloužit.",
            intakeChannel: "Kanál, kam lidé posílají odkazy",
            intakePlaceholder: "Vyberte kanál pro odkazy",
            panelsNote:
                "Tabulku a nejbližší zápasy celé ligy posílá do Discordu panel WD League v Nastavení → Panely v Discordu. Karty jednotlivých zápasů se už neposílají. Když sledování vypnete, bot zprávy panelu smaže.",
            intakeNote:
                "Zprávy botů ignorujeme. Automatické čtení zpráv lidí musí provozovatel bota zapnout (Message Content). Procházení seznamu a ruční přidání fungují i bez toho.",
            save: "Uložit nastavení",
            saved: "Uloženo.",
            saveFailed:
                "Uložení selhalo. Ověřte oprávnění, odkaz a nastavení kanálů.",
            loadFailed: "Nastavení sledování se nenačetlo.",
            lastScan: "Poslední úspěšné procházení",
            nextScan: "Další procházení",
            incomplete: "Seznam není úplný; chybějící zápas přidejte ručně.",
            queueFull:
                "Fronta automaticky nalezených zápasů je plná. Existující zápasy se dál obnovují; zbývající místa jsou vyhrazená ručnímu přidání.",
            sourceError:
                "Zdroj je nedostupný. Zachováváme poslední platná data.",
            addByUrl: "Přidat zápas podle odkazu z League",
            preview: "Načíst náhled",
            previewFailed: "Náhled není dostupný. Zkontrolujte odkaz.",
            track: "Přidat do sledování",
            createNative: "Založit vlastní zápas v Logim",
            states: {
                pending: "Čeká na načtení",
                tracked: "Sledováno",
                paused: "Pozastaveno",
                ignored: "Ignorováno",
                archived: "Archiv",
                unmatched: "Mimo filtr",
            },
            refreshOnce: "Znovu načíst",
            resume: "Obnovit",
            pause: "Pozastavit",
            ignore: "Ignorovat",
            staleData: "Starší data, naposledy načteno {time}",
            linkedEvent: "Zápas v Logim k tomuto utkání",
            notLinked: "Nepropojeno",
            unknownEvent: "Propojený zápas, který už v seznamu není",
            noEvents:
                "V Logim zatím není žádný zápas Wardogs. Založte ho a pak ho tu propojte.",
            saveLink: "Uložit propojení",
            emptyTitle: "Zatím žádný sledovaný zápas",
            emptyDescription:
                "Zápasy sledovaných týmů se tu objeví po dalším procházení. Zápas můžete přidat i odkazem výše.",
        },
    },
} as const
