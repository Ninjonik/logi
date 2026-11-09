export const membershipMessages = {
    ticketSettings: {
        questionsTitle: "Pytania w formularzu",
        questionsCount: "{count} z {max}",
        edit: "Edytuj",
        doneEditing: "Gotowe",
        removeQuestion: "Usuń pytanie",
        requiredShort: "wymagany",
        optionalShort: "opcjonalnie",
        untitledQuestion: "Pytanie bez tytułu",
        noQuestionsShort:
            "Żadnych pytań: wątek otwiera się zaraz po kliknięciu.",
        enabledLabel: "Włączone",
        enabledAria: "Zgłoszenia włączone",
        flowLabel: "Jak działa zgłoszenie",
        flow: {
            pick: "Członek wybiera kategorię w panelu",
            form: "Wypełnia krótki formularz",
            thread: "Otworzy się prywatny wątek ze wsparciem",
            close: "Wsparcie zamyka to, a autor otrzymuje wiadomość prywatną",
        },
        panelSection: "Panel",
        panelChannel: "Kanał z panelem",
        threadChannel: "Gdzie otwierają się wątki",
        threadChannelHint:
            "Bot musi mieć tutaj możliwość tworzenia prywatnych wątków.",
        threadChannelOk: "Bot może tutaj otwierać prywatne wątki",
        categoriesShort: "Kategorie",
        categoriesEditorNote: "Każda kategoria to jeden przycisk w panelu.",
        headingLabel: "Nagłówek",
        textLabel: "Tekst",
        imageOptional: "opcjonalnie",
        previewTitle: "Podgląd w Discord",
        panelColor: "Kolor panelu",
        panelColorHint: "Pusty = kolor klanu. Szesnastkowy, np. #E8A33D.",
        panelColorInvalid: "Kolor musi być szesnastkowy, np. #E8A33D.",
        threadTitle: "Tytuł karty wątku",
        threadTitlePlaceholder: "{author} zgłasza gracza",
        threadTitleHint:
            "{author} to nazwisko autora, {category} to kategoria. Pusty tekst brzmi „{author} · {category}”.",
        columns: {
            button: "Przycisk",
            handledBy: "Kto odpowiada",
            questions: "Pytania",
            actions: "Działania",
        },
        nobodyAdmins: "nikt, tylko administratorzy Logi",
        removeCategory: "Usuń kategorię",
        untitledCategory: "Kategoria bez tytułu",
        noCategoriesDescription:
            "Każda kategoria staje się przyciskiem w panelu, np. Zgłoś problem z graczem lub botem.",
        saveNote: "Zapisuje ustawienia zgłoszenia.",
        saveAndRefresh: "Zapisz i zaktualizuj panel",
        discard: "Odrzuć zmiany",
        unsaved: "Niezapisane zmiany",
        title: "Ustawienia zgłoszeń",
        pageDescription:
            "Skonfiguruj panel zgłoszeń, kategorie, role personelu i pytania modalne dla zgłoszeń Discord.",
        enableTitle: "Włącz system zgłoszeń",
        enableDescription:
            "Opublikuj konfigurowalny panel zgłoszeń w Discord i otwieraj prywatne wątki zgłoszeń za pomocą przycisków kategorii.",
        submitChannel: "Kanał panelu zgłoszeń",
        parentChannel: "Kanał nadrzędny wątku dotyczącego zgłoszeń",
        panelTitle: "Tytuł osadzenia panelu",
        panelDescription: "Opis osadzania panelu",
        panelDescriptionPlaceholder:
            "Wyjaśnij, w jaki sposób członkowie powinni korzystać z tego panelu zgłoszeń.",
        image: "Miniatura obrazu",
        embedLimitNotice: "Aktualnie używany jest tekst panelu w Discord",
        embedLimitExceeded:
            "(zbyt długie, przytnij niektóre opisy kategorii przed zapisaniem).",
        categoriesTitle: "Kategorie zgłoszeń",
        categoriesDescription:
            "Każda kategoria staje się przyciskiem i opcjonalnie może otworzyć moduł Discord przed utworzeniem wątku zgłoszenia.",
        addCategory: "Dodaj kategorię",
        categoryLabel: "Kategoria",
        buttonText: "Tekst przycisku",
        buttonTextPlaceholder: "Zgłoś gracza",
        emoji: "Emoji",
        pickServerEmoji: "Wybierz emoji serwera",
        typeAnyEmoji: "lub wpisz dowolny emoji",
        categoryDescription: "Opis",
        categoryDescriptionPlaceholder:
            "Wyświetlana w panelu po nazwie kategorii, np. „zachowanie na serwerze”.",
        supportRoles: "Role wsparcia zaproszone do tego zgłoszenia",
        modalQuestions: "Pytania w formularzu",
        modalQuestionsDescription:
            "Discord obsługuje do 5 wejść tekstowych na moduł.",
        addQuestion: "Dodaj pytanie",
        questionLabel: "Pytanie",
        questionText: "Etykieta pytania",
        questionTextPlaceholder: "Co się stało?",
        inputStyle: "Styl wprowadzania",
        shortInput: "Krótki",
        paragraphInput: "Długi tekst",
        placeholder: "Podpowiedź w polu",
        required: "Wymagane",
        noQuestions:
            "Nie ma jeszcze pytań modalnych. Jeśli pozostawisz to pole puste, kliknięcie przycisku spowoduje natychmiastowe utworzenie zgłoszenia.",
        noCategories: "Nie ma jeszcze kategorii zgłoszeń.",
        defaultPanelTitle: "Potrzebujesz pomocy?",
        defaultPanelDescription:
            "Wybierz, w czym potrzebujesz pomocy. Otworzy się prywatny wątek, który będziesz widzieć tylko Ty i administratorzy.",
        incompleteTitle: "Konfiguracja panelu zgłoszeń jest niekompletna",
        incompleteDescription:
            "System zgłoszeń jest włączony, ale panel zgłoszeń Discord nie zostanie opublikowany, a wątki zgłoszeń nie będą mogły się otworzyć, dopóki nie zakończysz: {items}.",
        routingInfoTitle: "Jak działa routing zgłoszeń",
        routingInfoDescription:
            "Role obsługi kategorii są automatycznie zapraszane do nowych wątków zgłoszeń. Administratorzy panelu mogą zarządzać zgłoszeniami, ale nie są dodawani do każdego wątku.",
    },
    memberRoleOperations: {
        unlinkedTarget: "Identyfikator Logi (Discord niepowiązany)",
        title: "Operacje roli członkostwa",
        refresh: "Odśwież",
        loading: "Wczytywanie…",
        description:
            "Najnowsze 100 operacji związanych z personelem lub aplikacjami w grach. Zapisanie zmiany w kolejce członka; tylko zweryfikowany wynik Discord jest oznaczony jako zastosowany. Operacje odrzucone, zastąpione i zakończone niepowodzeniem są usuwane po 30 dniach od ich zakończenia.",
        error: "Operacje na rolach są niedostępne. Odśwież, aby spróbować ponownie.",
        empty: "Nie ma jeszcze żadnych zarządzanych operacji na rolach.",
        target: "Identyfikator członka Discord",
        actor: "Identyfikator aktora Discord",
        origin: "Źródło",
        version: "Wersja",
        updated: "Zaktualizowano",
        audit: "Historia prób",
        auditDescription:
            "Pokazano 5 ostatnich prób; do 20 zachowywanych na operację. Codzienna kontrola potwierdzająca role nie powoduje żadnych prób. Czasy podano w formacie UTC. Kody przyczyn pomagają diagnozować awarie.",
        reason: "Powód",
        status: {
            pending: "Oczekuje",
            running: "W toku",
            retry_scheduled: "Zaplanowano ponowną próbę",
            applied: "Zastosowano",
            denied: "Odmowa",
            superseded: "Zastąpione",
            failed: "Niepowodzenie",
        },
        provenance: {
            dashboard: "Administrator",
            recruitment: "Rekruterzy",
            application: "Zgłoszenie rekrutacyjne",
            rollback: "Cofnięcie zgłoszenia",
        },
        hint: {
            pending: "Bot sprawdzi uprawnienia przed zmianą ról.",
            running: "Bot sprawdza Discord i stosuje bieżące żądanie.",
            retry_scheduled:
                "Bot spróbuje automatycznie ponowić próbę po upływie okresu oczekiwania.",
            applied:
                "Role Discord pasowały do ​​tego żądania podczas ostatniego sprawdzania. Bot sprawdza ponownie raz dziennie.",
            denied: "Sprawdź dostęp personelu, członkostwo, uprawnienia botów i hierarchię ról, a następnie zapisz prośbę o nowego członka.",
            superseded:
                "Zmieniło się zadanie lub zasady. Tylko nowe autoryzowane żądanie może zastosować zaktualizowany stan.",
            failed: "Automatyczne ponowne próby zatrzymane. Rozwiąż przyczynę i zapisz nową prośbę o członkostwo.",
        },
    },
    membershipSettings: {
        clanRoleMissingChip: "rola klanu nie została ustawiona",
        applicationsTitle: "Zgłoszenia do klanu",
        applicationsChannel: "Przycisk Zastosuj w #{channel}",
        applicationsNoChannel: "Wybierz kanał panelu w obszarze Panel i wątki.",
        roleSyncToggleTitle: "Synchronizacja ról",
        roleSyncToggleDescription:
            "Logi dodaje i usuwa role według statusu członka. Jest włączany i wyłączany wraz z prośbami o dołączenie.",
        roleSyncOn: "Włączone",
        roleSyncOff: "Wyłączony",
        roleSyncSwitchDescription:
            "Logi dodaje i usuwa role według statusu członka. Działa także przy wyłączonych zgłoszeniach.",
        skipPendingCategoryTitle: "Pomiń czekanie i dodaj od razu jako rekrut",
        skipPendingCategoryHelp: "Tylko główni członkowie.",
        categoryDescriptionHelp:
            "W panelu następuje nazwa i gra; w oknie 1 znajduje się pod nazwą kategorii.",
        addRole: "rola",
        addRoleAria: "Dodaj rolę: {status}",
        removeRole: "Usuń rolę {role}",
        roleSearch: "Szukaj ról",
        roleEmpty: "Żadnej innej roli.",
        tabsLabel: "Sekcje członkowskie",
        tabs: {
            categories: "Kategorie",
            panel: "Panel i wątki",
            scores: "Punkty obecności",
            roleChanges: "Zmiany ról",
        },
        categoryButtonTitle: "W panelu i oknie 1",
        categoryText: "Nazwa",
        categoryDescriptionLabel: "Opis",
        resultTitle: "Po zatwierdzeniu gracz zostaje",
        rolesByStatus: "Role według statusu",
        statusPending: "Oczekiwanie na decyzję",
        statusRecruit: "Rekrut",
        noRoles: "żadnych ról",
        includeClanRoleTitle: "Nadaj rolę klanu",
        includeClanRoleRecruitHelp:
            "Przyznaj rolę klanu, gdy ta kategoria jest rekrutem.",
        includeClanRoleFinalHelp:
            "Przyznaj rolę klanu po zatwierdzeniu tej kategorii, w tym najemników.",
        handledBy: "Kto obsługuje wnioski",
        handledByAdmins: "i administratorzy Logi",
        clanRoleNote:
            "{role} to rola klanu z poziomu Role i dostęp. Skonfiguruj go osobno dla każdej kategorii i statusu poniżej.",
        clanRoleMissingNote:
            "Rola klanu nie jest jeszcze ustalona. Wybierz to w Rolach i uzyskaj dostęp; dotyczy to każdej kategorii.",
        clanRoleLink: "Otwórz role i dostęp",
        missingFinalRole: "brakuje ostatniej roli",
        missingRecruitRole: "brak roli rekruta",
        removeCategory: "Usuń kategorię",
        noCategoriesDescription:
            "Każda kategoria to jedna opcja w zgłoszenia, na przykład członek główny, rezerwowy lub najemnik.",
        rolePlaceholder: "Dodaj rolę",
        saveNote: "Zapisuje ustawienia członkostwa.",
        discard: "Odrzuć zmiany",
        saveShort: "Zapisz",
        unsaved: "Niezapisane zmiany",
        title: "Ustawienia członkostwa",
        pageDescription:
            "Skonfiguruj osadzanie aplikacji Discord, wymagane kategorie aplikacji i domyślne zachowanie przydziału dla nowych członków klanu.",
        enableTitle: "Włącz zgłoszenia członkowskie",
        enableDescription:
            "Opublikuj panel rekrutacji na Discordzie. Zgłoszenia będą tworzyć prywatne wątki dla rekruterów.",
        submitChannel: "Kanał panelu rekrutacji",
        parentChannel: "Kanał nadrzędny wątków rekrutacyjnych",
        skipPendingTitle: "Pomiń oczekującą fazę",
        skipPendingDescription:
            "Zgłoszenia nowych członków rozpoczynają się jako rekruci natychmiast po złożeniu.",
        inviteSupportMembersIndividuallyTitle:
            "Dodaj członków roli pomocniczej indywidualnie",
        inviteSupportMembersIndividuallyDescription:
            "Wł.: Logi dodaje kolejno wszystkie osoby posiadające role pomocy technicznej w danej kategorii do wątku każdej aplikacji. Wyłączone: Logi ich nie dodaje i dostają się do wątku tylko wtedy, gdy jest tam wspomniana ich rola wspierająca; Discord robi to tylko w przypadku ról mających mniej niż 100 członków. Administratorzy Logi mogą obsługiwać aplikacje w Logi bez konieczności bycia w wątku.",
        panelTitle: "Tytuł panelu",
        panelDescription: "Opis panelu",
        welcomeMessage: "Wiadomość powitalna wątku zgłoszenia",
        welcomeMessageDescription:
            "Opublikowano powyżej podsumowania aplikacji w każdym prywatnym wątku. Użyj {applicant}, {support_roles} i {category}, aby uzyskać aktualne wzmianki o Discord i wybraną kategorię.",
        welcomeMessagePlaceholder:
            "Cześć {applicant}, dziękujemy za złożenie wniosku. {support_roles} będzie wkrótce u Ciebie.",
        image: "Miniatura obrazu",
        applicationThumbnail: "Miniaturka zgłoszenia",
        specializationTitle: "Zapytaj o specjalizację",
        specializationDescription:
            "Pokaż piechotę i zbroję jako krok w kreatorze aplikacji Discord. Wardogs nigdy nie pokazuje tego kroku.",
        categoryGame: "Gra",
        categoryDetails: "Szczegóły kategorii",
        categoryRoles: "Role i uprawnienia",
        categoryRolesDescription:
            "Wybierz role, którymi Logi zarządza po zatwierdzeniu, oraz personel, który może uzyskać dostęp do wątku zgłoszenia.",
        categoriesTitle: "Kategorie zgłoszeń",
        categoriesDescription:
            "Każda kategoria staje się przyciskiem. Pytania modalne są opcjonalne i wykorzystują ten sam wzór co zgłoszenia.",
        addCategory: "Dodaj kategorię",
        buttonLabel: "Etykieta przycisku",
        applicationResult: "Decyzja rekrutacyjna",
        recruitRole: "Rola rekrutacyjna dla tej kategorii",
        recruitRolePlaceholder: "Rola rekruta",
        finalRole: "Ostatnia rola w tej kategorii",
        finalRolePlaceholder: "Ostateczna rola",
        modalQuestionsDescription: "Do 5 pól tekstowych.",
        noQuestions:
            "Nie ma jeszcze pytań modalnych. Pozostaw to pole puste, jeśli kategoria powinna otwierać wątek natychmiast po sprawdzeniu wstępnym.",
        noCategories: "Nie ma jeszcze kategorii zgłoszenia.",
        embedFieldUsage: "Osadź użycie pola: {length} / {max}",
        embedFieldTooLong:
            "(zbyt długie, przytnij opisy kategorii przed zapisaniem)",
        incompleteTitle: "Konfiguracja panelu członkowskiego jest niekompletna",
        incompleteDescription:
            "Aplikacje są włączone, ale panel członkostwa Discord nie zostanie opublikowany, a wątki aplikacji nie będą mogły się otwierać, dopóki nie ustawisz {items}.",
        roleSyncTitle: "Jak działa synchronizacja ról członkostwa",
        roleSyncDescription:
            "Zgłoszenia oczekujące nie przypisują ról członkowskich. Status rekruta wykorzystuje rolę klanu plus rolę rekruta kategorii, a status aktywny wykorzystuje rolę klanu plus rolę końcową kategorii, gdy te role są skonfigurowane. Zmiany członkostwa są umieszczane w kolejce; sprawdź wynik w Ustawieniach członkostwa → Operacje na roli członkostwa.",
        rosterScoreDescription:
            "Ustal zmiany punktacji gracza po zakończeniu wydarzenia. Ustaw wszędzie 0, aby wyłączyć automatyczne zmiany punktów.",
        rosterScoreNoCategory: "Brak kategorii / brak reakcji",
        rosterScorePresentRoster: "Odpowiedział i jest w składzie",
        rosterScorePresentReserve: "Zareagował i obecny w rezerwach",
        rosterScoreAbsentRoster: "Zareagowano i nie było w składzie",
        rosterScoreAbsentReserve: "Zareagował i nieobecny w rezerwach",
        rosterScoreExcusedAbsence: "Zareagował, był nieobecny, ale zauważył",
        rolesMissingTitle: "Niektóre role członkostwa nie są skonfigurowane",
        rolesMissingClanRole: "Podstawowa rola klanu nie jest ustawiona.",
        rolesMissingRecruitRole: "Brak roli rekruta: {categories}.",
        rolesMissingFinalRole: "Brakuje ostatniej roli: {categories}.",
        rolesMissingSummary:
            "W takich przypadkach Logi będzie nadal śledzić stan aplikacji, ale zmiany ról Discord będą częściowe lub pominięte.",
        save: "Zapisz ustawienia członkostwa",
        saved: "Ustawienia członkostwa zostały zapisane.",
        saveError: "Nie można zapisać ustawień członkostwa.",
    },
    userManagement: {
        previousPage: "Poprzednia",
        nextPage: "Następna",
        canAddMemberOrMercenary:
            "Można dodać jako członka, członka rezerwy lub najemnika.",
        mercenaryOnly:
            "Należy już do innego klanu; można dodać wyłącznie jako najemnika.",
        missingPlayerLink:
            "Brakuje gracza? Poproś go o użycie /link na Discordzie, aby zarejestrować się w Logi. Przypisani już gracze są ukryci.",
        missingPlayerApplication:
            "Może również wysłać podanie o członkostwo w klanie.",

        grantAdminAccess: "Zrób administratora",
        removeAdminAccess: "Usuń dostęp administratora",
        adminAccessGranted: "Gracz jest teraz administratorem.",
        adminAccessRemoved: "Usunięto dostęp administratora gracza.",
        recheckDisplayName: "Sprawdź ponownie nazwę wyświetlaną",
        recheckingDisplayName: "Sprawdzam nazwę wyświetlaną…",
        displayNameUpdated: "Wyświetlana nazwa została zaktualizowana.",
        displayNameUnchanged: "Nazwa wyświetlana jest już aktualna.",
        displayNameRecheckFailed:
            "Nie można ponownie sprawdzić nazwy wyświetlanej. Sprawdź, czy gracz znajduje się na serwerze Discord i bot może uzyskać do niego dostęp.",
        adminAccessUpdateFailed:
            "Nie można zaktualizować dostępu administratora gracza.",
        title: "Gracze",
        description: "Zarządzaj członkami klanu i najemnikami.",
        addMember: "Dodaj jako członka",
        addReserveMember: "Dodaj jako członka rezerwowego",
        addMerc: "Dodaj jako najemnik",
        removeMember: "Usuń członka",
        removeMerc: "Usuń najemnika",
        memberLabel: "Główny członek",
        reserveMemberLabel: "Rezerwowy",
        mercLabel: "Najemnik",
        eligibleMembers: "Kwalifikuje się na członka",
        eligibleMercs: "Nadaje się na najemnika",
        blocked: "Nie kwalifikuje się",
        searchPlaceholder:
            "Nazwa Discord, nazwa wyświetlana na serwerze lub Discord ID",
        noResults: "W systemie nie znaleziono pasujących graczy.",
        rulesTitle: "Zasady przydziału",
        rulesMember:
            "Gracz może zostać głównym członkiem tylko wtedy, gdy nie należy już do innego głównego klanu.",
        rulesMerc:
            "Gracz może być najemnikiem innego klanu, ale nie może być jednocześnie członkiem i najemnikiem tego samego klanu.",
        rulesSystem: "Wyszukiwanie znajduje graczy z istniejącym kontem Logi.",
        tablePlayer: "Gracz",
        tableType: "Typ",
        tableGroup: "Grupa",
        tableStatus: "Status",
        tableScore: "Wynik",
        platformId: "Identyfikator platformy",
        playerNote: "Notatka gracza",
        platformNotConnected: "Nie ustawiono identyfikatora platformy",
        platformConnectedAs:
            "Identyfikator platformy ustawiony jako {platformId}",
        platformIdNoSpaces: "Identyfikator platformy nie może zawierać spacji.",
        platformAlreadyLinked:
            "Ten identyfikator platformy jest już powiązany z innym graczem.",
        paused: "Wstrzymano",
        active: "Aktywny",
        membershipStatus: "Stan członkostwa",
        pendingLabel: "Oczekuje",
        recruitLabel: "Rekrut",
        addPlayer: "Dodaj gracza",
        autoLinkPlatformIds: "Automatyczne łączenie identyfikatorów platform",
        autoLinkPlatformIdsDescription:
            "Skanuj zaimportowane tablice wyników wydarzeń, usuń tag klanu z nazw graczy i automatycznie uzupełnij pasujące identyfikatory platform.",
        autoLinkPlatformIdsHint:
            "Wprowadź tag klanu dokładnie tak, jak pojawia się przed nazwami graczy w importowanych wydarzeniach. Przykład: VLKㆍ",
        autoLinkPlatformIdsSuccess:
            "Połączone identyfikatory platform {linked} z {players} pasują do wpisów graczy.",
        autoLinkPlatformIdsPartial:
            "Pominięto niektóre wyniki: {ambiguous} niejednoznaczne, konflikty {conflicts}, zdarzenia zakończone niepowodzeniem {failed}.",
        dedupePlayerStats: "Deduplikuj statystyki graczy",
        dedupePlayerStatsDescription:
            "Usuń zduplikowane zaimportowane wiersze meczów dla wydarzeń tego klanu i zachowaj lepszą, nieznaną kopię, jeśli to możliwe.",
        dedupePlayerStatsHint:
            "Czyści to tylko zaimportowane statystyki graczy dotyczące wydarzeń należących do tego klanu. Nie ma to wpływu na mecze innych klanów.",
        dedupePlayerStatsSuccess:
            "Usunięto zduplikowane wiersze meczów {matches} wśród graczy {users}.",
        refreshPerformanceHistory: "Odśwież statystyki klanu i gracza",
        refreshPerformanceHistorySuccess:
            "Odświeżono statystyki klanu i graczy.",
        refreshPerformanceHistoryError:
            "Nie można odświeżyć statystyk klanu i gracza.",
        mergeUsers: "Połącz użytkowników",
        mergeUsersDescription:
            "Całkowicie scalić dwa konta. Konto główne wygrywa, jeśli oba konta zawierają nakładające się dane.",
        mergeUsersPrimary: "Konto główne",
        mergeUsersSecondary: "Konto dodatkowe",
        mergeUsersPickPrimary: "Wybierz konto, które chcesz zachować",
        mergeUsersPickSecondary: "Wybierz konto, aby się z nim połączyć",
        mergeUsersHint:
            "Spowoduje to przepisanie statystyk graczy, zaimportowanych meczów, przydziałów, składów i osadzonych odniesień do wydarzeń na koncie głównym.",
        mergeUsersConfirm: "Połącz konta",
        mergeUsersSuccess: "Konta zostały połączone.",
        clanTag: "Tag klanu",
        clanTagPlaceholder: "VLKㆍ",
        importDiscordMembers: "Importuj członków Discord",
        importDiscordMembersDescription:
            "Zaimportuj wszystkich, którzy mają wybraną rolę Discord do zarządzania graczami.",
        importDiscordMembersHint:
            "Zaimportowani gracze nie otrzymują grupy podstawowej. Pasujące role grupowe wymagane w Discord są dodawane jako grupy dodatkowe.",
        membershipMigration: "Przenieś członkostwo według roli",
        membershipMigrationDescription:
            "Wybierz rolę Discord i stan członkostwa, na który ma być mapowany dla istniejących przypisań do klanu.",
        membershipMigrationTarget: "Docelowy stan członkostwa",
        membershipMigrationHint:
            "Aktualizowani są tylko gracze już przydzieleni do tego klanu. Nieprzypisani członkowie Discord są pomijani.",
        membershipMigrationSuccess:
            "Zaktualizowano gracz(e) {updated} do wersji {status}.",
        membershipMigrationSkippedUnassigned:
            "Pominięto członków {count} Discord bez przypisania do klanu.",
        membershipMigrationSkippedUnchanged:
            "Pominięto graczy {count} już znajdujących się w tym stanie członkostwa.",
        linkMissingDiscordIds: "Połącz brakujące Discord ID",
        linkMissingDiscordIdsDescription:
            "Dopasuj zaimportowanych graczy bez identyfikatorów Discord do członków wybranej roli Discord.",
        linkMissingDiscordIdsHint:
            "Nazwy są normalizowane przed porównaniem. Łączony jest pierwszy pasujący członek serwera Discord.",
        linkMissingDiscordIdsSuccess:
            "Połączono importowanych graczy {linked} z kandydatów {scanned}.",
        linkMissingDiscordIdsMerged:
            "Połączono zaimportowane rekordy graczy {count} z istniejącymi użytkownikami połączonymi za pomocą Discord.",
        discordSourceRole: "Rola źródłowa Discord",
        discordImportSuccess:
            "Zaimportowano graczy {players} z {matched} pasujących do członków Discord.",
        discordImportSkipped:
            "{count} pasujące elementy Discord zostały pominięte, ponieważ nie można było ich zaimportować z wybranym typem przypisania.",
        editAssignment: "Edytuj przydział",
        playerSearch: "Wyszukiwanie gracza",
        assignmentType: "Typ przydziału",
        primaryGroup: "Grupa podstawowa",
        secondaryGroups: "Grupy dodatkowe",
        noGroup: "Brak grupy podstawowej",
        noSecondaryGroups: "Brak grup drugorzędnych",
        pauseMembership: "Wstrzymaj członkostwo",
        pauseHelp:
            "Użyj tego w przypadku braku aktywności lub tymczasowej nieobecności.",
        pauseNote: "Powód wstrzymania",
        pauseNoteRequired:
            "Dodaj notatkę o wstrzymaniu, gdy członkostwo jest wstrzymane.",
        pickPlayerFirst:
            "Najpierw wybierz gracza z listy wyszukiwania w systemie.",
        currentAssignment: "Obecny przydział",
        mainClan: "Główny klan",
        none: "Brak",
        assignmentDescription:
            "Edytuj typ przydziału, grupę, wstrzymany stan członkostwa lub usuń gracza z tego klanu.",
        assignmentMetaDescription:
            "Edytuj członkostwo w klanie, rolę najemnika, grupę i stan pauzy.",
        assignmentTitleSuffix: "przydział",
        averageDescription: "Średnia z ostatnich meczów {count}.",
        storedAverageDescription: "Średnia dla importowanych meczów {count}.",
        averageKills: "Śr. zabójstwa",
        averageKd: "Średnia K/D",
        averageDeaths: "Średnia liczba zgonów",
        averageOffense: "Śr. punkty ataku",
        averageDefense: "Średnia obrona",
        averageSupport: "Średnie wsparcie",
        matchKills: "Zabójstwa",
        matchKd: "K/D",
        matchDeaths: "Zgony",
        matchOffense: "Atak",
        matchDefense: "Obrona",
        matchSupport: "Wsparcie",
        matchHistorySearch: "Przeszukaj historię meczów...",
        matchHistoryEvent: "Wydarzenie",
        matchHistoryPlayedAt: "Rozegrano",
        removePlayerFromClan: "Usuń gracza z tego klanu.",
        removePlayerConfirm:
            "Usunąć tego gracza z klanu? Spowoduje to usunięcie przypisania.",
        saveError: "Nie można zapisać przypisania gracza.",
        deleteError: "Nie można usunąć przypisania gracza.",
        assignmentSaved: "Przypisanie gracza zostało zapisane.",
        assignmentCreated: "Utworzono przydział gracza.",
        assignmentDeleted: "Przypisanie gracza zostało usunięte.",
        primaryGroupRequired: "Wybierz grupę podstawową przed zapisaniem.",
        alreadyAssigned: "Ten gracz jest już przypisany do tego klanu.",
        mercenaryRecruitStatusError:
            "Najemnicy nie mogą korzystać ze statusu rekruta.",
        reserveMemberRecruitStatusError:
            "Członkowie rezerwy nie mogą korzystać ze statusu rekruta.",
        roleSyncTitle: "Jak działa synchronizacja ról członkostwa",
        roleSyncDescription:
            "Połączone z grupą role Discord synchronizują się z wybranymi grupami podstawowymi i dodatkowymi. Role członkostwa synchronizują się tylko dla nieoczekujących członków, a status rekrutacji lub aktywności zależy od roli w klanie oraz powiązanych ról w kategoriach członkostwa, jeśli są dostępne. Zmiany członkostwa są umieszczane w kolejce; sprawdź wynik w Ustawieniach członkostwa → Operacje na roli członkostwa.",
        missingClanRoleTitle: "Rola klanu nie jest skonfigurowana",
        missingClanRoleDescription:
            "Gracz ten nadal może być oznaczony jako rekrut lub aktywny w Logi, ale żadna podstawowa rola klanu nie zostanie dodana w Discord, dopóki rola klanu nie zostanie ustawiona w ustawieniach klanu.",
        missingMembershipCategoryTitle:
            "To zadanie nie jest powiązane z kategorią członkostwa",
        missingMembershipCategoryDescription:
            "Role Rekrut i kategoria końcowa nie mogą być synchronizowane w przypadku przypisań ręcznych bez powiązanej kategorii wniosku o członkostwo. W Discord można zastosować wyłącznie rolę klanu i role powiązane z grupą.",
        missingCategoryRolesTitle: "Role kategorii członkostwa są niekompletne",
        missingRecruitRoleDescription:
            "W tej kategorii nie skonfigurowano żadnej roli rekruta.",
        missingFinalRoleDescription:
            "W tej kategorii nie ma skonfigurowanej ostatecznej roli.",
        missingCategoryRolesSummary:
            "Logi zachowa tutaj status członkostwa, ale pasująca rola Discord nie zostanie dodana na tym etapie.",
        platformIdsHint:
            "Oddziel kilka identyfikatorów przecinkami. Identyfikator Steam składa się z 17 cyfr i zaczyna się od 7656119; wpisz identyfikatory Xbox i PlayStation jako xbox:… lub psn:….",
        platformIdsInvalid:
            "Napraw zaznaczone identyfikatory platform przed zapisaniem.",
        platformIssues: {
            steam_format:
                "To nie jest identyfikator Steam: musi mieć 17 cyfr i zaczynać się od 7656119.",
            epic_format: "To nie jest identyfikator Epic Games.",
            too_long: "Za długo na identyfikator platformy.",
            duplicate: "Wystawiony dwukrotnie; jest zapisywany raz.",
            linked_elsewhere: "Już połączone z {name}.",
        },
        grantAdminTitle: "Uczynić {name} administratorem?",
        grantAdminDescription:
            "{name} może następnie zmienić ustawienia, mecze, składy i członków tego klanu w panelu kontrolnym Logi. Możesz później usunąć dostęp.",
        removeAdminTitle: "Usunąć dostęp administratora z {name}?",
        removeAdminDescription:
            "{name} pozostaje w klanie, ale nie może już zarządzać nim w panelu kontrolnym, chyba że rola Discord nadal zapewnia dostęp.",
        removePlayerTitle: "Usunąć {name} z klanu?",
        removePlayerDescription:
            "Ich przydział, grupy i status członkostwa w tym klanie zostaną usunięte, a Logi usunie role Discord, którymi dla nich zarządza. Historia meczów pozostaje.",
    },
} as const
