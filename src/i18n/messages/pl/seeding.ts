export const seedingMessages = {
    seedPage: {
        breadcrumbParent: "Panele Discord",
        back: "Panele Discord",
        title: "Seeding serwera",
        description:
            "Gdy serwer jest pusty, Logi wzywa graczy: wysyła połączenie, wysyła ping do roli Seeding i pokazuje w panelu ilu graczy brakuje. Tylko administratorzy Logi mogą go uruchomić.",
        serversLabel: "Serwery gier klanu",
        noServers:
            "Klan nie ma jeszcze serwera gry. Dodaj jeden w obszarze Serwery gier, a następnie skonfiguruj tutaj seeding.",
        gameServersLink: "Serwery gier",
        unavailable:
            "Nie można teraz załadować Seeding. Załaduj ponownie stronę.",
        games: { hell_let_loose: "HLL", wardogs: "Wardogs" },
        status: {
            now: "Teraz gracze {players} / {capacity}",
            nowNoCapacity: "Teraz: {players} graczy",
            noData: "Brak bieżących danych serwera",
            chips: {
                live: "Na żywo",
                below_start: "Poniżej progu początkowego",
                filling: "Zapełnia się",
                offline: "Niedostępne",
                unknown: "Brak danych",
            },
            running: "Seeding trwa",
            idle: "Seeding nie trwa",
            lastData: "ostatnie dane {time}",
            nextSeed: "następny zaplanowany seeding {time}",
            lastSeed: "ostatni seeding {time}",
            progress: "{players} / {liveFrom} do gry na żywo",
            startNow: "Rozpocznij seeding",
            stopNow: "Zakończ seeding",
            busy: "Działa…",
            started: "seeding jest uruchomione. Połączenie jest w {channel}.",
            stopped: "Seeding zakończony.",
        },
        actionErrors: {
            cooldown:
                "Nie można teraz uruchomić seeding. Następny może rozpocząć {time}.",
            running: "Seeding już trwa.",
            duplicate: "Ten seeding już trwa.",
            not_configured: "Wybierz kanał wywoławczy i najpierw zapisz plan.",
            offline:
                "Serwer nie odpowiada. Uruchom seeding, gdy będzie on online.",
            already_live: "Serwer już działa; nie jest potrzebny seeding.",
            not_running: "Nie trwa obecnie żaden seeding.",
            not_found: "Nie można znaleźć serwera.",
            forbidden: "Nie wolno Ci tego zrobić.",
            unsaved: "Najpierw zapisz zmiany w planie.",
            unavailable: "To nie zadziałało. Spróbuj ponownie.",
        },
        time: {
            today: "dzisiaj o {time}",
            yesterday: "wczoraj o {time}",
            tomorrow: "jutro o {time}",
            other: "{date} o {time}",
        },
        plan: {
            title: "Plan Seeding · {server}",
            enabled: "Włączone",
            enabledLabel: "Plan Seeding włączony",
            liveFrom: "Pełna rozgrywka od",
            liveFromUnit: "graczy",
            liveFromHint: "Następnie seeding się kończy.",
            startBelow: "seeding zaczyna się poniżej",
            startBelowUnit: "graczy",
            startBelowHint: "Poza tym plan nic nie wysyła.",
            when: "Kiedy",
            manual: "Ręcznie",
            manualText:
                "z Seeding teraz tutaj lub w komunikacie kontrolnym serwera. Zawsze dostępny.",
            schedule: "Harmonogram",
            scheduleHint:
                "Tylko wtedy, gdy w tym momencie serwer znajduje się poniżej progu uruchomienia.",
            scheduleDays: "Dni harmonogramu",
            at: "o godz",
            time: "Godzina",
            addSlot: "Dodaj kolejną godzinę",
            removeSlot: "Usuń godzinę",
            weekdays: ["Niedz", "Pon", "Wt", "śr", "Czw", "Pt.", "Sob"],
            auto: "Automatycznie",
            autoHint: "Gdy serwer opróżnia się w ciągu dnia.",
            autoBelow: ", gdy spadnie poniżej",
            autoBetween: "Gracze pomiędzy",
            autoAnd: "i",
            seedChannel: "Kanał ogłoszeń",
            seedChannelPlaceholder: "Wybierz kanał",
            seedChannelOk: "Bot może wysyłać i pingować {role}.",
            seedChannelOkNoRole: "Bot może publikować posty na kanale.",
            role: "Rola pingowana w ogłoszeniu",
            rolePlaceholder: "Brak pingu roli",
            createRole: "Utwórz rolę Seeding",
            createRoleBusy: "Tworzenie roli…",
            createRoleHint:
                "Logi tworzy godną uwagi rolę Seeding w Discord i wybiera ją. Możesz także wybrać rolę, którą już posiadasz.",
            roleCreated: "Rola @Seeding została utworzona i wybrana.",
            roleReused: "Serwer ma już rolę @Seeding; jest teraz wybrany.",
            rolePermission:
                "Nie można utworzyć roli. Nadaj roli Logi uprawnienie Zarządzanie rolami w Discord.",
            roleUnavailable:
                "Discord w tej chwili nie odpowiada. Spróbuj ponownie utworzyć rolę za chwilę.",
            roleMembers: {
                one: "{count} członek",
                few: "{count} członków",
                many: "{count} członków",
                other: "{count} członków",
            },
            selfService: "Gracze zamieniają rolę na siebie za pomocą przycisku",
            selfServiceHint:
                "W ramach połączenia wyświetlany jest przycisk Powiadom mnie o seedingu; kolejne kliknięcie ponownie usuwa rolę.",
            protection: "Ochrona",
            pingWindow: "Maksymalnie 1 ping roli na",
            hoursUnit: "h",
            pingWindowHint:
                "Jeśli seeding rozpocznie się wcześniej, połączenie zostanie zakończone bez sygnału ping dotyczącego roli.",
            cooldown: "Minimalny odstęp między akcjami",
            cooldownHint:
                "Ani przycisk, ani plan nie uruchamiają wcześniej kolejnego seeding.",
            template: "Treść ogłoszenia",
            insert: "Wstaw:",
            templateHint: "Logi dodaje tytuł, postęp i same przyciski.",
            templateDefault: "Puste pole używa domyślnego tekstu wywołania.",
            atThreshold: "Na progu",
            endEdit: "Edytuj wiadomość na „Serwer działa” i zakończ seeding",
            endEditHint:
                "Nikt inny nie jest pingowany. Postęp opuszcza także panel serwera.",
            endDelete: "Usuń wiadomość i zakończ seeding",
            maxDuration: "Co najwyżej",
            maxDurationHint:
                "Następnie seeding kończy się, nawet jeśli serwer nie osiągnie progu.",
        },
        previews: {
            title: "Podgląd ogłoszeń",
            call: "Podgląd rozmowy w {channel} · na żywo z tekstu po lewej stronie",
            live: "Gracze {count} · Ta sama wiadomość, edytowana",
            note: "Komunikat jest odświeżany co 60 sekund. Tymczasem panel serwera pokazuje ten sam postęp.",
            control: "Podgląd w {channel} · wiadomość dla tego serwera",
            noChannel: "#kanał",
            author: "dzisiaj o {time}",
            deleted:
                "Gracze {count} Logi usuwają połączenie i kończą seeding. Nikt inny nie jest pingowany.",
        },
        control: {
            title: "Sterowanie w Discord",
            channel: "Kanał sterujący",
            channelPlaceholder: "Wybierz kanał prywatny",
            private: "Kanał jest prywatny ✓",
            privateHint: "mogą to zobaczyć tylko administratorzy.",
            public: "Każdy może zobaczyć kanał",
            publicHint:
                "bot nie będzie tam publikował elementów sterujących. Wybierz kanał prywatny.",
            checking: "Sprawdzanie kanałów w Discord…",
            note: "Tylko administratorzy Logi mogą używać przycisków Seeding, Odśwież i Wstrzymaj. Każda inna osoba otrzyma prywatną odpowiedź, której nie wolno. Panele publiczne nie mają przycisku Seeding.",
        },
        problems: {
            seed_channel_unpublishable:
                "Bot nie może wysyłać wiadomości na kanale wywoławczym. Daj mu opcję Wyświetl kanał, wysyłaj wiadomości, osadzaj linki, dołączaj pliki i czytaj tam historię wiadomości.",
            seed_role_missing: "Wybrana rola już nie istnieje w Discord.",
            seed_role_not_mentionable:
                "Bot nie może pingować roli. Włącz opcję „Pozwól każdemu na @wzmiankę o tej roli” lub daj botowi wzmiankę @wszystkim.",
            seed_role_unmanageable:
                "Bot nie może przypisać roli. Daj mu opcję Zarządzaj rolami i przenieś jej rolę nad wybraną rolę.",
            control_channel_unpublishable:
                "Bot nie może wysyłać postów w kanale kontrolnym. Daj mu opcję Wyświetl kanał, wysyłaj wiadomości i czytaj tam historię wiadomości.",
            control_channel_public:
                "Każdy może zobaczyć kanał sterujący. Wybierz kanał @everyone mogą oglądać.",
            verification_unavailable:
                "Discord nie odpowiada, więc nie można sprawdzić kanałów. Spróbuj ponownie wkrótce.",
        },
        issues: {
            invalid: "Sprawdź tę wartość.",
            start_below_not_under_live:
                "Próg początkowy musi być niższy niż próg na żywo.",
            auto_below_above_start:
                "Automatyczny start może wynosić co najwyżej próg startu.",
            auto_window_empty:
                "Okno musi zaczynać się i kończyć o różnych porach.",
            schedule_without_slots:
                "Dodaj co najmniej jeden raz do harmonogramu.",
            duplicate_day: "Dany dzień występuje w harmonogramie dwukrotnie.",
            duplicate_slot: "Ten dzień i godzina są już w harmonogramie.",
            seed_channel_required: "Włączony plan wymaga kanału wywoławczego.",
            control_channel_same_as_seed:
                "Kanał kontrolny musi różnić się od kanału wywoławczego.",
            unknown_placeholder:
                "Tekst zawiera nieznane pole w nawiasach klamrowych.",
            live_above_capacity: "Serwer ma mniej miejsc niż próg działania.",
        },
        save: {
            note: "Zapisuje plan {server} i kanał sterujący.",
            unsaved: {
                one: "{count} niezapisana zmiana",
                few: "{count} niezapisane zmiany",
                many: "{count} niezapisanych zmian",
                other: "{count} niezapisanych zmian",
            },
            discard: "Odrzuć zmiany",
            save: "Zapisz",
            saving: "Zapisywanie…",
            saved: "Plan został zapisany.",
            reload: "Wczytaj ponownie",
            conflict:
                "W międzyczasie ktoś inny zmienił plan. Załaduj ponownie stronę i ponownie wprowadź zmiany.",
            failed: "Nie można zapisać planu.",
        },
        history: {
            title: "Historia Seeding · {server}",
            summary:
                "Ostatnie dni {days} · {count} · średnio {average} do gry na żywo",
            summaryNoLive: "Ostatnie {days} dni · {count}",
            seeds: {
                one: "Akcje seedingu: {count}",
                few: "Akcje seedingu: {count}",
                many: "Akcje seedingu: {count}",
                other: "Akcje seedingu: {count}",
            },
            empty: "Brak seedingu w ostatnich 30 dniach.",
            columns: {
                start: "Start",
                trigger: "Rozpoczęty przez",
                players: "Gracze na początku → na końcu",
                result: "Wynik",
                duration: "Czas trwania",
                pinged: "Pingowano",
            },
            trigger: {
                schedule: "Plan {slot}",
                auto: "Automatycznie · poniżej {count}",
                web: "{name} · ręcznie w Internecie",
                discord: "{name} · przycisk w {channel}",
                discordNoChannel: "{name} · przycisk w Discord",
            },
            outcome: {
                live: "Na żywo",
                timeout: "Nie osiągnięto progu",
                admin: "Zakończone przez administratora",
                failed: "Niepowodzenie",
                running: "Działa",
            },
            endedSuffix: "zakończyło się",
            pinged: "{count} · {role}",
            silentWindow: "0 · zabezpieczenie {hours} godz",
            silentNoRole: "0 · brak roli",
            unknownRole: "@rola",
            units: { hours: "h", minutes: "min" },
        },
    },
} as const
