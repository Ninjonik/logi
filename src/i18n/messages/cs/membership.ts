export const membershipMessages = {
    ticketSettings: {
        questionsTitle: "Otázky ve formuláři",
        questionsCount: "{count} z {max}",
        edit: "Upravit",
        doneEditing: "Hotovo",
        removeQuestion: "Odebrat otázku",
        requiredShort: "povinná",
        optionalShort: "nepovinná",
        untitledQuestion: "Otázka bez názvu",
        noQuestionsShort: "Bez otázek: vlákno se otevře hned po kliknutí.",
        enabledLabel: "Zapnuto",
        enabledAria: "Tickety zapnuté",
        flowLabel: "Jak ticket probíhá",
        flow: {
            pick: "Člen klikne na kategorii v panelu",
            form: "Vyplní krátký formulář",
            thread: "Vznikne soukromé vlákno s podporou",
            close: "Podpora ho zavře a autor dostane DM",
        },
        panelSection: "Panel",
        panelChannel: "Kanál s panelem",
        threadChannel: "Kde vznikají vlákna",
        threadChannelHint: "Bot tu musí moct zakládat soukromá vlákna.",
        threadChannelOk: "Bot tu může zakládat soukromá vlákna",
        categoriesShort: "Kategorie",
        categoriesEditorNote: "Každá kategorie je jedno tlačítko v panelu.",
        headingLabel: "Nadpis",
        textLabel: "Text",
        imageOptional: "volitelné",
        previewTitle: "Náhled v Discordu",
        panelColor: "Barva panelu",
        panelColorHint: "Prázdné = barva klanu. Hex, např. #E8A33D.",
        panelColorInvalid: "Barva musí být hex, např. #E8A33D.",
        threadTitle: "Nadpis karty ve vlákně",
        threadTitlePlaceholder: "{author} nahlašuje hráče",
        threadTitleHint:
            "{author} je jméno autora, {category} název kategorie. Prázdné pole napíše „{author} · {category}“.",
        columns: {
            button: "Tlačítko",
            handledBy: "Kdo odpovídá",
            questions: "Otázky",
            actions: "Akce",
        },
        nobodyAdmins: "nikdo, jen správci Logi",
        removeCategory: "Odebrat kategorii",
        untitledCategory: "Kategorie bez názvu",
        noCategoriesDescription:
            "Každá kategorie je jedno tlačítko v panelu, třeba Nahlásit hráče nebo Problém s botem.",
        saveNote: "Uloží nastavení tiketů.",
        saveAndRefresh: "Uložit a obnovit panel",
        discard: "Zahodit",
        unsaved: "Neuložené změny",
        title: "Nastavení ticketů",
        pageDescription:
            "Nastavte ticket panel, kategorie, role podpory a modal otázky pro Discord tickety.",
        enableTitle: "Zapnout ticket systém",
        enableDescription:
            "Zveřejní konfigurovatelný ticket panel na Discordu a bude otevírat soukromé ticket thready z jeho kategorií.",
        submitChannel: "Kanál pro ticket panel",
        parentChannel: "Rodičovský kanál ticket threadů",
        panelTitle: "Nadpis panel embedu",
        panelDescription: "Popis panel embedu",
        panelDescriptionPlaceholder:
            "Vysvětlete, jak mají členové tento ticket panel používat.",
        image: "Náhledový obrázek",
        embedLimitNotice: "Text panelu v Discordu právě používá",
        embedLimitExceeded:
            "(příliš dlouhé, před uložením zkraťte některé popisy kategorií).",
        categoriesTitle: "Kategorie ticketů",
        categoriesDescription:
            "Každá kategorie se stane tlačítkem a volitelně může nejdřív otevřít Discord modal, než se vytvoří ticket thread.",
        addCategory: "Přidat kategorii",
        categoryLabel: "Kategorie",
        buttonText: "Text tlačítka",
        buttonTextPlaceholder: "Nahlásit hráče",
        emoji: "Emoji",
        pickServerEmoji: "Vyberte server emoji",
        typeAnyEmoji: "nebo napište libovolné emoji",
        categoryDescription: "Popis",
        categoryDescriptionPlaceholder:
            "Zobrazí se v panelu za názvem kategorie, třeba „chování na serveru“.",
        supportRoles: "Role podpory pozvané do ticketu",
        modalQuestions: "Modal otázky",
        modalQuestionsDescription:
            "Discord podporuje až 5 textových vstupů v jednom modalu.",
        addQuestion: "Přidat otázku",
        questionLabel: "Otázka",
        questionText: "Text otázky",
        questionTextPlaceholder: "Co se stalo?",
        inputStyle: "Styl vstupu",
        shortInput: "Krátký",
        paragraphInput: "Odstavec",
        placeholder: "Placeholder",
        required: "Povinné",
        noQuestions:
            "Zatím tu nejsou žádné modal otázky. Když to necháte prázdné, kliknutí na tlačítko vytvoří ticket hned.",
        noCategories: "Zatím tu nejsou žádné ticket kategorie.",
        defaultPanelTitle: "Potřebuješ pomoc?",
        defaultPanelDescription:
            "Vyber, s čím potřebuješ pomoct. Otevře se soukromé vlákno, které vidíš jen ty a správci.",
        incompleteTitle: "Nastavení ticket panelu není kompletní",
        incompleteDescription:
            "Ticket systém je zapnutý, ale Discord ticket panel se nezveřejní a ticket thready nepůjde otevírat, dokud nedokončíte: {items}.",
        routingInfoTitle: "Jak funguje ticket routing",
        routingInfoDescription:
            "Support role z kategorií se do nových ticket threadů přidávají automaticky. Dashboard administrátoři mohou tickety spravovat, ale nepřidávají se do každého threadu.",
    },
    memberRoleOperations: {
        unlinkedTarget: "Logi ID (Discord není propojen)",
        title: "Změny členských rolí",
        refresh: "Obnovit",
        loading: "Načítání…",
        description:
            "Posledních 100 operací správce nebo přihlášek napříč hrami. Uložení člena zařadí změnu do fronty; stav Provedeno vyžaduje ověření na Discordu. Zamítnuté, nahrazené a neúspěšné operace se mažou 30 dní po svém skončení.",
        error: "Přehled změn rolí není dostupný. Zkuste jej obnovit.",
        empty: "Zatím nejsou žádné změny spravovaných rolí.",
        target: "Discord ID člena",
        actor: "Discord ID zadavatele",
        origin: "Zdroj",
        version: "Verze",
        updated: "Aktualizace",
        audit: "Historie pokusů",
        auditDescription:
            "Zobrazeno posledních 5 pokusů; uchovává se nejvýše 20 na operaci. Denní kontrola, která role potvrdí, pokus nepřidává. Časy jsou v UTC. Kódy důvodů pomáhají při řešení chyb.",
        reason: "Důvod",
        status: {
            pending: "Čeká",
            running: "Probíhá",
            retry_scheduled: "Čeká na opakování",
            applied: "Provedeno",
            denied: "Zamítnuto",
            superseded: "Nahrazeno",
            failed: "Selhalo",
        },
        provenance: {
            dashboard: "Správce",
            recruitment: "Náborový tým",
            application: "Přihláška člena",
            rollback: "Vrácení přihlášky",
        },
        hint: {
            pending: "Bot před změnou rolí ověří oprávnění.",
            running: "Bot kontroluje Discord a zpracovává aktuální požadavek.",
            retry_scheduled:
                "Bot požadavek automaticky zopakuje po uplynutí čekací doby.",
            applied:
                "Při poslední kontrole role na Discordu odpovídaly požadavku. Bot je kontroluje jednou denně.",
            denied: "Ověřte přístup zadavatele, členství, oprávnění bota a pořadí rolí, poté uložte nový požadavek na člena.",
            superseded:
                "Přiřazení nebo pravidla se změnila. Nový stav vyžaduje nový oprávněný požadavek.",
            failed: "Automatické pokusy skončily. Odstraňte příčinu a uložte nový požadavek na člena.",
        },
    },
    membershipSettings: {
        clanRoleMissingChip: "klanová role chybí",
        applicationsTitle: "Žádosti o vstup",
        applicationsChannel: "Tlačítko Přihlásit se v kanálu #{channel}",
        applicationsNoChannel:
            "Kanál s panelem vyberte v záložce Panel a vlákna.",
        roleSyncToggleTitle: "Synchronizace rolí",
        roleSyncToggleDescription:
            "Logi přidává a bere role podle stavu člena. Zapíná a vypíná se spolu se žádostmi o vstup.",
        roleSyncOn: "Zapnuto",
        roleSyncOff: "Vypnuto",
        roleSyncSwitchDescription:
            "Logi přidává a bere role podle stavu člena. Funguje i tehdy, když jsou žádosti o vstup vypnuté.",
        skipPendingCategoryTitle:
            "Přeskočit čekání a přidat rovnou jako rekruta",
        skipPendingCategoryHelp: "Jen u hlavních členů.",
        categoryDescriptionHelp:
            "V panelu je za názvem a hrou, v okně 1 pod názvem kategorie.",
        addRole: "role",
        addRoleAria: "Přidat roli: {status}",
        removeRole: "Odebrat roli {role}",
        roleSearch: "Hledat roli",
        roleEmpty: "Žádná další role.",
        tabsLabel: "Části členství",
        tabs: {
            categories: "Kategorie",
            panel: "Panel a vlákna",
            scores: "Body za docházku",
            roleChanges: "Změny rolí",
        },
        categoryButtonTitle: "V panelu a v okně 1",
        categoryText: "Název",
        categoryDescriptionLabel: "Popis",
        resultTitle: "Po přijetí se z hráče stane",
        rolesByStatus: "Role podle stavu",
        statusPending: "Čeká na rozhodnutí",
        statusRecruit: "Rekrut",
        noRoles: "bez rolí",
        includeClanRoleTitle: "Přidat klanovou roli",
        includeClanRoleRecruitHelp:
            "Přidá klanovou roli, když je tato kategorie rekrut.",
        includeClanRoleFinalHelp:
            "Přidá klanovou roli po schválení této kategorie, včetně žoldáků.",
        handledBy: "Kdo žádosti vyřizuje",
        handledByAdmins: "a správci Logi",
        clanRoleNote:
            "{role} je klanová role z Role a přístup. Níže ji nastavíte zvlášť pro každou kategorii a stav.",
        clanRoleMissingNote:
            "Klanová role zatím není nastavená. Vyberte ji v Role a přístup; platí pro všechny kategorie.",
        clanRoleLink: "Otevřít Role a přístup",
        missingFinalRole: "chybí konečná role",
        missingRecruitRole: "chybí role rekruta",
        removeCategory: "Odebrat kategorii",
        noCategoriesDescription:
            "Každá kategorie je jedna možnost v přihlášce, třeba hlavní člen, záloha nebo žoldák.",
        rolePlaceholder: "Přidat roli",
        saveNote: "Uloží nastavení členství.",
        discard: "Zahodit",
        saveShort: "Uložit",
        unsaved: "Neuložené změny",
        title: "Nastavení členství",
        pageDescription:
            "Nastavte Discord application embed, povinné kategorie přihlášek a výchozí chování zařazení nových členů klanu.",
        enableTitle: "Zapnout členské přihlášky",
        enableDescription:
            "Zveřejní klanový application embed na Discordu a z něj bude otevírat soukromé thready spravované staffem.",
        submitChannel: "Kanál pro embed",
        parentChannel: "Rodičovský kanál application threadů",
        skipPendingTitle: "Přeskočit pending fázi",
        skipPendingDescription:
            "Nové členské přihlášky začnou po odeslání rovnou jako recruitti.",
        inviteSupportMembersIndividuallyTitle:
            "Přidávat členy support rolí jednotlivě",
        inviteSupportMembersIndividuallyDescription:
            "Zapnuto: Logi do vlákna každé přihlášky přidá jednoho po druhém všechny, kdo mají role podpory dané kategorie. Vypnuto: Logi je nepřidává a do vlákna se dostanou jen přes označení rolí podpory; Discord tak přidá jen členy rolí, které mají méně než 100 lidí. Správci Logi mohou přihlášky vyřizovat v Logi, i když ve vlákně nejsou.",
        panelTitle: "Nadpis panelu",
        panelDescription: "Popis panelu",
        welcomeMessage: "Uvítací zpráva v application threadu",
        welcomeMessageDescription:
            "Zobrazí se nad shrnutím přihlášky v každém soukromém threadu. Použijte {applicant}, {support_roles} a {category} pro živé Discord zmínky a vybranou kategorii.",
        welcomeMessagePlaceholder:
            "Ahoj {applicant}, děkujeme za přihlášku. {support_roles} se ti brzy ozvou.",
        image: "Náhledový obrázek",
        applicationThumbnail: "Náhled přihlášky",
        specializationTitle: "Ptát se na specializaci",
        specializationDescription:
            "V Discord průvodci zobrazí krok Pěchota a Tank. Pro Wardogs se tento krok nikdy nezobrazí.",
        categoryGame: "Hra",
        categoryDetails: "Detaily kategorie",
        categoryRoles: "Role a přístup",
        categoryRolesDescription:
            "Vyberte role, které Logi spravuje po schválení, a staff, který má přístup do vlákna přihlášky.",
        categoriesTitle: "Kategorie přihlášek",
        categoriesDescription:
            "Každá kategorie se stane tlačítkem. Modal otázky jsou volitelné a používají stejný vzor jako tickety.",
        addCategory: "Přidat kategorii",
        buttonLabel: "Text tlačítka",
        applicationResult: "Výsledek přihlášky",
        recruitRole: "Recruit role pro tuto kategorii",
        recruitRolePlaceholder: "Recruit role",
        finalRole: "Finální role pro tuto kategorii",
        finalRolePlaceholder: "Finální role",
        modalQuestionsDescription: "Až 5 textových polí.",
        noQuestions:
            "Zatím tu nejsou žádné modal otázky. Nechte to prázdné, pokud má kategorie otevřít thread hned po prechecku.",
        noCategories: "Zatím tu nejsou žádné kategorie přihlášek.",
        embedFieldUsage: "Využití embed fieldu: {length} / {max}",
        embedFieldTooLong:
            "(příliš dlouhé, před uložením zkraťte popisy kategorií)",
        incompleteTitle: "Nastavení membership panelu není kompletní",
        incompleteDescription:
            "Přihlášky jsou zapnuté, ale Discord membership panel se nezveřejní a application thready nepůjde otevírat, dokud nenastavíte: {items}.",
        roleSyncTitle: "Jak funguje synchronizace membership rolí",
        roleSyncDescription:
            "Pending přihlášky nepřidělují membership role. Status recruit používá klanovou roli plus recruit roli kategorie a active status používá klanovou roli plus finální roli kategorie, pokud jsou tyto role nastavené. Změny členských rolí se zpracovávají ve frontě; výsledek ověřte v nastavení členství v přehledu změn rolí.",
        rosterScoreDescription:
            "Nastavte změny skóre pro tento server po ukončení akce. Pokud vše necháte na 0, automatické skórování bude vypnuté.",
        rosterScoreNoCategory: "Mimo všechny kategorie / bez reakce",
        rosterScorePresentRoster: "Zareagoval a byl přítomen v soupisce",
        rosterScorePresentReserve: "Zareagoval a byl přítomen v rezervách",
        rosterScoreAbsentRoster: "Zareagoval a chyběl v soupisce",
        rosterScoreAbsentReserve: "Zareagoval a chyběl v rezervách",
        rosterScoreExcusedAbsence: "Zareagoval, chyběl, ale měl notice",
        rolesMissingTitle: "Některé membership role nejsou nastavené",
        rolesMissingClanRole: "Základní klanová role není nastavená. ",
        rolesMissingRecruitRole: "Chybí role rekruta: {categories}. ",
        rolesMissingFinalRole: "Chybí konečná role: {categories}. ",
        rolesMissingSummary:
            "V takových případech bude Logi stav přihlášky dál sledovat, ale změny Discord rolí budou částečné nebo se přeskočí.",
        save: "Uložit nastavení členství",
        saved: "Nastavení členství bylo uloženo.",
        saveError: "Nastavení členství se nepodařilo uložit.",
    },
    userManagement: {
        previousPage: "Předchozí",
        nextPage: "Další",
        canAddMemberOrMercenary:
            "Lze přidat jako člena, člena v záloze nebo žoldáka.",
        mercenaryOnly:
            "Už patří do jiného klanu; lze přidat pouze jako žoldáka.",
        missingPlayerLink:
            "Chybí hráč? Požádejte ho, aby na Discordu použil /link a zaregistroval se v Logi. Již přiřazení hráči se nezobrazují.",
        missingPlayerApplication: "Může také podat přihlášku do klanu.",

        grantAdminAccess: "Nastavit jako admina",
        removeAdminAccess: "Odebrat přístup admina",
        adminAccessGranted: "Hráč je nyní admin.",
        adminAccessRemoved: "Přístup admina byl hráči odebrán.",
        recheckDisplayName: "Znovu ověřit zobrazované jméno",
        recheckingDisplayName: "Ověřování jména…",
        displayNameUpdated: "Zobrazované jméno bylo aktualizováno.",
        displayNameUnchanged: "Zobrazované jméno je aktuální.",
        displayNameRecheckFailed:
            "Jméno se nepodařilo ověřit. Zkontrolujte, že je hráč na Discord serveru a bot k němu má přístup.",
        adminAccessUpdateFailed: "Přístup admina se nepodařilo změnit.",
        title: "Hráči",
        description: "Spravujte členy klanu a žoldáky.",
        addMember: "Přidat jako člena",
        addReserveMember: "Přidat jako rezervního člena",
        addMerc: "Přidat jako žoldáka",
        removeMember: "Odebrat člena",
        removeMerc: "Odebrat žoldáka",
        memberLabel: "Člen",
        reserveMemberLabel: "Rezervní člen",
        mercLabel: "Žoldák",
        eligibleMembers: "Způsobilí pro kmenové členství",
        eligibleMercs: "Způsobilí pro žoldáctví",
        blocked: "Nezpůsobilý",
        searchPlaceholder:
            "Jméno na Discordu, přezdívka na serveru nebo Discord ID",
        noResults: "V systému nebyli nalezeni žádní odpovídající hráči.",
        rulesTitle: "Pravidla přiřazení",
        rulesMember:
            "Hráč se může stát kmenovým členem pouze tehdy, pokud již nepatří do jiného hlavního klanu.",
        rulesMerc:
            "Hráč může působit jako žoldák v jiných klanech, ale nemůže být v jednom klanu členem i žoldákem zároveň.",
        rulesSystem: "Hledání najde hráče s existujícím účtem Logi.",
        tablePlayer: "Hráč",
        tableType: "Typ",
        tableGroup: "Skupina",
        tableStatus: "Status",
        tableScore: "Skóre",
        platformId: "Platform ID",
        playerNote: "Poznámka k hráči",
        platformNotConnected: "Platform ID není nastaveno",
        platformConnectedAs: "Platform ID nastaveno jako {platformId}",
        platformIdNoSpaces: "Platform ID nesmí obsahovat mezery.",
        platformAlreadyLinked:
            "Toto platform ID už je propojené s jiným hráčem.",
        paused: "Pozastaveno",
        active: "Aktivní",
        membershipStatus: "Status členství",
        pendingLabel: "Čeká",
        recruitLabel: "Rekrut",
        addPlayer: "Přidat hráče",
        autoLinkPlatformIds: "Auto-propojit Platform ID",
        autoLinkPlatformIdsDescription:
            "Projde importované scoreboardy akcí, odebere clan tag ze jmen hráčů a automaticky doplní odpovídající platform ID.",
        autoLinkPlatformIdsHint:
            "Zadejte clan tag přesně tak, jak se objevuje před jmény hráčů v importovaných akcích. Příklad: VLKㆍ",
        autoLinkPlatformIdsSuccess:
            "Propojeno {linked} platform ID z {players} nalezených hráčských záznamů.",
        autoLinkPlatformIdsPartial:
            "Část výsledků byla přeskočena: {ambiguous} nejednoznačných, {conflicts} konfliktů, {failed} selhaných akcí.",
        dedupePlayerStats: "Vyčistit duplicity statistik",
        dedupePlayerStatsDescription:
            "Odstraní duplicitní importované řádky zápasů pro akce tohoto klanu a pokud to jde, ponechá lepší kopii místo varianty Unknown.",
        dedupePlayerStatsHint:
            "Toto čistí jen importované player stats pro akce tohoto klanu. Zápasy jiných klanů tím neovlivníte.",
        dedupePlayerStatsSuccess:
            "Odstraněno {matches} duplicitních řádků zápasů napříč {users} hráči.",
        refreshPerformanceHistory: "Obnovit statistiky klanu a hráčů",
        refreshPerformanceHistorySuccess:
            "Statistiky klanu a hráčů byly obnoveny.",
        refreshPerformanceHistoryError:
            "Statistiky klanu a hráčů se nepodařilo obnovit.",
        mergeUsers: "Sloučit účty",
        mergeUsersDescription:
            "Úplně sloučí dva účty. Primární účet má přednost všude tam, kde se data obou účtů překrývají.",
        mergeUsersPrimary: "Primární účet",
        mergeUsersSecondary: "Sekundární účet",
        mergeUsersPickPrimary: "Vyberte účet, který zůstane",
        mergeUsersPickSecondary: "Vyberte účet, který se do něj sloučí",
        mergeUsersHint:
            "Přepíše player stats, importované zápasy, přiřazení, soupisky a vložené odkazy v akcích na primární účet.",
        mergeUsersConfirm: "Sloučit účty",
        mergeUsersSuccess: "Účty sloučeny.",
        clanTag: "Clan tag",
        clanTagPlaceholder: "VLKㆍ",
        importDiscordMembers: "Importovat Discord členy",
        importDiscordMembersDescription:
            "Naimportujte všechny, kdo mají vybranou Discord roli, do správy hráčů.",
        importDiscordMembersHint:
            "Importovaní hráči nedostanou hlavní skupinu. Odpovídající Discord role skupin se přidají jako vedlejší skupiny.",
        membershipMigration: "Migrovat členství podle role",
        membershipMigrationDescription:
            "Vyberte Discord roli a cílový stav členství, na který se mají převést existující přiřazení v tomto klanu.",
        membershipMigrationTarget: "Cílový stav členství",
        membershipMigrationHint:
            "Aktualizují se jen hráči, kteří už mají v tomto klanu přiřazení. Nepřiřazení Discord členové se přeskočí.",
        membershipMigrationSuccess:
            "Aktualizováno {updated} hráčů na stav {status}.",
        membershipMigrationSkippedUnassigned:
            "Přeskočeno {count} Discord členů bez klanového přiřazení.",
        membershipMigrationSkippedUnchanged:
            "Přeskočeno {count} hráčů, kteří už tento stav měli.",
        discordSourceRole: "Zdrojová Discord role",
        discordImportSuccess:
            "Naimportováno {players} hráčů z {matched} odpovídajících Discord členů.",
        discordImportSkipped:
            "{count} odpovídajících Discord členů bylo přeskočeno, protože je nebylo možné importovat s vybraným typem zařazení.",
        editAssignment: "Upravit zařazení",
        playerSearch: "Hledat hráče",
        assignmentType: "Typ zařazení",
        primaryGroup: "Hlavní skupina",
        secondaryGroups: "Vedlejší skupiny",
        noGroup: "Bez hlavní skupiny",
        noSecondaryGroups: "Bez vedlejších skupin",
        pauseMembership: "Pozastavit členství",
        pauseHelp: "Použijte v případě neaktivity nebo dočasné nepřítomnosti.",
        pauseNote: "Poznámka k pozastavení",
        pauseNoteRequired: "Při pozastavení členství přidejte poznámku.",
        pickPlayerFirst:
            "Nejprve vyberte hráče ze seznamu vyhledávání v systému.",
        currentAssignment: "Aktuální zařazení",
        mainClan: "Hlavní klan",
        none: "Žádné",
        assignmentDescription:
            "Upravte typ zařazení, skupinu, stav pozastavení členství nebo odeberte hráče z tohoto klanu.",
        assignmentMetaDescription:
            "Úprava klanového členství, role žoldáka, skupiny a stavu pozastavení.",
        assignmentTitleSuffix: "zařazení",
        averageDescription: "Průměr za posledních {count} zápasů.",
        storedAverageDescription: "Průměr napříč {count} importovanými zápasy.",
        averageKills: "Prům. killy",
        averageKd: "Prům. K/D",
        averageDeaths: "Prům. smrtí",
        averageOffense: "Prům. offense",
        averageDefense: "Prům. defense",
        averageSupport: "Prům. support",
        matchKills: "Zabití",
        matchKd: "K/D",
        matchDeaths: "Smrti",
        matchOffense: "Offense",
        matchDefense: "Defense",
        matchSupport: "Support",
        matchHistorySearch: "Hledat v historii zápasů...",
        matchHistoryEvent: "Akce",
        matchHistoryPlayedAt: "Odehráno",
        removePlayerFromClan: "Odebrat hráče z tohoto klanu.",
        removePlayerConfirm:
            "Odebrat tohoto hráče z klanu? Tímto smažete jeho přiřazení.",
        saveError: "Nepodařilo se uložit přiřazení hráče.",
        deleteError: "Nepodařilo se smazat přiřazení hráče.",
        assignmentSaved: "Přiřazení hráče bylo uloženo.",
        assignmentCreated: "Přiřazení hráče bylo vytvořeno.",
        assignmentDeleted: "Přiřazení hráče bylo smazáno.",
        primaryGroupRequired: "Před uložením vyberte hlavní skupinu.",
        alreadyAssigned: "Tento hráč už je v tomto klanu přiřazen.",
        mercenaryRecruitStatusError: "Žoldáci nemohou používat recruit status.",
        reserveMemberRecruitStatusError:
            "Rezervní členové nemohou používat recruit status.",
        roleSyncTitle: "Jak funguje synchronizace membership rolí",
        roleSyncDescription:
            "Discord role navázané na skupiny se synchronizují podle vybrané hlavní a vedlejší skupiny. Membership role se synchronizují jen pro členy mimo pending stav a recruit nebo active status závisí na klanové roli plus rolích navázaných na membership kategorii, pokud jsou dostupné. Změny členských rolí se zpracovávají ve frontě; výsledek ověřte v nastavení členství v přehledu změn rolí.",
        missingClanRoleTitle: "Klanová role není nastavená",
        missingClanRoleDescription:
            "Hráč může být v Logi i tak označen jako recruit nebo active, ale dokud se v nastavení klanu nenastaví klanová role, nepřidá se mu na Discordu základní klanová role.",
        missingMembershipCategoryTitle:
            "Toto přiřazení není propojené s membership kategorií",
        missingMembershipCategoryDescription:
            "Recruit a finální role kategorie nejdou u ručních přiřazení synchronizovat bez propojené kategorie z membership přihlášky. Na Discordu se tak mohou aplikovat jen klanová role a role navázané na skupiny.",
        missingCategoryRolesTitle: "Role membership kategorie nejsou kompletní",
        missingRecruitRoleDescription:
            "Tato kategorie nemá nastavenou recruit roli. ",
        missingFinalRoleDescription:
            "Tato kategorie nemá nastavenou finální roli. ",
        missingCategoryRolesSummary:
            "Logi bude membership status držet tady, ale odpovídající Discord role se pro tuto fázi nepřidá.",
        linkMissingDiscordIds: "Doplnit chybějící Discord ID",
        linkMissingDiscordIdsDescription:
            "Spárujte importované hráče bez Discord ID s členy z vybrané Discord role.",
        linkMissingDiscordIdsHint:
            "Jména se před porovnáním normalizují a propojí se první odpovídající Discord člen.",
        linkMissingDiscordIdsSuccess:
            "Propojeno {linked} importovaných hráčů z {scanned} kandidátů.",
        linkMissingDiscordIdsMerged:
            "{count} importovaných hráčských záznamů bylo sloučeno s existujícími Discord účty.",
        platformIdsHint:
            "Více ID oddělte čárkou. Steam ID má 17 číslic a začíná 7656119; ID z Xboxu a PlayStationu pište jako xbox:… nebo psn:….",
        platformIdsInvalid: "Před uložením opravte označená ID platforem.",
        platformIssues: {
            steam_format:
                "Není to Steam ID: musí mít 17 číslic a začínat 7656119.",
            epic_format: "Není to ID Epic Games.",
            too_long: "Na ID platformy je to příliš dlouhé.",
            duplicate: "Uvedeno dvakrát; uloží se jednou.",
            linked_elsewhere: "Už je propojené s hráčem {name}.",
        },
        grantAdminTitle: "Udělat z hráče {name} správce?",
        grantAdminDescription:
            "{name} pak bude moct v dashboardu Logi měnit nastavení klanu, zápasy, soupisky a členy. Přístup můžete později odebrat.",
        removeAdminTitle: "Odebrat hráči {name} správcovský přístup?",
        removeAdminDescription:
            "{name} zůstane v klanu, ale v dashboardu ho už nebude moct spravovat, pokud mu přístup nedává role na Discordu.",
        removePlayerTitle: "Odebrat hráče {name} z klanu?",
        removePlayerDescription:
            "Smaže se jeho zařazení, skupiny i stav členství v tomto klanu a Logi mu odebere role na Discordu, které spravuje. Historie zápasů zůstane.",
    },
} as const
