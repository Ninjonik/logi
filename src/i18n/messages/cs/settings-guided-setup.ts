export const settingsHub_guidedSetup = {
    metaTitle: "Průvodce nastavením",
    workspace: "Nastavení prostoru",
    exit: "Ukončit průvodce",
    progressLabel: "Postup průvodce",
    stepsLabel: "Kroky průvodce",
    reopenHint: "Hotový krok můžete kdykoli otevřít znovu.",
    required: "Povinné",
    optional: "Volitelné",
    optionalSuffix: "volitelné",
    stepOf: "Krok {number} ze {total}",
    doneMark: "Hotovo",
    back: "Zpět",
    skip: "Přeskočit",
    continue: "Pokračovat",
    finish: "Dokončit",
    saving: "Ukládám…",
    saveError: "Uložení se nepovedlo. Zkuste to znovu.",
    discordUnavailable:
        "Logi teď nemůže načíst kanály a role z Discordu. Zkontrolujte bota v kroku 1.",
    steps: {
        bot: {
            heading: "Pozvěte bota Logi na Discord",
            description:
                "Bot ohlašuje akce, zakládá kanály čet a hlídá role. Musí být na serveru vašeho klanu.",
            ready: "Bot je na serveru a vidí kanály i role.",
            checking: "Bot je na serveru. Ověřuji, co vidí…",
            blind: "Bot je na serveru, ale nevidí kanály ani role. Na Discordu mu dejte oprávnění Zobrazit kanály a Spravovat role.",
            missing: "Bot zatím není na serveru vašeho klanu.",
            invite: "Pozvat bota",
            checkAgain: "Zkontrolovat znovu",
        },
        games: {
            heading: "Které hry váš klan hraje?",
            description: "Vyberte hry, které váš klan hraje.",
            groupLabel: "Hry klanu",
            required: "Vyberte alespoň jednu hru.",
        },
        profile: {
            heading: "Představte klan",
            description:
                "Název a logo se ukážou na webu Logi a ve zprávách bota.",
            name: "Název klanu",
            namePlaceholder: "Název klanu",
            logo: "Logo",
            logoAlt: "Logo klanu",
            upload: "Nahrát logo",
            uploading: "Nahrávám…",
            formats: "PNG nebo JPG",
            about: "Popis",
            aboutPlaceholder: "Pár vět o klanu",
            nameRequired: "Vyplňte název klanu.",
            logoRequired: "Nahrajte logo klanu.",
        },
        channels: {
            heading: "Kam má bot psát?",
            description:
                "Vyberte kanály na svém Discordu. Pro jednotlivé hry je později můžete nastavit jinak.",
            announcements: "Oznámení",
            announcementsHelp: "Nové akce a změny soupisek.",
            eventResults: "Výsledky akcí",
            eventResultsHelp:
                "Potvrzená skóre zápasů a odkazy na statistiky. Volitelné; společné pro hry.",
            eventInfo: "Informace o akci",
            eventInfoHelp: "Podrobnosti a přihlášky k akci.",
            errors: "Chyby bota",
            errorsHelp: "Jen pro správce, když se něco nepovede.",
            choose: "Vyberte kanál",
            none: "Žádný",
        },
        roles: {
            heading: "Kdo patří do klanu a kdo ho spravuje?",
            description:
                "Podle rolí na Discordu Logi pozná členy klanu a správce.",
            clanRole: "Klanová role",
            clanRoleHelp:
                "Kdo má tuto roli, je člen klanu. Vytvořte roli v nastavení Discord serveru → Role a znovu načtěte Logi.",
            adminRole: "Role správců Logi",
            adminRoleHelp:
                "Lidé s touto rolí uvidí Nastavení a mohou ho měnit.",
            choose: "Vyberte roli",
            none: "Žádná role",
            noResults: "Žádná role nenalezena.",
        },
        gameServers: {
            heading: "Připojte herní server",
            description:
                "Logi může z vašeho CRCON nebo Warcon serveru sbírat výsledky a statistiky hráčů. API klíč se uloží šifrovaně a už ho nikdo neuvidí.",
            empty: "Zatím žádný server. Připojení zabere asi minutu: adresa, ID serveru a API klíč.",
            connect: "Připojit server",
        },
    },
    finished: {
        title: "Průvodce nastavením dokončen.",
        description:
            "Zkontrolujte seznam v Nastavení. Nedokončené povinné kroky jsou uvedené níže.",
        openSettings: "Otevřít Nastavení",
        again: "Projít znovu",
    },
} as const
