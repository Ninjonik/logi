export const integrationsMessages = {
    membershipIntegration: {
        title: "Integracje członkostwa Discord",
        description:
            "Wybierz role Discord, które może czytać każda integracja. Dostęp wymaga również klucza tylko do odczytu z przyznaniem członkostwa Discord. Serwis decyduje, w jaki sposób te obserwacje zostaną wykorzystane.",
        enabled: "Zezwalaj na wyszukiwanie członkostwa za pomocą tego klucza",
        roles: "Dozwolone role",
        rolesHelp:
            "Bez ról udostępniana jest tylko obecność i przypisanie Logi. Zapisz, aby zastosować zmiany.",
        empty: "Utwórz klucz API tylko do odczytu z przyznaniem członkostwa Discord, a następnie odśwież tę listę.",
        loading: "Wczytywanie…",
        refresh: "Odśwież",
        saving: "Zapisywanie…",
        save: "Zapisz politykę",
        saved: "Polityka członkostwa została zapisana.",
        error: "Nie można załadować lub zapisać zasad członkostwa. Odśwież i spróbuj ponownie.",
        invalid:
            "Użyj prawidłowych identyfikatorów ról Discord, maksymalnie 100 ról na grę.",
    },
    websiteEventPolicies: {
        title: "Komendy wydarzeń ze strony",
        description:
            "Pozwól połączonej witrynie internetowej tworzyć, aktualizować lub anulować wydarzenia za pomocą klucza usługi. Polityka wiąże jedną zarejestrowaną aplikację do pojedynczego logowania z jednym ograniczonym kluczem API i wyświetla listę ról Discord dla każdej gry, których członkowie mogą używać poleceń.",
        application: "Aplikacja logowania SSO",
        applicationPlaceholder: "Wybierz aplikację",
        noApplications:
            "Najpierw zarejestruj aplikację do pojedynczego logowania. Polityka wiąże polecenia witryny z tą aplikacją.",
        noKeys: "Utwórz ograniczony klucz API dla zaplecza witryny, a następnie odśwież. Starsze nieograniczone klucze nie mogą zawierać zasad poleceń.",
        enabled: "Zezwalaj na polecenia zdarzeń za pomocą tego klawisza",
        roles: "Dozwolone role",
        rolesHelp:
            "Gra bez ról pozostaje tylko do odczytu. Zapisanie włączonej polityki zapewnia dostęp do zapisu poleceń zdarzeń dla gier z rolami; wyłączenie go powoduje usunięcie dotacji.",
        granted: "Dostęp do zapisu przyznany dla: {games}",
        notGranted: "Nie przyznano dostępu do zapisu poleceń zdarzenia.",
        loading: "Wczytywanie…",
        refresh: "Odśwież",
        saving: "Zapisywanie…",
        save: "Zapisz politykę",
        saved: "Zapisano zasady poleceń zdarzeń.",
        error: "Nie można załadować lub zapisać zasady poleceń zdarzeń. Odśwież i spróbuj ponownie.",
        denied: "Polityka została odrzucona. Użyj aktywnego klucza zastrzeżonego tego obszaru roboczego i zarejestrowanej w nim zgłoszenia.",
        invalid:
            "Użyj prawidłowych identyfikatorów ról Discord, maksymalnie 64 na grę, dla gier włączonych w tym obszarze roboczym.",
    },
    apiKeys: {
        revokeTitle: "Unieważnić klucz {name}?",
        groupsLegend: "Obszary",
        groups: {
            matches: {
                label: "Mecze",
                short: "mecze",
                help: "Wydarzenia, mecze, ich podsumowania i mapy strat.",
            },
            rosters: {
                label: "Składy",
                short: "składy",
                help: "Składy, składy i przydziały zawodników.",
            },
            results: {
                label: "Wyniki",
                short: "wyniki",
                help: "Potwierdzone wyniki, statystyki graczy i historia gier.",
            },
            members: {
                label: "Członkowie",
                short: "członków",
                help: "Członkowie klanu i ich status. Członkostwo czytelnicze również rządzi się swoimi prawami.",
            },
            servers: {
                label: "Serwery gier",
                short: "serwery",
                help: "Stan serwera na żywo, Warcon, HLL i kondycja połączenia.",
            },
            league: {
                label: "Liga i drużyny",
                short: "liga",
                help: "Mecze Wardogs League i katalog drużyn.",
            },
        },
        partialGroup: "{group} (część)",
        readOnlyShort: "tylko do odczytu",
        everyGame: "każdą grę",
        createdOn: "utworzono {date}",
        revokeDescription:
            "Wszystko, co używa tego klucza, np. Twoja witryna internetowa, natychmiast przestaje pobierać dane z Logi. Nie można tego cofnąć; aby przywrócić dostęp, utwórz nowy klucz.",
        revokeConfirm: "Unieważnij klucz",
        emptyTitle: "Nie ma jeszcze klucza API",
        emptyDescription:
            "Utwórz klucz dla serwera swojej witryny. Wybieraj tylko te dane i gry, których potrzebuje.",
        description:
            "Utwórz klucz integracyjny i przechowuj go na swoim serwerze. Wybierz tylko te dane i gry, których potrzebuje integracja.",
        name: "Nazwa klucza",
        namePlaceholder: "Nazwa strony internetowej, np. strona główna",
        access: "Dostęp",
        readOnly: "Tylko do odczytu",
        fullAccess: "Pełny dostęp (starsza wersja)",
        readOnlyHelp:
            "Może czytać tylko wybrane zasoby i gry. Nie można tworzyć, aktualizować ani usuwać danych.",
        fullAccessHelp:
            "Może czytać i modyfikować wszystkie dane klanu we wszystkich grach. Używaj tylko w przypadku integracji wymagających dostępu do zapisu.",
        resources: "Zasoby",
        games: "Rozegrane gry",
        selectScope: "Wybierz co najmniej jeden zasób i jedną grę.",
        privateData:
            "Kompletne zapisy mogą zawierać prywatne szczegóły operacyjne. Przejrzyj dane przed ich opublikowaniem.",
        createReadOnly: "Utwórz klucz tylko do odczytu",
        createFullAccess: "Utwórz klucz pełnego dostępu",
        copyNow:
            "Skopiuj teraz ten klucz. Nie można tego ponownie pokazać. Trzymaj to na swoim serwerze.",
        copy: "Skopiuj klucz API",
        copied: "Skopiowano klucz API.",
        copyFailed:
            "Nie można skopiować klucza. Skopiuj go ręcznie przed ukryciem.",
        hide: "Ukryj klucz",
        createFailed:
            "Nie można utworzyć klucza. Sprawdź swój wybór i spróbuj ponownie.",
        invalidKey: "Serwer zwrócił nieprawidłowy klucz API.",
        revoke: "Unieważnij",
        revokeFailed: "Nie można unieważnić klucza. Spróbuj ponownie.",
        revoked: "unieważniono",
        created: "utworzono",
        existingKeys: "Istniejące klucze",
        rotateHelp:
            "Aby zmienić uprawnienia, utwórz klucz zastępczy, przełącz integrację, a następnie unieważnij stary klucz.",
        allGames: "wszystkie gry; odczyt i zapis",
        loading: "Ładowanie kluczy…",
        loadFailed:
            "Nie można odświeżyć kluczy. Wyświetlane uprawnienia mogą być nieaktualne.",
        retry: "Spróbuj ponownie",
        empty: "Nie utworzono żadnych kluczy API.",
        invalidPolicy:
            "Nierozpoznane ograniczenia; dostęp do backendu jest zabroniony.",
        resourceLabels: {
            "server-game-history":
                "Zachowane gry serwerowe (nazwy graczy i identyfikatory Steam)",
            "league-matches": "Wardogs League",
            "league-fixtures": "Śledzone mecze Wardogs League",
            "hll-live":
                "Tablica wyników na żywo HLL (w tym nazwiska graczy i identyfikatory platform)",
            "warcon-data":
                "Dane rozgrywki Warcon (w tym nazwy graczy i identyfikatory Steam)",
            "member-summaries": "Katalog członków (tylko do odczytu)",
            "roster-summaries":
                "Opublikowane listy i frekwencja (tylko do odczytu)",
            "player-stat-summaries":
                "Zweryfikowane fakty o graczach z zebranych sesji",
            "membership-summaries":
                "Członkostwo Discord (wymagana osobna polisa)",
            "server-snapshots": "Migawki serwerów gier",
            "integration-health": "Stan zbierania danych",
            "event-summaries": "Podsumowania wydarzeń",
            "match-summaries": "Podsumowania meczów",
            "result-summaries": "Podsumowania zatwierdzonych wyników",
            events: "Wydarzenia (pełna dokumentacja)",
            matches: "Mecze (surowe statystyki)",
            groups: "Grupy",
            rosters: "Składy",
            assignments: "Przydziały członków",
            stratmaps: "Mapy taktyczne",
            teams: "Katalog drużyn (aktywne drużyny, nazwy i logo)",
        },
    },
    verifiedPlatformLinks: {
        title: "Zweryfikowane konto Steam",
        description:
            "Zweryfikuj kontrolę nad swoim kontem Steam, logując się na Steam. Identyfikatory wprowadzone w Twoim profilu to niezweryfikowane roszczenia.",
        loading: "Wczytywanie…",
        refresh: "Odśwież",
        error: "Łączenie Steam jest niedostępne. Odśwież lub spróbuj ponownie wkrótce.",
        callbackFailed:
            "Weryfikacja Steam nie została ukończona. Rozpocznij nową próbę połączenia.",
        verified: "Zweryfikowano przez Steam",
        empty: "Brak zweryfikowanego konta Steam",
        verifiedAt: "Zweryfikowano",
        revokedAt: "Niepołączone",
        link: "Zweryfikuj przez Steam",
        unlink: "Odłącz Steam",
        history: "Ostatnie powiązania konta",
        effect: "Odłączenie zatrzymuje przyszłe przypisywanie graczy. Ten dowód nie przyznaje ról Discord, nie potwierdza posiadania gry ani nie publikuje Twojego profilu na stronie internetowej.",
    },
    integrationSettings: {
        cancel: "Anuluj",
        web: {
            stepKey: "Klucz API dla strony internetowej",
            stepLogin: "Zaloguj się za pomocą Logi",
            stepMembers: "Co strona internetowa może zrobić dla członków",
            newKey: "Nowy klucz",
            closeForm: "Zamknij",
            keyShownOnce:
                "Klucz jest pokazywany tylko raz, zaraz po jego utworzeniu. Zachowaj go na serwerze swojej witryny.",
            loginPage: "Strona logowania do klanu",
            ssoApps: "Aplikacje logowania SSO",
            addApplication: "Dodaj aplikację",
            membersRowHelp:
                "Za pomocą klucza {key}. Członek potrzebuje jednej z ról.",
            saveRoles: "Zapisz role",
            membersTitle: "Dowiedz się, kto jest członkiem",
            membersHelp:
                "Poprzez klucz tylko do odczytu z przyznaniem członkostwa Discord. Witryna widzi tylko członków z jedną z wybranych ról.",
            eventsTitle: "Twórz i edytuj wydarzenia",
            eventsHelp:
                "Za pośrednictwem aplikacji do pojedynczego logowania i jej klucza. Tylko osoby posiadające jedną z wybranych ról.",
            footer: "Klucze i zgłoszenia są zapisywane natychmiast. Role zapisywane są za pomocą przycisku każdego klawisza.",
            rolesPlaceholder: "Wybierz role",
            rolesUnavailable:
                "Nie można załadować ról Discord. Odśwież stronę, aby spróbować ponownie.",
        },
        sso: {
            emptyTitle: "Nie ma jeszcze aplikacji logowania",
            emptyDescription:
                "Dodaj swoją witrynę internetową jako aplikację, aby członkowie mogli logować się do niej za pomocą konta Discord za pośrednictwem Logi.",
            redirects: "Adresy zwrotne po zalogowaniu: {count}",
            clientId: "Identyfikator klienta",
            edit: "Edytuj",
            save: "Zapisz zmiany",
            saved: "Aplikacja zapisana.",
            removeTitle: "Usunąć {name}?",
            removeDescription:
                "Członkowie nie mogą już logować się do {website} za pomocą Logi. Identyfikator klienta i klucz tajny aplikacji przestają działać, a powiązane z nimi polecenia zdarzeń witryny internetowej również przestają działać. Tego nie można cofnąć.",
            removeConfirm: "Usuń aplikację",
        },
        webhooks: {
            emptyTitle: "Nie ma jeszcze żadnych webhooków",
            emptyDescription:
                "Dodaj adres HTTPS. Logi będzie wysyłać na niego zmiany wydarzeń, składów, artykułów i ustawień, podpisane sekretem webhooka.",
            deleteTitle: "Usunąć tego webhooka?",
            deleteDescription:
                "Logi natychmiast przestaje wysyłać zmiany do {url}, a jego sekret podpisywania przestaje działać. Tego nie można cofnąć.",
            deleteConfirm: "Usuń webhooka",
            loadFailed:
                "Nie można załadować webhooków. Odśwież i spróbuj ponownie.",
            createFailed:
                "Nie można utworzyć webhooka. Sprawdź adres i spróbuj ponownie.",
            actionFailed: "Zmiana nie została zapisana. Spróbuj ponownie.",
            rotateFailed: "Nie można obrócić klucza podpisującego.",
            historyFailed: "Nie można załadować historii dostaw.",
        },
        calendar: {
            emptyTitle: "Nie ma jeszcze linku do kalendarza",
            emptyDescription:
                "Utwórz prywatny link i dodaj go do Kalendarza Google lub innej aplikacji kalendarza. Każdy, kto ma link, może zobaczyć wydarzenia klanu.",
            rotateTitle: "Utworzyć nowe łącze do kalendarza?",
            rotateDescription:
                "Obecny link przestaje działać. Każdy, kto go subskrybował, musi ponownie dodać nowy link.",
            rotateConfirm: "Utwórz nowe łącze",
        },
        league: {
            title: "Śledzenie Wardogs League",
            cadence:
                "Nowe mecze są sprawdzane co minuty {scan} i śledzone szczegóły co minuty {refresh}. Witryna internetowa i Discord używają tego samego rekordu.",
            enable: "Śledź Wardogs League i dopasowuj linki",
            teamCodes: "Kody śledzonych drużyn (oddzielone przecinkami)",
            scanEvery: "Szukaj nowych meczów co",
            refreshEvery: "Odśwież śledzone szczegóły co",
            minutes: "{minutes} minut",
            scanNote:
                "Wspólne skanowanie indeksu przebiega z najszybszą częstotliwością, o jaką prosi dowolny włączony klan; ten klan pobiera nowy indeks dopiero po własnej przerwie. Ograniczenia u źródła mogą rozciągać interwały.",
            intakeChannel: "Kanał, na którym ludzie zamieszczają linki",
            intakePlaceholder: "Wybierz kanał z linkami",
            panelsNote:
                "Tabela oraz kolejne mecze całej ligi trafiają do Discord jako panel WD League w Ustawieniach → Panele Discord. Nie są już publikowane kartki na pojedyncze mecze. Gdy wyłączysz śledzenie, bot usunie wiadomości panelu.",
            intakeNote:
                "Wiadomości od botów są ignorowane. Automatyczne czytanie wiadomości innych osób wymaga włączenia treści wiadomości dla bota przez jego operatora. Skanowanie i ręczne dodawanie działają bez niego.",
            save: "Zapisz ustawienia",
            saved: "Zapisano.",
            saveFailed:
                "Zapisywanie nie powiodło się. Sprawdź uprawnienia, link i ustawienia kanału.",
            loadFailed: "Nie można załadować ustawień śledzenia.",
            lastScan: "Ostatnie udane skanowanie",
            nextScan: "Następny skan",
            incomplete: "Lista jest niepełna. Dodaj brakujący mecz ręcznie.",
            queueFull:
                "Automatyczne wykrywanie jest pełne. Istniejące mecze są nadal odświeżane; pozostałe miejsca są zachowane na potrzeby ręcznego dodawania.",
            sourceError:
                "Źródło jest niedostępne. Zachowywane są ostatnie ważne dane.",
            addByUrl: "Dodaj mecz według jego adresu URL ligi",
            preview: "Załaduj podgląd",
            previewFailed: "Podgląd niedostępny. Sprawdź URL meczu.",
            track: "Śledź ten mecz",
            createNative: "Stwórz swój własny mecz w Logi",
            states: {
                pending: "Czekam na załadowanie",
                tracked: "Śledzenie",
                paused: "Wstrzymano",
                ignored: "Ignorowane",
                archived: "Zarchiwizowane",
                unmatched: "Poza filtrem",
            },
            refreshOnce: "Załaduj ponownie",
            resume: "Wznów",
            pause: "Pauza",
            ignore: "Ignoruj",
            staleData: "Starsze dane, ostatnio załadowane {time}",
            linkedEvent: "Mecz Logi dla tego spotkania",
            notLinked: "Niepołączone",
            unknownEvent: "Powiązany mecz, którego nie ma już na liście",
            noEvents:
                "W Logi nie ma jeszcze meczu Wardogs. Utwórz taki, a następnie połącz go tutaj.",
            saveLink: "Zapisz link",
            emptyTitle: "Nie śledzono jeszcze żadnego meczu",
            emptyDescription:
                "Mecze śledzonych drużyn pojawią się tutaj po kolejnym skanowaniu. Możesz także dodać go według powyższego adresu URL.",
        },
    },
} as const
