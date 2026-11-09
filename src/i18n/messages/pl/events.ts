export const eventsMessages = {
    event: {
        signupStatusSignedUpAs: "Jesteś zarejestrowany jako: {type}.",
        signupStatusGeneral: "uczestnik generalny",
        signupStatusDeclined: "Oznaczyłeś siebie jako nieobecnego.",
        signupStatusNotSignedUp: "Nie zapisałeś się jeszcze na to wydarzenie.",
        infoTitle: "Informacje o wydarzeniu",
        infoDescription: "Harmonogram , rejestracje i ustawienia Discord.",
        listDescription: "Nadchodzące i przeszłe wydarzenia klanowe.",
        createTitle: "Utwórz wydarzenie",
        created: "Utworzono zdarzenie.",
        saved: "Zdarzenie zapisane.",
        createDescription:
            "Skonfiguruj szczegóły wydarzenia, harmonogram i opcje Discord przed opublikowaniem ich w swoim klanie.",
        createPageDescription:
            "Ustaw harmonogram, zasady rejestracji i kanały Discord.",
        relatedRoster: "Powiązany skład",
        showRoster: "Pokaż skład",
        rosterPublishedHint: "skład został opublikowany.",
        rosterDraftHint:
            "Przypisano skład, ale nadal jest on ukryty przed zwykłymi członkami.",
        rosterMissingHint: "Nie przypisano składu.",
        detailMetaTitle: "Szczegóły zdarzenia",
        requiredLabel: "Wymagane",
        optionalLabel: "Opcjonalnie",
        noPreset: "Brak presetu",
        topicPreset: "Preset tematów",
        topicPresetCompleteMatch: "Pełne dopasowanie",
        topicPresetPartialMatch: "Częściowe dopasowanie",
        resyncTopicThread: "Zsynchronizuj ponownie wątek tematu",
        topicThreadResyncQueued:
            "Ponowna synchronizacja wątku tematu została umieszczona w kolejce.",
        generalSignupDescription:
            "Włącz przycisk zapisów bez wyboru grupy. Gracz trafi do swojej grupy podstawowej, jeśli jest dostępna w meczu; w przeciwnym razie do rezerwy.",
        signupGroupsDescription:
            "Wybierz grupy, których przyciski zapisów pojawią się przy tym meczu.",
        allowedSignupStatusesDescription:
            "Pozostaw to pole puste, aby umożliwić rejestrację każdemu członkowi klanu. W przeciwnym razie tylko wybrane statusy będą mogły zapisać się na ten mecz.",
        allowedSignupStatusesAll: "Wszystkie statusy członków klanu",
        signupReminderStatusesDescription:
            "Wysyłaj DM z przypomnieniem o zapisie i pełnymi informacjami o meczu co 24 godziny, od 24 godzin po utworzeniu wydarzenia do zamknięcia zapisów. Brak wybranych statusów wyłącza przypomnienia.",
        signupReminderDisabled:
            "Codzienne przypomnienia o zapisach są wyłączone.",
        createForumChannelDescription:
            "Utwórz kanał forum Discord i tematy odprawy dla tego wydarzenia.",
        conclude: "Zakończ wydarzenie",
        submitMatchResults: "Prześlij wyniki meczu",
        submitMatchResultsDescription:
            "Wklej link do meczu kończący się na /games/[id]. Logi zaimportuje tablicę wyników i zapisze statystyki graczy.",
        importEvents: "Importuj zdarzenia",
        importEventsDescription:
            "Wklej łącza do wydarzeń w tym samym formacie, w jakim są importowane wyniki meczów. Obsługiwane są zarówno przecinki, jak i podziały wierszy.",
        importEventsHint: "Łącza {count} gotowe do importu.",
        importEventsSuccess:
            "Zaimportowano zdarzenia {events} i rekordy graczy {players}.",
        importEventsPartial: "{failed} nie można zaimportować.",
        importEventPlayers: "Importuj i dopasowuj graczy",
        importEventPlayersDescription:
            "Dopasuj zaimportowanych graczy HLL do bazy danych, połącz brakujące identyfikatory platform i w razie potrzeby utwórz nowych graczy.",
        importEventPlayersHint:
            "Nazwy graczy są porównywane po usunięciu znacznika klanu, pisaniu małych liter i usunięciu znaków specjalnych.",
        matchLink: "Link do meczu",
        matchLinks: "Linki do zdarzeń",
        matchResultsImported:
            "Zaimportowano dane {players} graczy. Wynik wydarzenia: {result}.",
        resultSaved: "zapisane",
        resultSkipped: "pominięto",
        resultVictory: "Zwycięstwo",
        resultDefeat: "Porażka",
        resultDraw: "Remis",
        resultColumn: "Wynik",
        matchColumn: "Mecz",
        openMatch: "Otwórz mecz",
        matchDetailTitle: "Szczegóły meczu",
        matchDetailDescription:
            "Zaimportowana surowa tablica wyników, występy zawodników i zestawienia drużyn dla tego wydarzenia.",
        rawSource: "Źródło",
        importedAt: "Zaimportowano",
        playedAt: "Rozegrano",
        duration: "Czas trwania",
        players: "Gracze",
        score: "Wynik",
        overviewTab: "Przegląd",
        playersTab: "Gracze",
        weaponsTab: "Broń",
        killsByTypeTab: "Zabójstwa według typu",
        noMatchLinked:
            "Żaden zaimportowany mecz nie jest jeszcze powiązany z tym wydarzeniem.",
        alliedTeam: "Alianci",
        axisTeam: "Oś",
        teamUnknown: "Brak danych",
        topWeapons: "Najlepsza broń",
        deathsByWeapon: "Zgony bronią",
        playerBreakdowns: "Szczegółowe statystyki graczy",
        standoutAwards: "Wyróżniające się nagrody",
        topRivalries: "Najlepsze rywalizacje",
        encounters: "Spotkania",
        encountersDescription:
            "Na podstawie zaimportowanych danych zbiorczych na gracza, takich jak liczba zabitych i liczba zgonów.",
        killsByWeaponForPlayer: "Zabójstwa bronią",
        deathsByWeaponForPlayer: "Zgony bronią",
        badges: "Odznaki",
        killed: "Zabito",
        diedTo: "Zabity przez",
        plusMinus: "+/-",
        noDerivedData: "Brak danych pochodnych",
        performanceScatter: "Zabójstwa a liczba zgonów",
        rawStats: "Surowe statystyki",
        concludedSuccess: "Zdarzenie zakończone",
        trainingCompletionTitle: "Zakończ trening",
        trainingCompletionDescription:
            "Przed zakończeniem treningu zaznacz zaliczenie lub niezaliczenie u każdego obecnego uczestnika.",
        trainingCompletionEmpty:
            "Nikt nie jest obecnie zapisany na ten trening.",
        trainingCompletionSuccess:
            "Trening zakończony. Przyznane nagrody: {rewarded}. Wysłane DM: {dmed}.",
        trainingPassed: "Zaliczono",
        trainingFailed: "Niepowodzenie",
        trainingCompleteAction: "Zapisz i zakończ",
        saveHelp:
            "Nazwa i cztery pola osi czasu są wymagane. Wszystko inne jest opcjonalne.",
        saveError: "Nie można zapisać zdarzenia.",
        writeForbidden:
            "Tylko administratorzy obszarów roboczych mogą zmieniać to zdarzenie. Zaloguj się ponownie, jeśli Twoja sesja wygasła.",
        notices: {
            announcementsTitle: "Kanał powiadomień nie jest ustawiony",
            announcementsDescription:
                "Wiadomości ogłaszające wydarzenia nie będą publikowane ani aktualizowane w Discord, dopóki dla tego klanu nie zostanie skonfigurowany kanał ogłoszeń.",
            forumTitle: "Kategoria forum nie jest ustawiona",
            forumDescription:
                "To zdarzenie ma na celu utworzenie kanału forum Discord, ale nie skonfigurowano żadnej kategorii forum. Kanał forum i tematy odpraw zostaną pominięte do czasu wypełnienia tego ustawienia.",
            meetingAutomationTitle:
                "Automatyzacja głosu podczas spotkania jest wyłączona",
            meetingAutomationDescription:
                "Wydarzenia Discord i potwierdzanie obecności graczy ze składu na podstawie kanału głosowego wymagają ustawienia kanału zbiórki klanu.",
            openClanSettings: "Otwórz ustawienia klanu",
        },
        statuses: {
            registration: "Zapisy",
            closed: "Zamknięte",
            starting: "Wkrótce start",
            concluded: "zakończone",
        },
        fields: {
            name: "Nazwa",
            kind: "Typ",
            matchType: "Kategoria zdarzenia",
            description: "Opis",
            thumbnail: "Miniatura",
            image: "Osadź obraz",
            announcementChannelId: "Kanał rejestracji zdarzeń",
            eventInfoChannelId: "Kanał informacji o zdarzeniu",
            meetingChannelId: "Kanał zbiórki / miejsce",
            server: "Serwer",
            serverPassword: "Hasło serwera",
            map: "Mapa",
            mapVariant: "Pora dnia/pogoda",
            mapMode: "Tryb gry",
            mapPresetCode: "Gotowy kod mapy",
            side: "Strona",
            capMode: "Środkowy cap",
            registrationStart: "Rozpoczęcie ogłaszania rejestracji",
            registrationEnd: "Koniec rejestracji",
            meetingStart: "Początek zbiórki",
            gameStart: "Początek gry",
            gameEnd: "Koniec gry",
            notes: "Uwagi",
            stratmaps: "Mapy taktyczne",
            requiredRoleIds: "Wymagane identyfikatory ról",
            rewardRoleIds: "Identyfikatory ról nagród",
            signupGroupIds: "Widoczne grupy zapisów",
            allowedSignupStatuses: "Dozwolone statusy przy zapisach",
            signupReminderStatuses: "Odbiorcy codziennych przypomnień zapis",
            useGeneralSignup: "Włącz zapisy bez grupy",
            allowRankedSignup: "Zezwalaj na zapasowe grupy",
            pingClan: "Ping klanu",
            pingMode: "Ping ogłoszenia",
            pingRoleIds: "Role do pingowania",
            createForumChannel: "Utwórz kanał forum",
            createSquadVoiceChannels:
                "Utwórz kanały głosowe oddział na początku spotkania",
            squadVoiceCategory:
                "Kategoria kanałów głosowych oddziałów (puste pole: ustawienie domyślne serwera)",
            conclusionReserveHelp:
                "Zdarzenie kończy się automatycznie 15 minut po upływie tego czasu.",
        },
        channelRoutingCreateHelp:
            "Rozpoczyna się od ustawień klanu jako presetów. Ten wybór jest blokowany po utworzeniu, aby zapewnić stabilność komunikatów Discord.",
        channelRoutingSharedHelp:
            "Wybierz kanał rejestracji. Jeśli kanał informacji o zdarzeniu pozostanie pusty, do obu wiadomości zostanie użyty kanał rejestracji.",
        channelRoutingLockedHelp:
            "Po utworzeniu wydarzenia nie można zmienić tych kanałów, aby zachować powiązania z wiadomościami Discord.",
        pingNone: "Nie pinguj nikogo",
        pingClanOption: "Pinguj rolę klanu",
        pingRolesOption: "Pinguj wybrane role",
        quickScheduleTitle: "Szybki harmonogram",
        quickScheduleDescription:
            "Ustaw cztery kluczowe czasy w tym meczu. Wygenerowaną oś czasu możesz zmienić w dowolnym momencie.",
        registrationHoursBefore:
            "Godziny przed liczbą pracowników do zamknięcia rejestracji",
        meetingMinutesBefore: "Minuty przed rozpoczęciem spotkania",
        durationHours: "Czas trwania (godziny)",
        durationMinutes: "Czas trwania meczu (minuty)",
        quickEventStart: "Data i godzina początku meczu",
        applyQuickSchedule: "Zastosuj harmonogram",
        quickScheduleApplied: "Zastosowano harmonogram .",
        recurringMatch: "Ustaw ten mecz jako powtarzający się",
        recurringMatches: "Powtarzające się mecze",
        recurringMatchesDescription:
            "Zarządzaj seriami meczów, które powtarzają się zgodnie z harmonogramem.",
        noRecurringMatches:
            "Nie utworzono jeszcze żadnych powtarzających się meczów.",
        recurrenceHelp:
            "Tworzony mecz jest pierwszym meczem w tej serii. Jego szczegóły i czas są wykorzystywane do przyszłych zdarzeń.",
        recurrenceFrequency: "Powtórz",
        recurrenceWeekly: "Co tydzień",
        recurrenceMonthlyDate: "Co miesiąc w dniu",
        recurrenceMonthlyNthWeekday: "Co miesiąc w dzień powszedni",
        recurrenceInterval: "Co (interwał)",
        recurrenceWeekdays: "Dni tygodnia",
        recurrenceMonthDay: "Dzień miesiąca",
        recurrenceNth: "Tydzień miesiąca",
        recurrenceWeekday: "Dzień powszedni",
        editSchedule: "Edytuj harmonogram",
        quickScheduleStepLabel: "Krok {step} z 4",
        wizardBack: "Wstecz",
        wizardNext: "Dalej",
        discordPreview: "Podgląd Discord",
        previewUntitled: "Zdarzenie bez tytułu",
        previewNoDescription: "Tutaj pojawi się opis Twojego wydarzenia.",
        createMatchAction: "Utwórz mecz",
        createTrainingAction: "Utwórz trening",
        recurrenceEditHelp:
            "Wyłącz powtarzanie, aby zatrzymać serię. Mecze, które już istnieją, pozostają.",
    },
    presets: {
        topicTitle: "Presety tematów",
        topicDescription:
            "Tematy odpraw do ponownego wykorzystania. Edycja presetu nie powoduje zmiany istniejących meczów.",
        squadTitle: "Presety oddziałów",
        squadDescription:
            "Układy oddziałów, ról i miejsc do wykorzystania w nowych składach.",
        createTopicTitle: "Utwórz preset tematów",
        createTopicDescription: "Dodaj tematy odprawy i ich treść.",
        createSquadTitle: "Utwórz preset oddziałów",
        createSquadDescription: "Dodaj drużyny, role i miejsca.",
        presetDetails: "Szczegóły presetu",
        presetCreateMode:
            "Tryb tworzenia rozpoczyna się bezpośrednio w trybie edycji.",
        squadPresetPageDescription:
            "Wstępnie ustawione składy i role, które można skopiować do składów wydarzeń.",
        squadPresetMetaDescription:
            "Wstępnie ustawiona struktura oddziałów dla nowych składów.",
        topicPresetMetaDescription:
            "Szablony odpraw do wielokrotnego użytku, kopiowane do wydarzeń w razie potrzeby.",
        topics: "Tematy",
        squadStructure: "Struktura oddziałów",
        presetSetup: "Konfiguracja presetu",
        presetSetupDescription: "Oddziały, role i miejsca.",
        addTopic: "Dodaj temat",
        role: "Rola",
        roleNote: "Uwaga dotycząca roli",
        addRole: "Dodaj rolę",
        squadBlock: "Blok oddziału",
        presetName: "Nazwa presetu",
        topicEditorDescription: "Nazwy tematów i komunikaty informacyjne.",
        attachmentPlaceholder: "Jeden adres URL załącznika w wierszu",
        attachmentCountSuffix: "Załączniki",
        newTopic: "Nowy temat",
        newSquad: "Nowy oddział",
        newRole: "Nowa rola",
        importStarterTemplate: "Importuj szablon startowy",
        starterTemplateName: "Standardowy skład HLL",
        wowForeverStarterTemplateName: "WoW:F raid dla 20 graczy",
        shortNote: "Notatka",
        untitledPreset: "Preset bez nazwy",
        topicPresetMetaFallback: "Preset tematów",
        topicPresetPageDescription:
            "Tematy odpraw do ponownego wykorzystania w meczach.",
        squadPresetMetaFallback: "Preset oddziałów",
        fields: {
            name: "Nazwa",
            map: "Mapa",
            side: "Strona",
            cap: "Cap",
            notes: "Uwagi",
        },
        table: {
            preset: "Preset",
            topics: "Tematy",
            groups: "Grupy",
            roleSlots: "Miejsca na role",
            squads: "Oddziały",
        },
        emptySquadTitle: "Nie ma jeszcze presetów oddziałów",
        emptySquadAdmin:
            "Preset oddziałów określa początkowy układ składu: oddziały, role i miejsca. Utwórz preset, a nowe składy będą go kopiować.",
        emptyTopicTitle: "Nie ma jeszcze presetów tematów",
        emptyTopicAdmin:
            "Preset tematów zawiera odprawy, które mecz kopiuje na swoje forum Discord.",
        emptyMember:
            "Administratorzy Twojego klanu nie utworzyli jeszcze żadnych presetów.",
        delete: {
            action: "Usuń preset",
            title: "Usunąć preset {name}?",
            squadConsequence:
                "Istniejące składy zachowają swoje układy. Nowych składów nie będzie można tworzyć z tego presetu.",
            topicConsequence:
                "Zakończone mecze zachowują tematy, które zostały już opublikowane. Mecz, który nie został zakończony i wykorzystuje ten preset, blokuje usunięcie.",
            confirm: "Usuń",
            done: "Preset usunięty.",
            inUse: "Otwarte mecze nadal korzystają z tego presetu: {count}. Najpierw wybierz w nich inny preset.",
            forbidden:
                "Tylko administratorzy klanu mogą usuwać presety. Zaloguj się ponownie, jeśli Twoja sesja wygasła.",
            failed: "Nie można usunąć presetu.",
        },
    },
    groups: {
        title: "Grupy",
        manageAction: "Zarządzaj grupami",
        refreshAction: "Odśwież grupy",
        newTab: "otwiera się w nowej karcie",
        refreshFailed:
            "Nie można załadować grup . Zapisz zmiany i ponownie załaduj stronę.",
        description:
            "Grupy określają specjalizacje graczy i oddziałów w klanie. Składy kopiują ich nazwy, więc zmiany nie wpływają na wcześniejsze wydarzenia.",
        createTitle: "Utwórz grupę",
        createDescription:
            "Utwórz specjalność klanu wielokrotnego użytku z kolorem i krótkim opisem.",
        name: "Nazwa grupy",
        color: "Kolor",
        descriptionLabel: "Opis",
        order: "Kolejność",
        parent: "Grupa nadrzędna",
        none: "Brak",
        reset: "Zresetuj dane pomocnicze",
        initialize: "Importuj domyślne presety",
        resetConfirm:
            "Spowoduje to usunięcie grup, presetów oddziałów i ustawień tematów dla tego klanu. Wydarzenia, składy i gracze pozostają. Kontynuować?",
        initializeConfirm:
            "Spowoduje to zresetowanie grup, presetów oddziałów i ustawień tematycznych, a następnie ponowne utworzenie domyślnego presetu grupy i początkowego presetu oddziałów. Kontynuować?",
        resetSuccess: "Resetowanie danych pomocnika zakończone.",
        initializeSuccess: "Zaimportowano domyślne presety.",
        usedByPlayers: "Gracze podstawowi",
        starterDescription:
            "Początkowe specjalizacje klanu dopasowane do domyślnego układu oddziałów HLL.",
        created: "Grupa została utworzona.",
        saved: "Grupa została zapisana.",
        saveFailed: "Nie można zapisać grupy. Spróbuj ponownie.",
        duplicateName: "Grupa o tej nazwie już istnieje.",
        deleteAction: "Usuń grupę",
        deleteTitle: "Usunąć grupę „{name}”?",
        deleteDescription:
            "Gracze tracą tę grupę. W składach i przeszłych wydarzeniach zachowana zostanie skopiowana nazwa grupy. Tego nie można cofnąć.",
        deleteImpact:
            "Gracze {primary} mają tę grupę jako grupę podstawową, a {secondary} jako grupę dodatkową.",
        deleted: "Grupa została usunięta.",
        deleteFailed: "Nie można usunąć grupy. Spróbuj ponownie.",
        emptyTitle: "Nie ma jeszcze grup",
        emptyDescription:
            "Grupy to specjalizacje klanowe, np. czołgiści lub dowódcy. Korzystają z nich gracze i presety oddziałów.",
    },
} as const
