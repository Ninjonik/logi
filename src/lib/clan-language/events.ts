import { clanCopy, type ClanLanguage } from "./core"

/** Match announcements, rosters, forum posts, reminders, recaps and the DMs that go with them. */
export type EventMessages = {
    buttons: {
        acknowledgeAttendance: string
        attend: string
        generalSignup: string
        checkSignup: string
        addToCalendar: string
        viewFullRoster: string
        decline: string
        openRegistrationChannel: string
        openEventForum: string
        confirmShort: string
        cannotCome: string
        matchDetail: string
    }
    interaction: {
        unableToLoadEventContext: string
        signupServerOnly: string
        registrationClosed: string
        invalidSignupButton: string
        noCompatibleSignupGroup: string
        unableToResolveMembership: string
        missingRequiredRole: string
        membershipStatusNotAllowed: string
        signupUpdated: string
        signupUpdatedWithType: string
        signupRemovedWithType: string
        markedNotAttending: string
        /** `{group}`: a capped signup group that was already full. */
        groupFullReserve: string
        changeSignupSelection: string
        attendanceNotOpen: string
        rosterNotPublished: string
        notOnRoster: string
        attendanceAcknowledged: string
        signupStatusSignedUp: string
        signupStatusNotSignedUp: string
    }
    reminders: {
        title: string
        body: string
        meeting: string
        assignment: string
        notes: string
        eventThread: string
        openInDiscord: string
        upcomingTitle: string
        upcomingTitleToday: string
        upcomingTitleTomorrow: string
        upcomingHint: string
        start: string
    }
    embed: {
        map: string
        side: string
        teams: string
        cap: string
        server: string
        password: string
        description: string
        registrationEnds: string
        meeting: string
        headcountStart: string
        briefingStart: string
        chooseSignup: string
        runningLate: string
        lateNoticeTitle: string
        lateNoticeLabel: string
        myAssignment: string
        assignmentReserve: string
        assignmentUnassigned: string
        matchStart: string
        trainingStart: string
        status: string
        signupCount: string
        eventForum: string
        managedFooter: string
        nobodyYet: string
        notAttending: string
        attending: string
        meetingAt: string
        registrationCloses: string
        signedUpTotal: string
        withoutGroup: string
        managedShort: string
    }
    forum: {
        matchInformation: string
        noExtraNotes: string
        map: string
        side: string
        cap: string
        server: string
        serverPassword: string
        gameStart: string
        notSet: string
        managedFooter: string
        debrief: string
        debriefTitle: string
        debriefDescription: string
        passwordInAssignment: string
    }
    assignment: {
        reserveTitle: string
        squadLeader: string
        meeting: string
        meetingInChannel: string
        server: string
        serverPassword: string
        passwordNotice: string
    }
    attendanceDecline: {
        modalTitle: string
        reasonLabel: string
        reasonPlaceholder: string
        defaultReason: string
        saved: string
        alreadySaved: string
        tooLate: string
    }
    factions: { allies: string; axis: string }
    mapLabels: {
        times: Record<
            | "day"
            | "morning"
            | "dusk"
            | "evening"
            | "night"
            | "rain"
            | "overcast",
            string
        >
        modes: Record<"offensive" | "skirmish" | "koth", string>
    }
    rosterSummary: {
        title: string
        meeting: string
        meetingInChannel: string
        players: { one: string; few: string; many: string; other: string }
    }
    statuses: {
        registration: string
        closed: string
        starting: string
        concluded: string
    }
    training: {
        resultPassed: string
        resultFailed: string
        rewardGranted: string
        dmResult: string
    }
    matchRecap: {
        title: string
        fallbackMapName: string
        stats: string
        comparisonTitle: string
        comparisonWithPrevious: string
        noComparisonAvailable: string
        viewStats: string
        unsubscribe: string
        subscribe: string
        subscribed: string
        unsubscribed: string
        invalidAction: string
    }
    rosterUpdate: {
        announcementTitle: string
        addedLabel: string
        removedLabel: string
        movedLabel: string
        roleChangedLabel: string
        dmIntro: string
        dmAdded: string
        dmRemoved: string
        dmMoved: string
        dmRoleChanged: string
    }
    scheduledEvent: {
        map: string
        side: string
        cap: string
        server: string
        password: string
        managedFallback: string
    }
    rosterImage: {
        roster: string
        unknown: string
        server: string
        password: string
        meeting: string
        matchStart: string
        stats: string
        assigned: string
        cap: string
        reserves: string
        noReserves: string
        details: string
        description: string
        notes: string
        openSlot: string
        slots: string
    }
}

const eventsMessages: Record<ClanLanguage, EventMessages> = {
    en: {
        buttons: {
            acknowledgeAttendance: "I'll be there",
            attend: "Attend",
            generalSignup: "Sign up",
            checkSignup: "My sign-up",
            addToCalendar: "Add to Calendar",
            viewFullRoster: "Full roster on the web",
            decline: "Can't make it",
            openRegistrationChannel: "Open registration channel",
            openEventForum: "Open event forum",
            confirmShort: "I'll be there",
            cannotCome: "Can't make it",
            matchDetail: "Match details",
        },
        interaction: {
            unableToLoadEventContext: "Unable to load event context.",
            signupServerOnly:
                "Signup buttons can only be used from the server event message.",
            registrationClosed:
                "Registration is already closed for this event.",
            invalidSignupButton: "That signup button is no longer valid.",
            noCompatibleSignupGroup:
                "No compatible assigned group was found. Choose a signup group manually below.",
            unableToResolveMembership:
                "Unable to resolve your server membership.",
            missingRequiredRole:
                "You do not have the required Discord role for this signup.",
            membershipStatusNotAllowed:
                "Your membership status is not allowed to sign up for this match.",
            signupUpdated: "Signup updated.",
            signupUpdatedWithType: "You are signed up as {type}.",
            signupRemovedWithType: "Removed signup from {type}.",
            markedNotAttending: "Marked as not attending.",
            groupFullReserve:
                "{group} is full, so you are signed up as a reserve without a group.",
            changeSignupSelection:
                "You are already signed up. Use the selector below only to change your role; choosing the same role keeps your signup.",
            attendanceNotOpen:
                "Attendance acknowledgement is not open right now.",
            rosterNotPublished: "Roster is not published for this event yet.",
            notOnRoster: "You are not on the roster for this event.",
            attendanceAcknowledged: "Attendance acknowledged.",
            signupStatusSignedUp: "You are signed up for {group}.",
            signupStatusNotSignedUp: "You are not signed up for this event.",
        },
        reminders: {
            title: "Attendance check for",
            body: "Please acknowledge before the meeting if you can still make it.",
            meeting: "Meeting",
            assignment: "Your roster assignment",
            notes: "Notes",
            eventThread: "Event thread",
            openInDiscord: "open in Discord",
            upcomingTitle: "You're playing {event}",
            upcomingTitleToday: "You're playing {event} today",
            upcomingTitleTomorrow: "You're playing {event} tomorrow",
            upcomingHint: "Confirm so command knows who to count on.",
            start: "start",
        },
        embed: {
            map: "Map",
            side: "Side",
            teams: "Teams",
            cap: "Cap",
            server: "Server",
            password: "Password",
            description: "Description",
            registrationEnds: "Registration Ends",
            meeting: "Headcount / Meeting",
            headcountStart: "Headcount Start",
            briefingStart: "Briefing Start",
            chooseSignup: "Sign up",
            runningLate: "Running late",
            lateNoticeTitle: "Running late",
            lateNoticeLabel: "Expected arrival and note",
            myAssignment: "My assignment",
            assignmentReserve: "You are a reserve for this event.",
            assignmentUnassigned: "You do not have a roster assignment yet.",
            matchStart: "Match Start",
            trainingStart: "Training Start",
            status: "Status",
            signupCount: "People signed up",
            eventForum: "Event forum",
            managedFooter: "Managed via Logi • Times adapt to your device",
            nobodyYet: "*Nobody yet*",
            notAttending: "Not Attending",
            attending: "Attending",
            meetingAt: "meeting {time}",
            registrationCloses: "sign-ups close {time}",
            signedUpTotal: "Signed up {count}",
            withoutGroup: "No group",
            managedShort: "Managed in Logi",
        },
        forum: {
            matchInformation: "Match information",
            noExtraNotes: "No extra notes yet.",
            map: "Map",
            side: "Side",
            cap: "Cap",
            server: "Server",
            serverPassword: "Server password",
            gameStart: "Game start",
            notSet: "Not set",
            managedFooter: "Managed from Logi in",
            debrief: "Debrief",
            debriefTitle: "Debrief",
            debriefDescription:
                "Use this thread for after-action notes, lessons learned, and follow-up discussion.",
            passwordInAssignment:
                "Shown only to rostered players under “My assignment”",
        },
        assignment: {
            reserveTitle: "Reserve",
            squadLeader: "Squad leader",
            meeting: "meeting {time}",
            meetingInChannel: "meeting {time} in {channel}",
            server: "Server: {server}",
            serverPassword: "password {password}",
            passwordNotice: "Only players on the roster can see the password.",
        },
        attendanceDecline: {
            modalTitle: "Can't make it",
            reasonLabel: "Reason (only the organisers see it)",
            reasonPlaceholder: "e.g. ill, working late",
            defaultReason: "Can't make it",
            saved: "Thanks, the organisers know you can't make it and will fill your slot.",
            alreadySaved: "The organisers already know you can't make it.",
            tooLate:
                "The match has already started. Tell the organisers directly.",
        },
        factions: { allies: "Allies", axis: "Axis" },
        mapLabels: {
            times: {
                day: "day",
                morning: "morning",
                dusk: "dusk",
                evening: "evening",
                night: "night",
                rain: "rain",
                overcast: "overcast",
            },
            modes: {
                offensive: "offensive",
                skirmish: "skirmish",
                koth: "KOTH",
            },
        },
        rosterSummary: {
            title: "Roster · {event}",
            meeting: "Meeting {time}",
            meetingInChannel: "Meeting {time} in {channel}",
            players: {
                one: "{count} player",
                few: "{count} players",
                many: "{count} players",
                other: "{count} players",
            },
        },
        statuses: {
            registration: "Registration",
            closed: "Closed",
            starting: "Starting",
            concluded: "Concluded",
        },
        training: {
            resultPassed: "passed",
            resultFailed: "did not pass",
            rewardGranted: "Reward roles have been granted in Discord.",
            dmResult:
                "Hi {name}, your training result for **{event}** is: {result}.{reward}",
        },
        matchRecap: {
            title: "Match recap - {event}",
            fallbackMapName: "Match",
            stats: "**{kills}** kills / **{deaths}** deaths / **{kd}** K/D",
            comparisonTitle: "Compared with previous matches",
            comparisonWithPrevious:
                "Previous {matches} matches avg: {kills} kills / {deaths} deaths / {kd} K/D",
            noComparisonAvailable: "No prior recorded matches to compare yet.",
            viewStats: "View public match stats",
            unsubscribe: "Unsubscribe from recaps",
            subscribe: "Subscribe to recaps",
            subscribed: "You are subscribed to match recaps again.",
            unsubscribed: "You are unsubscribed from match recaps.",
            invalidAction:
                "This match recap control is invalid. Open your account settings to change notifications.",
        },
        rosterUpdate: {
            announcementTitle: "Roster update",
            addedLabel: "Starting XI additions",
            removedLabel: "Dropped from the lineup",
            movedLabel: "Squad switches",
            roleChangedLabel: "Role changes",
            dmIntro:
                "Hi {name}, the published roster for **{event}** has been updated.",
            dmAdded: "✅ You are in the lineup now.",
            dmRemoved: "❌ You are no longer in the lineup.",
            dmMoved: "🔁 Your squad assignment changed.",
            dmRoleChanged: "🎯 Your role changed.",
        },
        scheduledEvent: {
            map: "Map",
            side: "Side",
            cap: "Cap",
            server: "Server",
            password: "Password",
            managedFallback: "Managed by Logi.",
        },
        rosterImage: {
            roster: "Roster",
            unknown: "Unknown",
            server: "Server",
            password: "Password",
            meeting: "Meeting",
            matchStart: "Match Start",
            stats: "Stats",
            assigned: "assigned",
            cap: "Cap",
            reserves: "Reserves",
            noReserves: "No reserves",
            details: "Details",
            description: "Description",
            notes: "Notes",
            openSlot: "Open slot",
            slots: "slots",
        },
    },
    cs: {
        buttons: {
            checkSignup: "Moje přihláška",
            acknowledgeAttendance: "Potvrdím účast",
            attend: "Zúčastním se",
            generalSignup: "Přihlásit se",
            addToCalendar: "Do kalendáře",
            viewFullRoster: "Celá soupiska na webu",
            decline: "Nepřijdu",
            openRegistrationChannel: "Otevřít registrační kanál",
            openEventForum: "Otevřít fórum akce",
            confirmShort: "Potvrdím",
            cannotCome: "Nemůžu",
            matchDetail: "Detail zápasu",
        },
        interaction: {
            signupStatusSignedUp:
                "Jste p\u0159ihl\u00e1\u0161eni do skupiny {group}.",
            signupStatusNotSignedUp:
                "Na tuto akci nejste p\u0159ihl\u00e1\u0161eni.",
            unableToLoadEventContext: "Nepodařilo se načíst kontext akce.",
            signupServerOnly:
                "Tlačítka přihlášení fungují pouze u zprávy akce na serveru.",
            registrationClosed: "Registrace na tuto akci je již uzavřena.",
            invalidSignupButton: "Toto tlačítko přihlášení už není platné.",
            noCompatibleSignupGroup:
                "Nenalezena žádná kompatibilní přiřazená skupina. Vyberte si skupinu pro přihlášení ručně níže.",
            unableToResolveMembership:
                "Nepodařilo se ověřit vaše členství na serveru.",
            missingRequiredRole:
                "Pro toto přihlášení nemáte požadovanou Discord roli.",
            membershipStatusNotAllowed:
                "Váš status členství se na tento zápas nemůže přihlásit.",
            signupUpdated: "Přihlášení bylo upraveno.",
            signupUpdatedWithType: "Jste přihlášeni jako {type}.",
            signupRemovedWithType: "Odhlášeno z {type}.",
            markedNotAttending: "Označeno jako neúčast.",
            groupFullReserve:
                "Skupina {group} je plná, proto jsi přihlášen jako záloha bez skupiny.",
            changeSignupSelection:
                "Už jste přihlášeni. Výběr níže použijte jen pro změnu role;",
            attendanceNotOpen: "Potvrzování účasti teď není otevřené.",
            rosterNotPublished:
                "Soupiska pro tuto akci ještě není publikovaná.",
            notOnRoster: "Na soupisce této akce nejste.",
            attendanceAcknowledged: "Účast byla potvrzena.",
        },
        reminders: {
            title: "Kontrola účasti pro",
            body: "Prosím potvrďte účast před srazem, pokud stále můžete dorazit.",
            meeting: "Sraz",
            assignment: "Vaše zařazení do soupisky",
            notes: "Poznámky",
            eventThread: "Vlákno akce",
            openInDiscord: "otevřít na Discordu",
            upcomingTitle: "Hraješ {event}",
            upcomingTitleToday: "Dnes hraješ {event}",
            upcomingTitleTomorrow: "Zítra hraješ {event}",
            upcomingHint: "Potvrď, ať velení ví, s kým počítat.",
            start: "start",
        },
        embed: {
            signupCount: "Počet přihlášených",
            map: "Mapa",
            side: "Strana",
            teams: "Týmy",
            cap: "Cap",
            server: "Server",
            password: "Heslo",
            description: "Popis",
            registrationEnds: "Konec registrace",
            meeting: "Sraz / Headcount",
            headcountStart: "Začátek headcountu",
            briefingStart: "Začátek briefingu",
            chooseSignup: "Přihlásit se",
            runningLate: "Přijdu později",
            lateNoticeTitle: "Přijdu později",
            lateNoticeLabel: "Předpokládaný příchod a poznámka",
            myAssignment: "Moje zařazení",
            assignmentReserve: "Pro tuto akci jste náhradník.",
            assignmentUnassigned: "Zatím nemáte zařazení do soupisky.",
            matchStart: "Start zápasu",
            trainingStart: "Začátek trainingu",
            status: "Stav",
            eventForum: "Forum akce",
            managedFooter:
                "Spravováno přes Logi • Časy se přizpůsobí vašemu zařízení",
            nobodyYet: "*Zatím nikdo*",
            notAttending: "Neúčastní se",
            attending: "Účastní se",
            meetingAt: "sraz {time}",
            registrationCloses: "přihlášky končí {time}",
            signedUpTotal: "Přihlášeno {count}",
            withoutGroup: "Bez skupiny",
            managedShort: "Spravováno v Logi",
        },
        forum: {
            matchInformation: "Informace o zápasu",
            noExtraNotes: "Zatím žádné další poznámky.",
            map: "Mapa",
            side: "Strana",
            cap: "Cap",
            server: "Server",
            serverPassword: "Heslo na server",
            gameStart: "Start zápasu",
            notSet: "Nenastaveno",
            managedFooter: "Spravováno z Logi v pásmu",
            debrief: "Debrief",
            debriefTitle: "Debrief",
            debriefDescription:
                "Použijte toto vlákno pro poznámky po akci, zjištěné zkušenosti a navazující diskuzi.",
            passwordInAssignment:
                "Vidí jen hráči na soupisce v „Moje zařazení“",
        },
        assignment: {
            reserveTitle: "Záloha",
            squadLeader: "Velitel čety",
            meeting: "sraz {time}",
            meetingInChannel: "sraz {time} v kanálu {channel}",
            server: "Server: {server}",
            serverPassword: "heslo {password}",
            passwordNotice: "Heslo vidí jen hráči na soupisce.",
        },
        attendanceDecline: {
            modalTitle: "Nemůžu přijít",
            reasonLabel: "Důvod (uvidí jen velení)",
            reasonPlaceholder: "Např. nemoc, práce",
            defaultReason: "Nemůže přijít",
            saved: "Díky, velení ví, že nedorazíš, a tvoje místo obsadí.",
            alreadySaved: "Velení už ví, že nedorazíš.",
            tooLate: "Zápas už začal. Napiš velení přímo.",
        },
        factions: { allies: "Spojenci", axis: "Osa" },
        mapLabels: {
            times: {
                day: "den",
                morning: "ráno",
                dusk: "soumrak",
                evening: "večer",
                night: "noc",
                rain: "déšť",
                overcast: "zataženo",
            },
            modes: {
                offensive: "ofenziva",
                skirmish: "skirmish",
                koth: "KOTH",
            },
        },
        rosterSummary: {
            title: "Soupiska · {event}",
            meeting: "Sraz {time}",
            meetingInChannel: "Sraz {time} v kanálu {channel}",
            players: {
                one: "{count} hráč",
                few: "{count} hráči",
                many: "{count} hráče",
                other: "{count} hráčů",
            },
        },
        statuses: {
            registration: "Registrace",
            closed: "Uzavřeno",
            starting: "Začíná",
            concluded: "Ukončeno",
        },
        training: {
            resultPassed: "prošel",
            resultFailed: "neprošel",
            rewardGranted: "Odměnové role vám byly přiděleny na Discordu.",
            dmResult:
                "Ahoj {name}, výsledek tvého trainingu **{event}** je: {result}.{reward}",
        },
        matchRecap: {
            title: "Shrnutí zápasu - {event}",
            fallbackMapName: "Zápas",
            stats: "**{kills}** zabití / **{deaths}** úmrtí / **{kd}** K/D",
            comparisonTitle: "Srovnání s předchozími zápasy",
            comparisonWithPrevious:
                "Průměr z předchozích {matches} zápasů: {kills} zabití / {deaths} úmrtí / {kd} K/D",
            noComparisonAvailable:
                "Zatím nejsou k dispozici žádné předchozí zaznamenané zápasy pro srovnání.",
            viewStats: "Zobrazit veřejné statistiky zápasu",
            unsubscribe: "Odhlásit shrnutí",
            subscribe: "Přihlásit shrnutí",
            subscribed: "Jsi znovu přihlášen k odběru shrnutí zápasů.",
            unsubscribed: "Jsi odhlášen z odběru shrnutí zápasů.",
            invalidAction:
                "Toto tlačítko shrnutí není platné. Upozornění můžeš změnit v nastavení účtu.",
        },
        rosterUpdate: {
            announcementTitle: "Aktualizace soupisky",
            addedLabel: "Nově v sestavě",
            removedLabel: "Vyřazeni ze sestavy",
            movedLabel: "Přesuny mezi squadami",
            roleChangedLabel: "Změny rolí",
            dmIntro:
                "Ahoj {name}, publikovaná soupiska pro **{event}** byla upravena.",
            dmAdded: "✅ Teď jsi v sestavě.",
            dmRemoved: "❌ Už nejsi v sestavě.",
            dmMoved: "🔁 Změnilo se tvoje zařazení do squadu.",
            dmRoleChanged: "🎯 Změnila se tvoje role.",
        },
        scheduledEvent: {
            map: "Mapa",
            side: "Strana",
            cap: "Cap",
            server: "Server",
            password: "Heslo",
            managedFallback: "Spravováno přes Logi.",
        },
        rosterImage: {
            roster: "Soupiska",
            unknown: "Neznámé",
            server: "Server",
            password: "Heslo",
            meeting: "Sraz",
            matchStart: "Start zápasu",
            stats: "Statistiky",
            assigned: "obsazeno",
            cap: "Cap",
            reserves: "Zálohy",
            noReserves: "Bez záloh",
            details: "Detaily",
            description: "Popis",
            notes: "Poznámky",
            openSlot: "Volný slot",
            slots: "slotů",
        },
    },
    de: {
        buttons: {
            acknowledgeAttendance: "Ich bin dabei",
            attend: "Teilnehmen",
            generalSignup: "Anmelden",
            checkSignup: "Meine Anmeldung",
            addToCalendar: "Zum Kalender",
            viewFullRoster: "Ganze Aufstellung im Web",
            decline: "Ich komme nicht",
            openRegistrationChannel: "Anmeldekanal öffnen",
            openEventForum: "Event-Forum öffnen",
            confirmShort: "Bin dabei",
            cannotCome: "Kann nicht",
            matchDetail: "Spieldetails",
        },
        interaction: {
            unableToLoadEventContext:
                "Der Event-Kontext konnte nicht geladen werden.",
            signupServerOnly:
                "Anmelde-Buttons können nur über die Event-Nachricht auf dem Server verwendet werden.",
            registrationClosed:
                "Die Anmeldung für dieses Event ist bereits geschlossen.",
            invalidSignupButton: "Dieser Anmelde-Button ist nicht mehr gültig.",
            noCompatibleSignupGroup:
                "Keine kompatible zugewiesene Gruppe gefunden. Wählen Sie unten manuell eine Anmeldegruppe.",
            unableToResolveMembership:
                "Ihre Server-Mitgliedschaft konnte nicht ermittelt werden.",
            missingRequiredRole:
                "Ihnen fehlt die erforderliche Discord-Rolle für diese Anmeldung.",
            membershipStatusNotAllowed:
                "Ihr Mitgliedschaftsstatus darf sich für dieses Match nicht anmelden.",
            signupUpdated: "Anmeldung aktualisiert.",
            signupUpdatedWithType: "Sie sind als {type} angemeldet.",
            signupRemovedWithType: "Anmeldung für {type} entfernt.",
            markedNotAttending: "Als nicht teilnehmend markiert.",
            groupFullReserve:
                "{group} ist voll, deshalb bist du als Reserve ohne Gruppe angemeldet.",
            changeSignupSelection:
                "Sie sind bereits angemeldet. Nutzen Sie die Auswahl unten nur, um Ihre Rolle zu ändern; bei gleicher Rolle bleibt Ihre Anmeldung bestehen.",
            attendanceNotOpen:
                "Die Anwesenheitsbestätigung ist derzeit nicht geöffnet.",
            rosterNotPublished:
                "Das Roster für dieses Event ist noch nicht veröffentlicht.",
            notOnRoster: "Sie stehen nicht auf dem Roster für dieses Event.",
            attendanceAcknowledged: "Anwesenheit bestätigt.",
            signupStatusSignedUp: "Sie sind für {group} angemeldet.",
            signupStatusNotSignedUp:
                "Sie sind für dieses Event nicht angemeldet.",
        },
        reminders: {
            title: "Anwesenheitskontrolle für",
            body: "Bitte bestätigen Sie vor dem Meeting, ob Sie es noch schaffen.",
            meeting: "Meeting",
            assignment: "Ihre Roster-Zuweisung",
            notes: "Notizen",
            eventThread: "Event-Thread",
            openInDiscord: "in Discord öffnen",
            upcomingTitle: "Du spielst {event}",
            upcomingTitleToday: "Heute spielst du {event}",
            upcomingTitleTomorrow: "Morgen spielst du {event}",
            upcomingHint:
                "Bestätige, damit die Führung weiß, mit wem sie rechnen kann.",
            start: "Start",
        },
        embed: {
            map: "Map",
            side: "Seite",
            teams: "Teams",
            cap: "Cap",
            server: "Server",
            password: "Passwort",
            description: "Beschreibung",
            registrationEnds: "Anmeldeschluss",
            meeting: "Headcount / Meeting",
            headcountStart: "Headcount-Start",
            briefingStart: "Briefing-Start",
            chooseSignup: "Anmelden",
            runningLate: "Komme später",
            lateNoticeTitle: "Komme später",
            lateNoticeLabel: "Voraussichtliche Ankunft und Notiz",
            myAssignment: "Meine Zuweisung",
            assignmentReserve: "Sie sind Ersatz (Reserve) für dieses Event.",
            assignmentUnassigned: "Sie haben noch keine Roster-Zuweisung.",
            matchStart: "Match-Start",
            trainingStart: "Trainings-Start",
            status: "Status",
            signupCount: "Angemeldete Personen",
            eventForum: "Event-Forum",
            managedFooter:
                "Verwaltet via Logi • Zeiten passen sich Ihrem Gerät an",
            nobodyYet: "*Noch niemand*",
            notAttending: "Nicht teilnehmend",
            attending: "Teilnehmend",
            meetingAt: "Treffen {time}",
            registrationCloses: "Anmeldung endet {time}",
            signedUpTotal: "Angemeldet {count}",
            withoutGroup: "Ohne Gruppe",
            managedShort: "Verwaltet in Logi",
        },
        forum: {
            matchInformation: "Match-Informationen",
            noExtraNotes: "Noch keine weiteren Notizen.",
            map: "Map",
            side: "Seite",
            cap: "Cap",
            server: "Server",
            serverPassword: "Server-Passwort",
            gameStart: "Spielstart",
            notSet: "Nicht festgelegt",
            managedFooter: "Verwaltet aus Logi in",
            debrief: "Debrief",
            debriefTitle: "Debrief",
            debriefDescription:
                "Nutzen Sie diesen Thread für Notizen nach dem Einsatz, Lessons Learned und die anschließende Diskussion.",
            passwordInAssignment:
                "Nur für Spieler auf der Aufstellung unter „Meine Zuweisung“",
        },
        assignment: {
            reserveTitle: "Reserve",
            squadLeader: "Truppführer",
            meeting: "Treffen {time}",
            meetingInChannel: "Treffen {time} in {channel}",
            server: "Server: {server}",
            serverPassword: "Passwort {password}",
            passwordNotice:
                "Das Passwort sehen nur Spieler auf der Aufstellung.",
        },
        attendanceDecline: {
            modalTitle: "Ich kann nicht kommen",
            reasonLabel: "Grund (sieht nur die Führung)",
            reasonPlaceholder: "z. B. krank, Arbeit",
            defaultReason: "Kann nicht kommen",
            saved: "Danke, die Führung weiß, dass du nicht kommst, und besetzt deinen Platz neu.",
            alreadySaved: "Die Führung weiß schon, dass du nicht kommst.",
            tooLate:
                "Das Match hat schon begonnen. Sag der Führung direkt Bescheid.",
        },
        factions: { allies: "Alliierte", axis: "Achsenmächte" },
        mapLabels: {
            times: {
                day: "Tag",
                morning: "Morgen",
                dusk: "Dämmerung",
                evening: "Abend",
                night: "Nacht",
                rain: "Regen",
                overcast: "bewölkt",
            },
            modes: {
                offensive: "Offensive",
                skirmish: "Skirmish",
                koth: "KOTH",
            },
        },
        rosterSummary: {
            title: "Aufstellung · {event}",
            meeting: "Treffen {time}",
            meetingInChannel: "Treffen {time} in {channel}",
            players: {
                one: "{count} Spieler",
                few: "{count} Spieler",
                many: "{count} Spieler",
                other: "{count} Spieler",
            },
        },
        statuses: {
            registration: "Anmeldung",
            closed: "Geschlossen",
            starting: "Beginnt",
            concluded: "Beendet",
        },
        training: {
            resultPassed: "bestanden",
            resultFailed: "nicht bestanden",
            rewardGranted: "Die Belohnungs-Rollen wurden in Discord vergeben.",
            dmResult:
                "Hallo {name}, Ihr Trainingsergebnis für **{event}** lautet: {result}.{reward}",
        },
        matchRecap: {
            title: "Spielzusammenfassung - {event}",
            fallbackMapName: "Spiel",
            stats: "**{kills}** Kills / **{deaths}** Tode / **{kd}** K/D",
            comparisonTitle: "Vergleich mit früheren Spielen",
            comparisonWithPrevious:
                "Durchschnitt der letzten {matches} Spiele: {kills} Kills / {deaths} Tode / {kd} K/D",
            noComparisonAvailable:
                "Es sind noch keine früheren gespeicherten Spiele zum Vergleichen vorhanden.",
            viewStats: "Öffentliche Spielstatistiken anzeigen",
            unsubscribe: "Zusammenfassungen abbestellen",
            subscribe: "Zusammenfassungen abonnieren",
            subscribed: "Du hast Spielzusammenfassungen wieder abonniert.",
            unsubscribed: "Du hast Spielzusammenfassungen abbestellt.",
            invalidAction:
                "Diese Schaltfläche ist ungültig. Ändere Benachrichtigungen in deinen Kontoeinstellungen.",
        },
        rosterUpdate: {
            announcementTitle: "Roster-Update",
            addedLabel: "Neuzugänge in der Startaufstellung",
            removedLabel: "Aus der Aufstellung gestrichen",
            movedLabel: "Squad-Wechsel",
            roleChangedLabel: "Rollenänderungen",
            dmIntro:
                "Hallo {name}, das veröffentlichte Roster für **{event}** wurde aktualisiert.",
            dmAdded: "✅ Sie sind jetzt in der Aufstellung.",
            dmRemoved: "❌ Sie sind nicht mehr in der Aufstellung.",
            dmMoved: "🔁 Ihre Squad-Zuweisung hat sich geändert.",
            dmRoleChanged: "🎯 Ihre Rolle hat sich geändert.",
        },
        scheduledEvent: {
            map: "Map",
            side: "Seite",
            cap: "Cap",
            server: "Server",
            password: "Passwort",
            managedFallback: "Verwaltet via Logi.",
        },
        rosterImage: {
            roster: "Roster",
            unknown: "Unbekannt",
            server: "Server",
            password: "Passwort",
            meeting: "Meeting",
            matchStart: "Match-Start",
            stats: "Stats",
            assigned: "belegt",
            cap: "Cap",
            reserves: "Reserven",
            noReserves: "Keine Reserven",
            details: "Details",
            description: "Beschreibung",
            notes: "Notizen",
            openSlot: "Offener Slot",
            slots: "Slots",
        },
    },
}

/** The events copy in the clan language; unknown languages read English. */
export const getEventMessages = clanCopy(eventsMessages)
