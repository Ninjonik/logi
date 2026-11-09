import type { PanelDefaultCopy } from "../../domain/membership/application-panel-copy"
import type { ApplicationCopy } from "../../domain/membership/application-copy"

import { clanCopy, type ClanLanguage } from "./core"

/**
 * The clan application in Discord windows (W7a: boards L6, L4 1.0–1.3, M3
 * 1.6, L2 1.8). Czech is verbatim from the boards; the bot says "ty" ("du").
 * Tickets and `/link` keep their copy in `membership.ts`.
 */
type Copy = Omit<ApplicationCopy, "locale">

const cs: Copy = {
    listAnd: "a",
    defaultForm: {
        source: {
            label: "Odkud o nás víš?",
            options: [
                "Od kamaráda z klanu",
                "Ze serveru klanu",
                "Z Discordu",
                "Odjinud",
            ],
        },
        age: { label: "Věk", placeholder: "Např. 24" },
        hours: {
            label: "Kolik hodin týdně hraješ?",
            placeholder: "Např. 10–15 hodin",
        },
        why: {
            label: "Proč chceš hrát s námi?",
            placeholder: "Pár vět stačí.",
        },
        specialization: {
            label: "Specializace",
            help: "Jen u Hell Let Loose.",
            options: ["Pěchota", "Tank", "Recon"],
        },
        when: {
            label: "Kdy obvykle hraješ?",
            help: "Můžeš vybrat víc možností.",
            options: ["Všední večery", "Víkendy"],
        },
        microphone: { label: "Máš mikrofon?" },
        previousClan: {
            label: "Ve kterém klanu jsi hrál dřív?",
            placeholder: "Nepovinné",
        },
        referrer: {
            label: "Kdo tě k nám pozval?",
            help: "Člen tohoto serveru.",
        },
    },
    panel: {
        apply: "Podat přihlášku",
        applyOnWeb: "Vyplnit přihlášku na webu",
        windowsNote: {
            two: "Přihláška má dvě krátká okna a zabere asi 2 minuty.",
            three: "Přihláška má tři krátká okna a zabere asi 3 minuty.",
        },
        defaultTitle: "Přidej se ke klanu {clan}",
        defaultTitleNoClan: "Přidej se k nám",
        defaultText: {
            two: "Vyber, jak s námi chceš hrát. Přihláška má dvě krátká okna a zabere pár minut.",
            three: "Vyber, jak s námi chceš hrát. Přihláška má tři krátká okna a zabere pár minut.",
        },
    },
    label: "Přihláška do klanu {clan}",
    step: "Krok {step} ze {total}",
    reviewStep: "Kontrola",
    windowTitle: "Přihláška · {step} ze {total} · {name}",
    windowTitleExtra: "Přihláška · {step}{suffix} · {name}",
    windowNames: {
        about: "O tobě",
        accounts: "Herní účty",
        questions: "Otázky klanu",
    },
    fields: {
        games: {
            label: "Hry",
            help: "Vyber jednu nebo obě.",
            placeholder: "Vyber hry",
        },
        category: {
            label: "Kategorie",
            help: "Jak s námi chceš hrát.",
            placeholder: "Vyber kategorii",
        },
        name: { label: "Herní jméno", help: "Přesně jak ho vidíš ve hře." },
        previous: {
            label: "Našli jsme tě na serverech klanu?",
            help: "Podle herního jména {name} z prvního okna.",
            none: "Nic z toho",
            noneHelp: "Účet zadám níž",
            seen: "{platform} · naposledy {date} na {server}",
            seenNoServer: "{platform} · naposledy {date}",
        },
        steam: {
            label: "Steam ID nebo odkaz na profil",
            help: "17 číslic začínajících 7656119, nebo odkaz steamcommunity.com/profiles/…",
        },
        epic: { label: "Epic Account ID", placeholder: "Nepovinné" },
        xbox: { label: "Xbox", placeholder: "Nepovinné" },
        playstation: { label: "PlayStation", placeholder: "Nepovinné" },
        selectPlaceholder: "Vyber možnost",
        memberPlaceholder: "Vyber člena",
        optional: "Nepovinné",
        yes: "Ano",
        no: "Ne",
    },
    platforms: {
        steam: "Steam",
        epic: "Epic",
        xbox: "Xbox",
        playstation: "PlayStation",
        other: "Účet",
    },
    progress: {
        intro: {
            about: "První okno se zeptá na hry, kategorii a herní jméno.",
            accounts:
                "Další okno se zeptá na Steam, Epic nebo konzoli. Stačí jeden účet.",
            questions: "Další okno má otázky klanu.",
            questionsMore: "Další okno má zbylé otázky klanu.",
        },
        done: "hotovo",
        fix: "opravit",
        steamVerified: "✓ Steam ověřen",
        accountsPending:
            "Steam si můžeš ověřit přes web. Pak ho v okně nemusíš opisovat.",
        accountsVerified: "Steam {id} · v okně už je vyplněný",
        accountsLocked:
            "Steam si ověř přes web; ruční Steam ID tu nejde. Konzoli a Epic zadáš v okně.",
        questionsCount: {
            one: "{count} otázka, pak kontrola",
            few: "{count} otázky, pak kontrola",
            other: "{count} otázek, pak kontrola",
        },
        ageValue: "{value} let",
        continue: "Pokračovat",
        edit: "Upravit",
        cancel: "Zrušit",
        verifySteam: "Ověřit Steam přes web (doporučeno)",
        verifySteamRequired: "Ověřit Steam přes web",
        findAccount: "Najít ID účtu",
        keepNote: "Rozpracovanou přihlášku držíme 24 h.",
    },
    review: {
        title: "Zkontroluj a odešli",
        submit: "Odeslat přihlášku",
        cancel: "Zrušit",
        note: "Rozpracovanou přihlášku držíme 24 h, pak se smaže. Nábor uvidí přihlášku až po odeslání.",
        games: "Hry",
        category: "Kategorie",
        name: "Herní jméno",
    },
    summaryLabels: {
        source: "Odkud",
        age: "Věk",
        referrer: "Pozval",
        specialization: "Specializace",
    },
    fixTitle: {
        about: "Oprav údaje o sobě",
        accounts: "Oprav herní účty",
        questions: "Oprav odpovědi",
    },
    fixButton: {
        about: "Opravit údaje o sobě",
        accounts: "Opravit herní účty",
        questions: "Opravit odpovědi",
    },
    issues: {
        required: "{field}: tohle pole je povinné.",
        number: "{field}: napiš číslo.",
        tooLong: "{field}: odpověď je moc dlouhá.",
        choice: "{field}: vyber jednu z nabídnutých možností.",
        tooFew: "{field}: vyber víc možností.",
        tooMany: "{field}: vyber méně možností.",
        member: "{field}: vyber člena tohoto serveru.",
        steam: "Steam ID nevypadá správně. Má 17 číslic a začíná 7656119.",
        accountMissing: "Vyplň aspoň jeden herní účet.",
        unknown: "Okno se mezitím změnilo. Vyplň ho prosím znovu.",
    },
    sent: {
        title: "Přihláška odeslána",
        body: "Nábor se ti ozve ve vlákně {thread}. Rozhodnutí ti přijde i do DM.",
        openThread: "Otevřít vlákno",
    },
    cancelled: {
        title: "Přihláška zrušena",
        body: "Nic se neodeslalo. Novou začneš tlačítkem Podat přihlášku v {channel}.",
    },
    expired: {
        title: "Tenhle průvodce už vypršel",
        body: "Rozpracované odpovědi se neuložily. Začni znovu tlačítkem Podat přihlášku v {channel}.",
    },
    windowExpired: {
        title: "Okno se zavřelo dřív, než jsi ho odeslal",
        body: "Uložené kroky zůstaly: {steps}. Pokračuj tam, kde jsi skončil, okno {window} vyplň znovu.",
        bodyNothing: "Zatím se nic neuložilo. Začni oknem {window}.",
        continue: "Pokračovat",
    },
    alreadyInClan: {
        title: "V klanu {clan} už jsi",
        body: "Když chceš změnit roli nebo kategorii, napiš správcům přes ticket v {tickets}.",
        bodyNoTickets:
            "Když chceš změnit roli nebo kategorii, napiš správcům klanu.",
    },
    openApplication: {
        title: "Už máš otevřenou přihlášku #{number}",
        body: "Počkej, až o ní nábor rozhodne. Zprávu dostaneš do DM.",
        open: "Otevřít vlákno",
    },
    closed: {
        title: "Přihlášky jsou teď zavřené",
        body: "Zkus to později, nebo se zeptej správců v {channel}.",
        bodyNoChannel: "Zkus to později, nebo se zeptej správců klanu.",
    },
    sendFailed: {
        title: "Přihlášku se nepodařilo odeslat",
        body: "Nic se neuložilo. Správci dostali upozornění; zkus to prosím za chvíli znovu.",
    },
    threadName: "přihláška-{name}",
    closedThreadName: "uzavřeno · {name}",
    welcome: {
        withRoles:
            "Ahoj {applicant}, díky za přihlášku. {support_roles} se ti brzy ozve.",
        withoutRoles:
            "Ahoj {applicant}, díky za přihlášku. Nábor se ti brzy ozve.",
    },
    card: {
        label: "Přihláška #{number} · {games}",
        closedLabel: "Přihláška #{number} · uzavřena",
        title: "{name} · {category}",
        pending: "Čeká na rozhodnutí",
        submitted: "podáno {time}",
        inGameName: "herní jméno {name}",
        accounts: "Účty",
        source: "Odkud o nás ví",
        invitedBy: "pozval {member}",
        undecided: "Ještě nerozhodnuto · {name}, {time}",
        undecidedNote:
            "Vlákno zůstává otevřené, uchazeč nic nedostane. Tlačítka zůstávají.",
        deciders: "Rozhodnout můžou {roles} a správci Logi",
        decidersAdmins: "Rozhodnout můžou správci Logi",
        accept: {
            member: "Přijmout jako člena",
            recruit: "Přijmout jako rekruta",
            mercenary: "Přijmout jako žoldáka",
        },
        reject: "Zamítnout…",
        undecidedButton: "Ještě nerozhodnuto",
        mercenaryUnavailable:
            "Žoldáka zatím nejde přijmout: klan nemá kategorii žoldáků.",
        decidedTitle: {
            member: "{name} je přijatý jako Člen",
            recruit: "{name} je přijatý jako Rekrut",
            mercenary: "{name} je přijatý jako Žoldák",
            pending: "{name} čeká na rozhodnutí",
            denied: "{name} nebyl přijatý",
        },
        outcome: {
            member: "Člen",
            recruit: "Rekrut",
            mercenary: "Žoldák",
            pending: "Čeká na rozhodnutí",
            denied: "Zamítnuto",
        },
        rolesPending: "Role se přidávají",
        decidedBy: "Rozhodl {member} · {time}",
        rolesAdd: {
            one: "Roli {roles} přidá Logi do minuty.",
            other: "Role {roles} přidá Logi do minuty.",
        },
        rolesRemove: {
            one: "Roli {roles} odebere Logi do minuty.",
            other: "Role {roles} odebere Logi do minuty.",
        },
        closedFooter: "Vlákno je zamčené a archivované",
    },
    rejectModal: {
        title: "Zamítnout přihlášku #{number}",
        body: "{name} dostane důvod do DM. Vlákno se pak zamkne a archivuje.",
        reason: "Důvod",
        reasonHelp: "Uvidí ho uchazeč.",
        reasonPlaceholder:
            "Např. teď nenabíráme do zálohy, zkus to v listopadu.",
    },
    decision: {
        notAllowed: {
            title: "O přihlášce rozhoduje nábor",
            body: "Přihlášky kategorie {category} vyřizuje {roles} nebo správci Logi.",
            bodyAdmins: "Přihlášky kategorie {category} vyřizují správci Logi.",
        },
        unverifiable: {
            title: "Teď nejde ověřit tvoje role",
            body: "Discord neodpověděl. Zkus to za chvíli znovu.",
        },
        alreadyDecided: {
            title: "O přihlášce #{number} už je rozhodnuto",
            body: "Rozhodl {member}: {outcome}. Členství změníš na webu v Členové.",
            members: "Členové v Logi",
        },
        notTracked: {
            title: "Tohle vlákno není přihláška",
            body: "Rozhoduje se ve vlákně, které vzniklo z přihlášky.",
        },
        noMercenaryCategory: {
            title: "Klan nemá kategorii žoldáků",
            body: "Správce ji založí v Logi v Nastavení → Členství → Kategorie. Pak půjde žoldáka přijmout.",
        },
        dmFailed:
            "Uchazeči nejde poslat DM. Rozhodnutí najde ve vlákně přihlášky.",
    },
    dm: {
        label: "Klan {clan} · Přihláška #{number}",
        accepted: {
            member: "Vítej v klanu, jsi Člen",
            recruit: "Vítej v klanu, jsi Rekrut",
            mercenary: "Vítej v klanu, jsi Žoldák",
        },
        acceptedBody: "Nábor přijal tvoji přihlášku do {game}.",
        roles: {
            one: "Roli {roles} dostaneš na serveru během minuty.",
            other: "Role {roles} dostaneš na serveru během minuty.",
        },
        rejectedTitle: "Přihláška nebyla přijata",
        rejectedHelp:
            "Když máš otázku, otevři ticket na serveru {clan} v kanálu {channel}.",
        rejectedHelpNoTickets:
            "Když máš otázku, napiš správcům na serveru {clan}.",
        pendingTitle: "Přihláška čeká na rozhodnutí",
        pendingBody:
            "Nábor tvoji přihlášku zatím nechal čekat. Až rozhodne, dáme ti vědět.",
        openThread: "Otevřít vlákno",
        confirmationTitle: "Přihláška #{number} je odeslaná",
        confirmationBody:
            "Nábor se ti ozve ve vlákně přihlášky. Rozhodnutí ti přijde i sem do DM.",
    },
    command: {
        closedTitle: "Přihláška #{number} uzavřena: {outcome}",
        rejectedTitle: "Přihláška #{number} zamítnuta",
        roles: {
            one: "{name} dostane roli {roles} do minuty.",
            other: "{name} dostane role {roles} do minuty.",
        },
        delivered: "Rozhodnutí je ve vlákně a uchazeč ho dostal do DM.",
        notDelivered:
            "Rozhodnutí je ve vlákně. Uchazeči nejde poslat DM, najde ho tam.",
        dmOff: "Rozhodnutí je ve vlákně. DM o rozhodnutí má klan v nastavení zpráv vypnuté.",
        wrongPlace: {
            title: "/close_application funguje jen ve vlákně přihlášky",
            body: "Otevři vlákno přihlášky a spusť příkaz tam.",
        },
        alreadyClosed: {
            title: "Přihláška #{number} je už uzavřená",
            body: "Rozhodnutí: {outcome}. Členství změníš na webu v Členové.",
            members: "Členové v Logi",
        },
        notAllowedTitle: "O této přihlášce rozhoduje nábor",
    },
}

const pl: Copy = {
    listAnd: "i",
    defaultForm: {
        source: {
            label: "Skąd się o nas dowiedziałeś?",
            options: [
                "Od znajomego w klanie",
                "Z serwera klanu",
                "Z Discord",
                "Gdzie indziej",
            ],
        },
        age: { label: "Wiek", placeholder: "Np. 24" },
        hours: {
            label: "Ile godzin tygodniowo grasz?",
            placeholder: "Np. 10–15 godzin",
        },
        why: {
            label: "Dlaczego chcesz z nami zagrać?",
            placeholder: "Wystarczy kilka zdań.",
        },
        specialization: {
            label: "Specjalizacja",
            help: "Tylko Hell Let Loose.",
            options: ["Piechota", "Jednostki pancerne", "Zwiad"],
        },
        when: {
            label: "Kiedy zazwyczaj grasz?",
            help: "Możesz wybrać więcej niż jeden.",
            options: ["Wieczory w dni powszednie", "Weekendy"],
        },
        microphone: { label: "Czy masz mikrofon?" },
        previousClan: {
            label: "W którym klanie grałeś wcześniej?",
            placeholder: "Opcjonalnie",
        },
        referrer: {
            label: "Kto Cię zaprosił?",
            help: "Członek tego serwera.",
        },
    },
    panel: {
        apply: "Wyślij zgłoszenie",
        applyOnWeb: "Wypełnij zgłoszenie na stronie",
        windowsNote: {
            two: "Formularz ma dwa krótkie kroki i zajmuje około 2 minut.",
            three: "Formularz ma trzy krótkie kroki i zajmuje około 3 minut.",
        },
        defaultTitle: "Dołącz do klanu {clan}",
        defaultTitleNoClan: "Dołącz do nas",
        defaultText: {
            two: "Wybierz, jak chcesz z nami grać. Formularz ma dwa krótkie kroki i zajmie kilka minut.",
            three: "Wybierz, jak chcesz z nami grać. Formularz ma trzy krótkie kroki i zajmie kilka minut.",
        },
    },
    label: "Zgłoszenie do {clan}",
    step: "Krok {step} z {total}",
    reviewStep: "Sprawdź",
    windowTitle: "Zgłoszenie · {step} z {total} · {name}",
    windowTitleExtra: "Zgłoszenie · {step}{suffix} · {name}",
    windowNames: {
        about: "O Tobie",
        accounts: "Konta gier",
        questions: "Pytania klanowe",
    },
    fields: {
        games: {
            label: "W jakie gry grasz?",
            help: "Wybierz jedno lub oba.",
            placeholder: "Wybierz gry",
        },
        category: {
            label: "Kategoria",
            help: "Jak chcesz z nami grać.",
            placeholder: "Wybierz kategorię",
        },
        name: {
            label: "Nick w grze",
            help: "Dokładnie tak, jak widzisz to w grze.",
        },
        previous: {
            label: "Czy znaleźliśmy Cię na serwerach klanu?",
            help: "Pod nazwą w grze {name} z pierwszego okna.",
            none: "Żadne z tych",
            noneHelp: "Poniżej wprowadzę moje konto",
            seen: "{platform} · ostatnio widziany {date} na {server}",
            seenNoServer: "{platform} · ostatnio widziany {date}",
        },
        steam: {
            label: "Steam ID lub link do profilu",
            help: "17 cyfr zaczynających się od 7656119 lub link do strony steamcommunity.com/profiles/…",
        },
        epic: { label: "Epic Account ID", placeholder: "Opcjonalnie" },
        xbox: { label: "Xbox", placeholder: "Opcjonalnie" },
        playstation: { label: "PlayStation", placeholder: "Opcjonalnie" },
        selectPlaceholder: "Wybierz opcję",
        memberPlaceholder: "Wybierz członka",
        optional: "Opcjonalnie",
        yes: "Tak",
        no: "Nie",
    },
    platforms: {
        steam: "Steam",
        epic: "Epic Games",
        xbox: "Xbox",
        playstation: "PlayStation",
        other: "Konto",
    },
    progress: {
        intro: {
            about: "W pierwszym oknie pojawia się pytanie o gry, kategorię i nazwę w grze.",
            accounts:
                "Następne okno zapyta o Steam, Epic lub konsolę. Jedno konto wystarczy.",
            questions: "W następnym oknie znajdują się pytania klanu.",
            questionsMore: "Następne okno zawiera resztę pytań klanu.",
        },
        done: "zrobione",
        fix: "Popraw",
        steamVerified: "✓ Zweryfikowano Steam",
        accountsPending:
            "Możesz zweryfikować Steam na stronie. Wtedy nie trzeba wpisywać go w formularzu.",
        accountsVerified: "Steam {id} · okno już wypełnione",
        accountsLocked:
            "Zweryfikuj Steam na stronie — wpisanie Steam ID nie wystarczy. W tym oknie możesz podać konto konsolowe lub Epic.",
        questionsCount: {
            one: "Jeszcze {count} pytanie, potem podsumowanie",
            few: "Jeszcze {count} pytania, potem podsumowanie",
            many: "Jeszcze {count} pytań, potem podsumowanie",
            other: "Jeszcze {count} pytań, potem podsumowanie",
        },
        ageValue: "{value} lat",
        continue: "Dalej",
        edit: "Edytuj",
        cancel: "Anuluj",
        verifySteam: "Zweryfikuj Steam na stronie (zalecane)",
        verifySteamRequired: "Zweryfikuj Steam na stronie",
        findAccount: "Znajdź identyfikator mojego konta",
        keepNote: "Niedokończone zgłoszenie zachowamy przez 24 godziny.",
    },
    review: {
        title: "Sprawdź i wyślij",
        submit: "Wyślij zgłoszenie",
        cancel: "Anuluj",
        note: "Niedokończone zgłoszenie zachowamy przez 24 godziny, potem je usuniemy. Rekruterzy zobaczą je dopiero po wysłaniu.",
        games: "Gry",
        category: "Kategoria",
        name: "Nick w grze",
    },
    summaryLabels: {
        source: "Od",
        age: "Wiek",
        referrer: "Zaproszony przez",
        specialization: "Specjalizacja",
    },
    fixTitle: {
        about: "Popraw swoje dane",
        accounts: "Popraw konta gier",
        questions: "Popraw swoje odpowiedzi",
    },
    fixButton: {
        about: "Popraw swoje dane",
        accounts: "Popraw konta gier",
        questions: "Popraw odpowiedzi",
    },
    issues: {
        required: "{field}: to pole jest wymagane.",
        number: "{field}: wpisz liczbę.",
        tooLong: "{field}: odpowiedź jest za długa.",
        choice: "{field}: wybierz jedną z oferowanych opcji.",
        tooFew: "{field}: wybierz więcej opcji.",
        tooMany: "{field}: wybierz mniej opcji.",
        member: "{field}: wybierz członka tego serwera.",
        steam: "Identyfikator Steam nie wygląda prawidłowo. Ma 17 cyfr i zaczyna się od 7656119.",
        accountMissing: "Wprowadź co najmniej jedno konto gry.",
        unknown: "W międzyczasie formularz się zmienił. Wypełnij go ponownie.",
    },
    sent: {
        title: "Zgłoszenie wysłane",
        body: "Rekruterzy skontaktują się z Tobą w {thread}. Decyzję dostaniesz też w wiadomości prywatnej.",
        openThread: "Otwórz wątek",
    },
    cancelled: {
        title: "Zgłoszenie anulowane",
        body: "Nic nie zostało wysłane. Zacznij od nowa przyciskiem Wyślij zgłoszenie na {channel}.",
    },
    expired: {
        title: "To zgłoszenie wygasło",
        body: "Niedokończone odpowiedzi nie zostały zachowane. Zacznij od nowa przyciskiem Wyślij zgłoszenie na {channel}.",
    },
    windowExpired: {
        title: "Okno zostało zamknięte przed wysłaniem",
        body: "Twoje zapisane kroki zostaną zachowane: {steps}. Kontynuuj od miejsca, w którym skończyłeś i ponownie wypełnij {window}.",
        bodyNothing: "Nic nie zostało jeszcze zapisane. Zacznij od {window}.",
        continue: "Dalej",
    },
    alreadyInClan: {
        title: "Jesteś już w {clan}",
        body: "Aby zmienić swoją rolę lub kategorię, napisz do administratorów poprzez zgłoszenie w {tickets}.",
        bodyNoTickets:
            "Aby zmienić swoją rolę lub kategorię, napisz do administratorów klanu.",
    },
    openApplication: {
        title: "Masz już otwarte zgłoszenie #{number}",
        body: "Poczekaj na decyzję rekruterów. Dostaniesz wiadomość prywatną.",
        open: "Otwórz wątek",
    },
    closed: {
        title: "Zgłoszenia są obecnie zamknięte",
        body: "Spróbuj ponownie później lub zapytaj administratorów w {channel}.",
        bodyNoChannel:
            "Spróbuj ponownie później lub zapytaj administratorów klanu.",
    },
    sendFailed: {
        title: "Nie można wysłać zgłoszenia",
        body: "Nic nie zostało zapisane. Administratorzy zostali powiadomieni; spróbuj ponownie za chwilę.",
    },
    threadName: "zgłoszenie · {name}",
    closedThreadName: "zamknięte · {name}",
    welcome: {
        withRoles:
            "Cześć {applicant}, dziękujemy za złożenie wniosku. {support_roles} wkrótce się z Tobą skontaktuje.",
        withoutRoles:
            "Cześć {applicant}, dziękujemy za złożenie wniosku. Rekruterzy wkrótce się z Tobą skontaktują.",
    },
    card: {
        label: "Zgłoszenie #{number} · {games}",
        closedLabel: "Zgłoszenie #{number} · zamknięte",
        title: "{name} · {category}",
        pending: "Oczekiwanie na decyzję",
        submitted: "wysłano {time}",
        inGameName: "Nick w grze: {name}",
        accounts: "Konta",
        source: "Skąd się o nas dowiedziałeś(-aś)",
        invitedBy: "zaproszony przez {member}",
        undecided: "Jeszcze nie zdecydowano · {name}, {time}",
        undecidedNote:
            "Wątek pozostaje otwarty, a wnioskodawca nic nie otrzymuje. Przyciski zostają.",
        deciders: "Decyzję mogą podjąć {roles} i administratorzy Logi",
        decidersAdmins: "Decyzję mogą podjąć administratorzy Logi",
        accept: {
            member: "Przyjmij jako członka",
            recruit: "Przyjmij jako rekruta",
            mercenary: "Przyjmij jako najemnika",
        },
        reject: "Odrzuć…",
        undecidedButton: "Zostaw do rozpatrzenia",
        mercenaryUnavailable:
            "Nie można jeszcze przyjąć najemnika: klan nie ma kategorii najemnika.",
        decidedTitle: {
            member: "{name} — przyjęto jako członka",
            recruit: "{name} — przyjęto jako rekruta",
            mercenary: "{name} — przyjęto jako najemnika",
            pending: "{name} oczekuje na decyzję",
            denied: "{name} — zgłoszenie odrzucone",
        },
        outcome: {
            member: "Członek",
            recruit: "Rekrut",
            mercenary: "Najemnik",
            pending: "Oczekiwanie na decyzję",
            denied: "Odrzucono",
        },
        rolesPending: "Dodawane są role",
        decidedBy: "Decyzja: {member} · {time}",
        rolesAdd: {
            one: "Logi dodaje rolę {roles} w ciągu minuty.",
            other: "Logi dodaje role {roles} w ciągu minuty.",
        },
        rolesRemove: {
            one: "Logi usuwa rolę {roles} w ciągu minuty.",
            other: "Logi usuwa role {roles} w ciągu minuty.",
        },
        closedFooter: "Wątek jest zablokowany i zarchiwizowany",
    },
    rejectModal: {
        title: "Odrzuć zgłoszenie #{number}",
        body: "{name} otrzyma powód w wiadomości prywatnej. Następnie wątek zostanie zamknięty i zarchiwizowany.",
        reason: "Powód",
        reasonHelp: "Wnioskodawca to zobaczy.",
        reasonPlaceholder:
            "Np. nie prowadzimy teraz rekrutacji rezerwowych, spróbuj ponownie w listopadzie.",
    },
    decision: {
        notAllowed: {
            title: "Rekruterzy decydują o zgłoszeniach",
            body: "Zgłoszenia w kategorii {category} rozpatrują osoby z rolami {roles} lub administratorzy Logi.",
            bodyAdmins:
                "Zgłoszenia w {category} są obsługiwane przez administratorów Logi.",
        },
        unverifiable: {
            title: "Nie można teraz sprawdzić Twoich ról",
            body: "Discord nie odpowiedział. Spróbuj ponownie za chwilę.",
        },
        alreadyDecided: {
            title: "Zgłoszenie #{number} jest już rozpatrzone",
            body: "Decyzja osoby {member}: {outcome}. Członkostwo zmienisz na stronie w zakładce Członkowie.",
            members: "Członkowie w Logi",
        },
        notTracked: {
            title: "Ten wątek nie jest zgłoszeniem",
            body: "Decyzję podejmij w wątku utworzonym ze zgłoszenia rekrutacyjnego.",
        },
        noMercenaryCategory: {
            title: "Klan nie ma kategorii najemnika",
            body: "Administrator dodaje je w Logi w obszarze Ustawienia → Członkostwo → Kategorie. Wtedy możesz przyjąć najemnika.",
        },
        dmFailed:
            "Nie udało się wysłać wiadomości prywatnej. Decyzja jest dostępna w wątku zgłoszenia.",
    },
    dm: {
        label: "Klan {clan} · Zgłoszenie #{number}",
        accepted: {
            member: "Witamy w klanie, jesteś członkiem",
            recruit: "Witamy w klanie, jesteś rekrutem",
            mercenary: "Witamy w klanie, jesteś najemnikiem",
        },
        acceptedBody: "Rekruterzy przyjęli Twoje zgłoszenie do {game}.",
        roles: {
            one: "Rolę {roles} otrzymasz na serwerze w ciągu minuty.",
            other: "Role {roles} otrzymasz na serwerze w ciągu minuty.",
        },
        rejectedTitle: "Twój wniosek nie został zaakceptowany",
        rejectedHelp:
            "Jeśli masz pytanie, otwórz zgłoszenie na serwerze {clan} w kanale {channel}.",
        rejectedHelpNoTickets:
            "Jeśli masz pytanie, napisz do administratorów na serwerze {clan}.",
        pendingTitle: "Twój wniosek oczekuje na decyzję",
        pendingBody:
            "Rekruterzy odłożyli decyzję w sprawie Twojego zgłoszenia. Damy Ci znać, gdy ją podejmą.",
        openThread: "Otwórz wątek",
        confirmationTitle: "Zgłoszenie #{number} wysłane",
        confirmationBody:
            "Rekruterzy skontaktują się z Tobą w wątku zgłoszenia. Tutaj otrzymasz również wiadomość z decyzją.",
    },
    command: {
        closedTitle: "Zgłoszenie #{number} zamknięte: {outcome}",
        rejectedTitle: "Zgłoszenie #{number} odrzucone",
        roles: {
            one: "{name} otrzymuje rolę {roles} w ciągu minuty.",
            other: "{name} otrzymuje role {roles} w ciągu minuty.",
        },
        delivered: "Decyzja jest w wątku i wnioskodawca otrzymał ją przez DM.",
        notDelivered:
            "Decyzja jest w wątku. Nie udało się dostarczyć wiadomości prywatnej — osoba zgłaszająca się znajdzie ją w wątku.",
        dmOff: "Decyzja jest w wątku. Klan wyłączył prywatne powiadomienia o decyzjach w ustawieniach wiadomości.",
        wrongPlace: {
            title: "/close_application działa tylko w wątku zgłoszenia rekrutacyjnego",
            body: "Otwórz wątek zgłoszenia i uruchom tam komendę.",
        },
        alreadyClosed: {
            title: "Zgłoszenie #{number} jest już zamknięte",
            body: "Decyzja: {outcome}. Członkostwo zmienisz na stronie w zakładce Członkowie.",
            members: "Członkowie w Logi",
        },
        notAllowedTitle: "To zgłoszenie mogą rozpatrzyć rekruterzy",
    },
}

const fr: Copy = {
    listAnd: "et",
    defaultForm: {
        source: {
            label: "Comment nous as-tu connus ?",
            options: [
                "Par un ami du clan",
                "Sur le serveur du clan",
                "Sur Discord",
                "Autre",
            ],
        },
        age: { label: "Âge", placeholder: "Ex. : 24" },
        hours: {
            label: "Combien d’heures joues-tu par semaine ?",
            placeholder: "Ex. : 10 à 15 heures",
        },
        why: {
            label: "Pourquoi souhaites-tu jouer avec nous ?",
            placeholder: "Quelques phrases suffisent.",
        },
        specialization: {
            label: "Spécialité",
            help: "Hell Let Loose uniquement.",
            options: ["Infanterie", "Blindés", "Reconnaissance"],
        },
        when: {
            label: "Quand joues-tu habituellement ?",
            help: "Tu peux sélectionner plusieurs réponses.",
            options: ["En semaine, le soir", "Le week-end"],
        },
        microphone: { label: "As-tu un micro ?" },
        previousClan: {
            label: "Dans quel clan jouais-tu auparavant ?",
            placeholder: "Facultatif",
        },
        referrer: {
            label: "Qui t’a invité ?",
            help: "Un membre de ce serveur.",
        },
    },
    panel: {
        apply: "Postuler",
        applyOnWeb: "Remplir la candidature sur le site",
        windowsNote: {
            two: "La candidature comporte deux courts formulaires et prend environ 2 minutes.",
            three: "La candidature comporte trois courts formulaires et prend environ 3 minutes.",
        },
        defaultTitle: "Rejoindre le clan {clan}",
        defaultTitleNoClan: "Rejoins-nous",
        defaultText: {
            two: "Choisis comment tu souhaites jouer avec nous. La candidature comporte deux courts formulaires et prend quelques minutes.",
            three: "Choisis comment tu souhaites jouer avec nous. La candidature comporte trois courts formulaires et prend quelques minutes.",
        },
    },
    label: "Candidature auprès de {clan}",
    step: "Étape {step} sur {total}",
    reviewStep: "Vérification",
    windowTitle: "Candidature · {step} sur {total} · {name}",
    windowTitleExtra: "Candidature · {step}{suffix} · {name}",
    windowNames: {
        about: "À propos de toi",
        accounts: "Comptes de jeu",
        questions: "Questions du clan",
    },
    fields: {
        games: {
            label: "Jeux",
            help: "Choisis un ou deux jeux.",
            placeholder: "Choisir les jeux",
        },
        category: {
            label: "Catégorie",
            help: "La façon dont tu souhaites jouer avec nous.",
            placeholder: "Choisir une catégorie",
        },
        name: { label: "Pseudo en jeu", help: "Exactement tel qu’il apparaît en jeu." },
        previous: {
            label: "T’avons-nous trouvé sur les serveurs du clan ?",
            help: "À partir du pseudo {name} saisi dans le premier formulaire.",
            none: "Aucun de ces comptes",
            noneHelp: "Je saisirai mon compte ci-dessous",
            seen: "{platform} · vu pour la dernière fois {date} sur {server}",
            seenNoServer: "{platform} · vu pour la dernière fois {date}",
        },
        steam: {
            label: "Steam ID ou lien du profil",
            help: "17 chiffres commençant par 7656119, ou un lien steamcommunity.com/profiles/…",
        },
        epic: { label: "Epic Account ID", placeholder: "Facultatif" },
        xbox: { label: "Xbox", placeholder: "Facultatif" },
        playstation: { label: "PlayStation", placeholder: "Facultatif" },
        selectPlaceholder: "Choisir une option",
        memberPlaceholder: "Choisir un membre",
        optional: "Facultatif",
        yes: "Oui",
        no: "Non",
    },
    platforms: {
        steam: "Steam",
        epic: "Epic",
        xbox: "Xbox",
        playstation: "PlayStation",
        other: "Compte",
    },
    progress: {
        intro: {
            about: "Le premier formulaire demande les jeux, la catégorie et le pseudo en jeu.",
            accounts:
                "Le formulaire suivant demande un compte Steam, Epic ou console. Un seul compte suffit.",
            questions: "Le formulaire suivant contient les questions du clan.",
            questionsMore:
                "Le formulaire suivant contient la suite des questions du clan.",
        },
        done: "terminé",
        fix: "à corriger",
        steamVerified: "✓ Steam vérifié",
        accountsPending:
            "Tu peux vérifier ton compte Steam sur le site. Tu n’auras alors pas à le saisir dans le formulaire.",
        accountsVerified: "Steam {id} · déjà renseigné dans le formulaire",
        accountsLocked:
            "Vérifie ton compte Steam sur le site ; la saisie manuelle d’un Steam ID n’est pas acceptée ici. Renseigne ton compte console ou Epic dans le formulaire.",
        questionsCount: {
            one: "{count} question, puis vérification",
            other: "{count} questions, puis vérification",
        },
        ageValue: "{value} ans",
        continue: "Continuer",
        edit: "Modifier",
        cancel: "Annuler",
        verifySteam: "Vérifier Steam sur le site (recommandé)",
        verifySteamRequired: "Vérifier Steam sur le site",
        findAccount: "Trouver mon identifiant de compte",
        keepNote: "Nous conservons une candidature inachevée pendant 24 h.",
    },
    review: {
        title: "Vérifier et envoyer",
        submit: "Envoyer la candidature",
        cancel: "Annuler",
        note: "Nous conservons une candidature inachevée pendant 24 h, puis elle est supprimée. Les recruteurs ne la voient qu’après son envoi.",
        games: "Jeux",
        category: "Catégorie",
        name: "Pseudo en jeu",
    },
    summaryLabels: {
        source: "Origine",
        age: "Âge",
        referrer: "Invité par",
        specialization: "Spécialité",
    },
    fixTitle: {
        about: "Corriger tes informations",
        accounts: "Corriger tes comptes de jeu",
        questions: "Corriger tes réponses",
    },
    fixButton: {
        about: "Corriger tes informations",
        accounts: "Corriger les comptes de jeu",
        questions: "Corriger les réponses",
    },
    issues: {
        required: "{field} : ce champ est obligatoire.",
        number: "{field} : saisis un nombre.",
        tooLong: "{field} : la réponse est trop longue.",
        choice: "{field} : choisis l’une des options proposées.",
        tooFew: "{field} : sélectionne davantage d’options.",
        tooMany: "{field} : sélectionne moins d’options.",
        member: "{field} : choisis un membre de ce serveur.",
        steam: "Le Steam ID semble incorrect. Il doit comporter 17 chiffres et commencer par 7656119.",
        accountMissing: "Renseigne au moins un compte de jeu.",
        unknown:
            "Le formulaire a changé entre-temps. Remplis-le à nouveau.",
    },
    sent: {
        title: "Candidature envoyée",
        body: "Les recruteurs te répondront dans {thread}. Tu recevras également leur décision en message privé.",
        openThread: "Ouvrir le fil",
    },
    cancelled: {
        title: "Candidature annulée",
        body: "Rien n’a été envoyé. Pour recommencer, clique sur Postuler dans {channel}.",
    },
    expired: {
        title: "Cette candidature a expiré",
        body: "Les réponses inachevées n’ont pas été enregistrées. Recommence en cliquant sur Postuler dans {channel}.",
    },
    windowExpired: {
        title: "Le formulaire a été fermé avant l’envoi",
        body: "Tes étapes enregistrées sont conservées : {steps}. Reprends où tu en étais et remplis à nouveau {window}.",
        bodyNothing: "Rien n’a encore été enregistré. Commence par {window}.",
        continue: "Continuer",
    },
    alreadyInClan: {
        title: "Tu fais déjà partie de {clan}",
        body: "Pour changer de rôle ou de catégorie, contacte les administrateurs en ouvrant un ticket dans {tickets}.",
        bodyNoTickets:
            "Pour changer de rôle ou de catégorie, contacte les administrateurs du clan.",
    },
    openApplication: {
        title: "Ta candidature nº {number} est déjà en cours",
        body: "Attends la décision des recruteurs. Tu la recevras en message privé.",
        open: "Ouvrir le fil",
    },
    closed: {
        title: "Les candidatures sont actuellement fermées",
        body: "Réessaie plus tard ou contacte les administrateurs dans {channel}.",
        bodyNoChannel: "Réessaie plus tard ou contacte les administrateurs du clan.",
    },
    sendFailed: {
        title: "Impossible d’envoyer la candidature",
        body: "Rien n’a été enregistré. Les administrateurs ont été informés ; réessaie dans un instant.",
    },
    threadName: "candidature-{name}",
    closedThreadName: "fermée · {name}",
    welcome: {
        withRoles:
            "Salut {applicant}, merci pour ta candidature. {support_roles} te répondront bientôt.",
        withoutRoles:
            "Salut {applicant}, merci pour ta candidature. Les recruteurs te répondront bientôt.",
    },
    card: {
        label: "Candidature nº {number} · {games}",
        closedLabel: "Candidature nº {number} · fermée",
        title: "{name} · {category}",
        pending: "En attente de décision",
        submitted: "envoyée {time}",
        inGameName: "pseudo en jeu : {name}",
        accounts: "Comptes",
        source: "Comment tu nous as connus",
        invitedBy: "invité par {member}",
        undecided: "Décision en attente · {name}, {time}",
        undecidedNote:
            "Le fil reste ouvert et rien n’est envoyé au candidat. Les boutons restent disponibles.",
        deciders: "{roles} et les administrateurs Logi peuvent décider",
        decidersAdmins: "Les administrateurs Logi peuvent décider",
        accept: {
            member: "Accepter comme membre",
            recruit: "Accepter comme recrue",
            mercenary: "Accepter comme mercenaire",
        },
        reject: "Refuser…",
        undecidedButton: "Décision en attente",
        mercenaryUnavailable:
            "Impossible d’accepter un mercenaire pour le moment : le clan n’a pas de catégorie Mercenaire.",
        decidedTitle: {
            member: "{name} est accepté comme membre",
            recruit: "{name} est accepté comme recrue",
            mercenary: "{name} est accepté comme mercenaire",
            pending: "La candidature de {name} est en attente de décision",
            denied: "La candidature de {name} n’a pas été retenue",
        },
        outcome: {
            member: "Membre",
            recruit: "Recrue",
            mercenary: "Mercenaire",
            pending: "En attente de décision",
            denied: "Refusée",
        },
        rolesPending: "Attribution des rôles en cours",
        decidedBy: "Décision de {member} · {time}",
        rolesAdd: {
            one: "Logi ajoutera le rôle {roles} dans la minute.",
            other: "Logi ajoutera les rôles {roles} dans la minute.",
        },
        rolesRemove: {
            one: "Logi retirera le rôle {roles} dans la minute.",
            other: "Logi retirera les rôles {roles} dans la minute.",
        },
        closedFooter: "Le fil est verrouillé et archivé",
    },
    rejectModal: {
        title: "Refuser la candidature nº {number}",
        body: "{name} recevra le motif en message privé. Le fil sera ensuite verrouillé et archivé.",
        reason: "Motif",
        reasonHelp: "Le candidat pourra le lire.",
        reasonPlaceholder:
            "Ex. : nous ne recrutons pas de remplaçants actuellement, reviens en novembre.",
    },
    decision: {
        notAllowed: {
            title: "Les recruteurs statuent sur les candidatures",
            body: "Les candidatures de la catégorie {category} sont traitées par {roles} ou les administrateurs Logi.",
            bodyAdmins:
                "Les candidatures de la catégorie {category} sont traitées par les administrateurs Logi.",
        },
        unverifiable: {
            title: "Impossible de vérifier tes rôles pour le moment",
            body: "Discord n’a pas répondu. Réessaie dans un instant.",
        },
        alreadyDecided: {
            title: "La candidature nº {number} a déjà été traitée",
            body: "Décision de {member} : {outcome}. Pour modifier l’adhésion, ouvre Membres sur le site.",
            members: "Membres dans Logi",
        },
        notTracked: {
            title: "Ce fil ne correspond pas à une candidature",
            body: "Les décisions se prennent dans le fil créé à partir d’une candidature.",
        },
        noMercenaryCategory: {
            title: "Le clan n’a pas de catégorie Mercenaire",
            body: "Un administrateur doit en ajouter une dans Logi, sous Paramètres → Recrutement → Catégories. Tu pourras alors accepter un mercenaire.",
        },
        dmFailed:
            "Le candidat ne peut pas recevoir de messages privés. Il trouvera la décision dans le fil de candidature.",
    },
    dm: {
        label: "Clan {clan} · Candidature nº {number}",
        accepted: {
            member: "Bienvenue dans le clan, tu es membre",
            recruit: "Bienvenue dans le clan, tu es recrue",
            mercenary: "Bienvenue dans le clan, tu es mercenaire",
        },
        acceptedBody: "Les recruteurs ont accepté ta candidature pour {game}.",
        roles: {
            one: "Le rôle {roles} te sera attribué sur le serveur dans la minute.",
            other: "Les rôles {roles} te seront attribués sur le serveur dans la minute.",
        },
        rejectedTitle: "Ta candidature n’a pas été retenue",
        rejectedHelp:
            "Si tu as une question, ouvre un ticket sur le serveur {clan}, dans le salon {channel}.",
        rejectedHelpNoTickets:
            "Si tu as une question, contacte les administrateurs du serveur {clan}.",
        pendingTitle: "Ta candidature est en attente de décision",
        pendingBody:
            "Les recruteurs ont mis ta candidature en attente. Nous te préviendrons dès qu’ils auront pris leur décision.",
        openThread: "Ouvrir le fil",
        confirmationTitle: "La candidature nº {number} a été envoyée",
        confirmationBody:
            "Les recruteurs te répondront dans le fil de candidature. Tu recevras aussi leur décision ici, en message privé.",
    },
    command: {
        closedTitle: "Candidature nº {number} fermée : {outcome}",
        rejectedTitle: "Candidature nº {number} refusée",
        roles: {
            one: "{name} recevra le rôle {roles} dans la minute.",
            other: "{name} recevra les rôles {roles} dans la minute.",
        },
        delivered:
            "La décision a été publiée dans le fil et envoyée au candidat en message privé.",
        notDelivered:
            "La décision a été publiée dans le fil. Le candidat ne peut pas recevoir de messages privés et pourra la consulter là-bas.",
        dmOff: "La décision a été publiée dans le fil. Le clan a désactivé les décisions par message privé dans les paramètres des messages.",
        wrongPlace: {
            title: "/close_application fonctionne uniquement dans un fil de candidature",
            body: "Ouvre le fil de candidature et lance la commande dedans.",
        },
        alreadyClosed: {
            title: "La candidature nº {number} est déjà fermée",
            body: "Décision : {outcome}. Pour modifier l’adhésion, ouvre Membres sur le site.",
            members: "Membres dans Logi",
        },
        notAllowedTitle: "Les recruteurs statuent sur cette candidature",
    },
}

const en: Copy = {
    listAnd: "and",
    defaultForm: {
        source: {
            label: "How did you hear about us?",
            options: [
                "From a friend in the clan",
                "From the clan's server",
                "From Discord",
                "Somewhere else",
            ],
        },
        age: { label: "Age", placeholder: "E.g. 24" },
        hours: {
            label: "How many hours a week do you play?",
            placeholder: "E.g. 10–15 hours",
        },
        why: {
            label: "Why do you want to play with us?",
            placeholder: "A few sentences are enough.",
        },
        specialization: {
            label: "Specialisation",
            help: "Hell Let Loose only.",
            options: ["Infantry", "Armour", "Recon"],
        },
        when: {
            label: "When do you usually play?",
            help: "You can pick more than one.",
            options: ["Weekday evenings", "Weekends"],
        },
        microphone: { label: "Do you have a microphone?" },
        previousClan: {
            label: "Which clan did you play in before?",
            placeholder: "Optional",
        },
        referrer: {
            label: "Who invited you?",
            help: "A member of this server.",
        },
    },
    panel: {
        apply: "Apply",
        applyOnWeb: "Fill in the application on the web",
        windowsNote: {
            two: "The application has two short windows and takes about 2 minutes.",
            three: "The application has three short windows and takes about 3 minutes.",
        },
        defaultTitle: "Join the {clan} clan",
        defaultTitleNoClan: "Join us",
        defaultText: {
            two: "Choose how you want to play with us. The application has two short windows and takes a few minutes.",
            three: "Choose how you want to play with us. The application has three short windows and takes a few minutes.",
        },
    },
    label: "Application to {clan}",
    step: "Step {step} of {total}",
    reviewStep: "Review",
    windowTitle: "Application · {step} of {total} · {name}",
    windowTitleExtra: "Application · {step}{suffix} · {name}",
    windowNames: {
        about: "About you",
        accounts: "Game accounts",
        questions: "Clan questions",
    },
    fields: {
        games: {
            label: "Games",
            help: "Pick one or both.",
            placeholder: "Pick games",
        },
        category: {
            label: "Category",
            help: "How you want to play with us.",
            placeholder: "Pick a category",
        },
        name: { label: "In-game name", help: "Exactly as you see it in game." },
        previous: {
            label: "Did we find you on the clan's servers?",
            help: "By the in-game name {name} from the first window.",
            none: "None of these",
            noneHelp: "I will enter my account below",
            seen: "{platform} · last seen {date} on {server}",
            seenNoServer: "{platform} · last seen {date}",
        },
        steam: {
            label: "Steam ID or profile link",
            help: "17 digits starting with 7656119, or a steamcommunity.com/profiles/… link",
        },
        epic: { label: "Epic Account ID", placeholder: "Optional" },
        xbox: { label: "Xbox", placeholder: "Optional" },
        playstation: { label: "PlayStation", placeholder: "Optional" },
        selectPlaceholder: "Pick an option",
        memberPlaceholder: "Pick a member",
        optional: "Optional",
        yes: "Yes",
        no: "No",
    },
    platforms: {
        steam: "Steam",
        epic: "Epic",
        xbox: "Xbox",
        playstation: "PlayStation",
        other: "Account",
    },
    progress: {
        intro: {
            about: "The first window asks for games, category and in-game name.",
            accounts:
                "The next window asks for Steam, Epic or a console. One account is enough.",
            questions: "The next window has the clan's questions.",
            questionsMore:
                "The next window has the rest of the clan's questions.",
        },
        done: "done",
        fix: "fix",
        steamVerified: "✓ Steam verified",
        accountsPending:
            "You can verify Steam on the web. Then you do not have to type it in the window.",
        accountsVerified: "Steam {id} · already filled in the window",
        accountsLocked:
            "Verify Steam on the web; a typed Steam ID is not accepted here. Enter console or Epic in the window.",
        questionsCount: {
            one: "{count} question, then review",
            other: "{count} questions, then review",
        },
        ageValue: "{value} years",
        continue: "Continue",
        edit: "Edit",
        cancel: "Cancel",
        verifySteam: "Verify Steam on the web (recommended)",
        verifySteamRequired: "Verify Steam on the web",
        findAccount: "Find my account ID",
        keepNote: "We keep an unfinished application for 24 h.",
    },
    review: {
        title: "Check and send",
        submit: "Send application",
        cancel: "Cancel",
        note: "We keep an unfinished application for 24 h, then it is deleted. Recruiters only see the application after you send it.",
        games: "Games",
        category: "Category",
        name: "In-game name",
    },
    summaryLabels: {
        source: "From",
        age: "Age",
        referrer: "Invited by",
        specialization: "Specialisation",
    },
    fixTitle: {
        about: "Fix your details",
        accounts: "Fix your game accounts",
        questions: "Fix your answers",
    },
    fixButton: {
        about: "Fix your details",
        accounts: "Fix game accounts",
        questions: "Fix answers",
    },
    issues: {
        required: "{field}: this field is required.",
        number: "{field}: enter a number.",
        tooLong: "{field}: the answer is too long.",
        choice: "{field}: pick one of the offered options.",
        tooFew: "{field}: pick more options.",
        tooMany: "{field}: pick fewer options.",
        member: "{field}: pick a member of this server.",
        steam: "The Steam ID does not look right. It has 17 digits and starts with 7656119.",
        accountMissing: "Enter at least one game account.",
        unknown:
            "The window has changed in the meantime. Please fill it in again.",
    },
    sent: {
        title: "Application sent",
        body: "Recruiters will get back to you in {thread}. You also get the decision by DM.",
        openThread: "Open thread",
    },
    cancelled: {
        title: "Application cancelled",
        body: "Nothing was sent. Start a new one with Apply in {channel}.",
    },
    expired: {
        title: "This application has expired",
        body: "Unfinished answers were not saved. Start again with Apply in {channel}.",
    },
    windowExpired: {
        title: "The window closed before you sent it",
        body: "Your saved steps are kept: {steps}. Continue where you left off and fill in {window} again.",
        bodyNothing: "Nothing has been saved yet. Start with {window}.",
        continue: "Continue",
    },
    alreadyInClan: {
        title: "You are already in {clan}",
        body: "To change your role or category, write to the admins through a ticket in {tickets}.",
        bodyNoTickets:
            "To change your role or category, write to the clan's admins.",
    },
    openApplication: {
        title: "You already have open application #{number}",
        body: "Wait until the recruiters decide on it. You will get a DM.",
        open: "Open thread",
    },
    closed: {
        title: "Applications are closed right now",
        body: "Try again later, or ask the admins in {channel}.",
        bodyNoChannel: "Try again later, or ask the clan's admins.",
    },
    sendFailed: {
        title: "The application could not be sent",
        body: "Nothing was saved. The admins have been notified; please try again in a moment.",
    },
    threadName: "application-{name}",
    closedThreadName: "closed · {name}",
    welcome: {
        withRoles:
            "Hi {applicant}, thanks for applying. {support_roles} will get back to you soon.",
        withoutRoles:
            "Hi {applicant}, thanks for applying. The recruiters will get back to you soon.",
    },
    card: {
        label: "Application #{number} · {games}",
        closedLabel: "Application #{number} · closed",
        title: "{name} · {category}",
        pending: "Awaiting decision",
        submitted: "sent {time}",
        inGameName: "in-game name {name}",
        accounts: "Accounts",
        source: "Heard about us",
        invitedBy: "invited by {member}",
        undecided: "Not decided yet · {name}, {time}",
        undecidedNote:
            "The thread stays open and the applicant gets nothing. The buttons stay.",
        deciders: "{roles} and Logi admins can decide",
        decidersAdmins: "Logi admins can decide",
        accept: {
            member: "Accept as member",
            recruit: "Accept as recruit",
            mercenary: "Accept as mercenary",
        },
        reject: "Reject…",
        undecidedButton: "Not decided yet",
        mercenaryUnavailable:
            "A mercenary can't be accepted yet: the clan has no mercenary category.",
        decidedTitle: {
            member: "{name} is accepted as Member",
            recruit: "{name} is accepted as Recruit",
            mercenary: "{name} is accepted as Mercenary",
            pending: "{name} is awaiting a decision",
            denied: "{name} was not accepted",
        },
        outcome: {
            member: "Member",
            recruit: "Recruit",
            mercenary: "Mercenary",
            pending: "Awaiting decision",
            denied: "Rejected",
        },
        rolesPending: "Roles being added",
        decidedBy: "Decided by {member} · {time}",
        rolesAdd: {
            one: "Logi adds the {roles} role within a minute.",
            other: "Logi adds the roles {roles} within a minute.",
        },
        rolesRemove: {
            one: "Logi removes the {roles} role within a minute.",
            other: "Logi removes the roles {roles} within a minute.",
        },
        closedFooter: "The thread is locked and archived",
    },
    rejectModal: {
        title: "Reject application #{number}",
        body: "{name} gets the reason by DM. The thread is then locked and archived.",
        reason: "Reason",
        reasonHelp: "The applicant will see it.",
        reasonPlaceholder:
            "E.g. we are not recruiting reserves now, try again in November.",
    },
    decision: {
        notAllowed: {
            title: "Recruiters decide on applications",
            body: "Applications in {category} are handled by {roles} or Logi admins.",
            bodyAdmins:
                "Applications in {category} are handled by Logi admins.",
        },
        unverifiable: {
            title: "Your roles cannot be checked right now",
            body: "Discord did not answer. Try again in a moment.",
        },
        alreadyDecided: {
            title: "Application #{number} is already decided",
            body: "Decided by {member}: {outcome}. Change the membership on the web in Members.",
            members: "Members in Logi",
        },
        notTracked: {
            title: "This thread is not an application",
            body: "Decisions are made in the thread created from an application.",
        },
        noMercenaryCategory: {
            title: "The clan has no mercenary category",
            body: "An admin adds one in Logi under Settings → Membership → Categories. Then you can accept a mercenary.",
        },
        dmFailed:
            "The applicant cannot receive DMs. They will find the decision in the application thread.",
    },
    dm: {
        label: "Clan {clan} · Application #{number}",
        accepted: {
            member: "Welcome to the clan, you are a Member",
            recruit: "Welcome to the clan, you are a Recruit",
            mercenary: "Welcome to the clan, you are a Mercenary",
        },
        acceptedBody: "The recruiters accepted your application to {game}.",
        roles: {
            one: "You get the {roles} role on the server within a minute.",
            other: "You get the roles {roles} on the server within a minute.",
        },
        rejectedTitle: "Your application was not accepted",
        rejectedHelp:
            "If you have a question, open a ticket on the {clan} server in the {channel} channel.",
        rejectedHelpNoTickets:
            "If you have a question, write to the admins on the {clan} server.",
        pendingTitle: "Your application is awaiting a decision",
        pendingBody:
            "The recruiters have put your application on hold for now. We will let you know when they decide.",
        openThread: "Open thread",
        confirmationTitle: "Application #{number} is sent",
        confirmationBody:
            "Recruiters will get back to you in the application thread. You also get the decision here by DM.",
    },
    command: {
        closedTitle: "Application #{number} closed: {outcome}",
        rejectedTitle: "Application #{number} rejected",
        roles: {
            one: "{name} gets the {roles} role within a minute.",
            other: "{name} gets the roles {roles} within a minute.",
        },
        delivered:
            "The decision is in the thread and the applicant got it by DM.",
        notDelivered:
            "The decision is in the thread. The applicant cannot receive DMs and will find it there.",
        dmOff: "The decision is in the thread. The clan switched decision DMs off in the message settings.",
        wrongPlace: {
            title: "/close_application only works in an application thread",
            body: "Open the application thread and run the command there.",
        },
        alreadyClosed: {
            title: "Application #{number} is already closed",
            body: "Decision: {outcome}. Change the membership on the web in Members.",
            members: "Members in Logi",
        },
        notAllowedTitle: "Recruiters decide on this application",
    },
}

const de: Copy = {
    listAnd: "und",
    defaultForm: {
        source: {
            label: "Woher kennst du uns?",
            options: [
                "Von einem Freund im Clan",
                "Vom Server des Clans",
                "Über Discord",
                "Woanders her",
            ],
        },
        age: { label: "Alter", placeholder: "Z. B. 24" },
        hours: {
            label: "Wie viele Stunden spielst du pro Woche?",
            placeholder: "Z. B. 10–15 Stunden",
        },
        why: {
            label: "Warum willst du mit uns spielen?",
            placeholder: "Ein paar Sätze reichen.",
        },
        specialization: {
            label: "Spezialisierung",
            help: "Nur bei Hell Let Loose.",
            options: ["Infanterie", "Panzer", "Recon"],
        },
        when: {
            label: "Wann spielst du meistens?",
            help: "Du kannst mehrere auswählen.",
            options: ["Abends unter der Woche", "Am Wochenende"],
        },
        microphone: { label: "Hast du ein Mikrofon?" },
        previousClan: {
            label: "In welchem Clan hast du vorher gespielt?",
            placeholder: "Optional",
        },
        referrer: {
            label: "Wer hat dich eingeladen?",
            help: "Ein Mitglied dieses Servers.",
        },
    },
    panel: {
        apply: "Jetzt bewerben",
        applyOnWeb: "Bewerbung im Web ausfüllen",
        windowsNote: {
            two: "Die Bewerbung hat zwei kurze Fenster und dauert etwa 2 Minuten.",
            three: "Die Bewerbung hat drei kurze Fenster und dauert etwa 3 Minuten.",
        },
        defaultTitle: "Werde Teil des Clans {clan}",
        defaultTitleNoClan: "Mach mit",
        defaultText: {
            two: "Wähl aus, wie du mit uns spielen willst. Die Bewerbung hat zwei kurze Fenster und dauert ein paar Minuten.",
            three: "Wähl aus, wie du mit uns spielen willst. Die Bewerbung hat drei kurze Fenster und dauert ein paar Minuten.",
        },
    },
    label: "Bewerbung bei {clan}",
    step: "Schritt {step} von {total}",
    reviewStep: "Prüfen",
    windowTitle: "Bewerbung · {step} von {total} · {name}",
    windowTitleExtra: "Bewerbung · {step}{suffix} · {name}",
    windowNames: {
        about: "Über dich",
        accounts: "Spielkonten",
        questions: "Fragen des Clans",
    },
    fields: {
        games: {
            label: "Spiele",
            help: "Wähle eins oder beide.",
            placeholder: "Spiele wählen",
        },
        category: {
            label: "Kategorie",
            help: "Wie du mit uns spielen willst.",
            placeholder: "Kategorie wählen",
        },
        name: {
            label: "Spielername",
            help: "Genau so, wie du ihn im Spiel siehst.",
        },
        previous: {
            label: "Haben wir dich auf den Servern gefunden?",
            help: "Nach dem Spielernamen {name} aus dem ersten Fenster.",
            none: "Nichts davon",
            noneHelp: "Ich gebe mein Konto unten ein",
            seen: "{platform} · zuletzt {date} auf {server}",
            seenNoServer: "{platform} · zuletzt {date}",
        },
        steam: {
            label: "Steam-ID oder Profillink",
            help: "17 Ziffern, beginnend mit 7656119, oder ein Link steamcommunity.com/profiles/…",
        },
        epic: { label: "Epic Account ID", placeholder: "Optional" },
        xbox: { label: "Xbox", placeholder: "Optional" },
        playstation: { label: "PlayStation", placeholder: "Optional" },
        selectPlaceholder: "Option wählen",
        memberPlaceholder: "Mitglied wählen",
        optional: "Optional",
        yes: "Ja",
        no: "Nein",
    },
    platforms: {
        steam: "Steam",
        epic: "Epic",
        xbox: "Xbox",
        playstation: "PlayStation",
        other: "Konto",
    },
    progress: {
        intro: {
            about: "Das erste Fenster fragt nach Spielen, Kategorie und Spielername.",
            accounts:
                "Das nächste Fenster fragt nach Steam, Epic oder einer Konsole. Ein Konto reicht.",
            questions: "Das nächste Fenster hat die Fragen des Clans.",
            questionsMore:
                "Das nächste Fenster hat die restlichen Fragen des Clans.",
        },
        done: "fertig",
        fix: "korrigieren",
        steamVerified: "✓ Steam bestätigt",
        accountsPending:
            "Du kannst Steam im Web bestätigen. Dann musst du es im Fenster nicht abtippen.",
        accountsVerified: "Steam {id} · im Fenster schon ausgefüllt",
        accountsLocked:
            "Bestätige Steam im Web; eine getippte Steam-ID geht hier nicht. Konsole und Epic gibst du im Fenster ein.",
        questionsCount: {
            one: "{count} Frage, dann prüfen",
            other: "{count} Fragen, dann prüfen",
        },
        ageValue: "{value} Jahre",
        continue: "Weiter",
        edit: "Bearbeiten",
        cancel: "Abbrechen",
        verifySteam: "Steam im Web bestätigen (empfohlen)",
        verifySteamRequired: "Steam im Web bestätigen",
        findAccount: "Konto-ID finden",
        keepNote: "Eine angefangene Bewerbung heben wir 24 h auf.",
    },
    review: {
        title: "Prüfen und abschicken",
        submit: "Bewerbung abschicken",
        cancel: "Abbrechen",
        note: "Eine angefangene Bewerbung heben wir 24 h auf, dann wird sie gelöscht. Die Rekrutierung sieht die Bewerbung erst nach dem Abschicken.",
        games: "Spiele",
        category: "Kategorie",
        name: "Spielername",
    },
    summaryLabels: {
        source: "Woher",
        age: "Alter",
        referrer: "Eingeladen von",
        specialization: "Spezialisierung",
    },
    fixTitle: {
        about: "Korrigiere deine Angaben",
        accounts: "Korrigiere deine Spielkonten",
        questions: "Korrigiere deine Antworten",
    },
    fixButton: {
        about: "Angaben korrigieren",
        accounts: "Spielkonten korrigieren",
        questions: "Antworten korrigieren",
    },
    issues: {
        required: "{field}: dieses Feld ist Pflicht.",
        number: "{field}: gib eine Zahl ein.",
        tooLong: "{field}: die Antwort ist zu lang.",
        choice: "{field}: wähle eine der angebotenen Optionen.",
        tooFew: "{field}: wähle mehr Optionen.",
        tooMany: "{field}: wähle weniger Optionen.",
        member: "{field}: wähle ein Mitglied dieses Servers.",
        steam: "Die Steam-ID sieht nicht richtig aus. Sie hat 17 Ziffern und beginnt mit 7656119.",
        accountMissing: "Gib mindestens ein Spielkonto an.",
        unknown:
            "Das Fenster hat sich inzwischen geändert. Fülle es bitte noch einmal aus.",
    },
    sent: {
        title: "Bewerbung abgeschickt",
        body: "Die Rekrutierung meldet sich im Thread {thread}. Die Entscheidung bekommst du auch per DM.",
        openThread: "Thread öffnen",
    },
    cancelled: {
        title: "Bewerbung abgebrochen",
        body: "Es wurde nichts gesendet. Eine neue startest du mit Jetzt bewerben in {channel}.",
    },
    expired: {
        title: "Diese Bewerbung ist abgelaufen",
        body: "Angefangene Antworten wurden nicht gespeichert. Starte neu mit Jetzt bewerben in {channel}.",
    },
    windowExpired: {
        title: "Das Fenster wurde geschlossen, bevor du es abgeschickt hast",
        body: "Deine gespeicherten Schritte bleiben: {steps}. Mach dort weiter und fülle {window} noch einmal aus.",
        bodyNothing: "Bisher ist nichts gespeichert. Fang mit {window} an.",
        continue: "Weiter",
    },
    alreadyInClan: {
        title: "Du bist schon im Clan {clan}",
        body: "Wenn du Rolle oder Kategorie ändern willst, schreib den Admins per Ticket in {tickets}.",
        bodyNoTickets:
            "Wenn du Rolle oder Kategorie ändern willst, schreib den Admins des Clans.",
    },
    openApplication: {
        title: "Du hast schon die offene Bewerbung #{number}",
        body: "Warte, bis die Rekrutierung entscheidet. Du bekommst eine DM.",
        open: "Thread öffnen",
    },
    closed: {
        title: "Bewerbungen sind gerade geschlossen",
        body: "Versuch es später oder frag die Admins in {channel}.",
        bodyNoChannel: "Versuch es später oder frag die Admins des Clans.",
    },
    sendFailed: {
        title: "Die Bewerbung konnte nicht abgeschickt werden",
        body: "Es wurde nichts gespeichert. Die Admins wurden benachrichtigt; versuch es bitte gleich noch einmal.",
    },
    threadName: "bewerbung-{name}",
    closedThreadName: "geschlossen · {name}",
    welcome: {
        withRoles:
            "Hallo {applicant}, danke für deine Bewerbung. {support_roles} meldet sich bald bei dir.",
        withoutRoles:
            "Hallo {applicant}, danke für deine Bewerbung. Die Rekrutierung meldet sich bald bei dir.",
    },
    card: {
        label: "Bewerbung #{number} · {games}",
        closedLabel: "Bewerbung #{number} · geschlossen",
        title: "{name} · {category}",
        pending: "Wartet auf Entscheidung",
        submitted: "abgeschickt {time}",
        inGameName: "Spielername {name}",
        accounts: "Konten",
        source: "Kennt uns",
        invitedBy: "eingeladen von {member}",
        undecided: "Noch nicht entschieden · {name}, {time}",
        undecidedNote:
            "Der Thread bleibt offen, der Bewerber bekommt nichts. Die Buttons bleiben.",
        deciders: "Entscheiden können {roles} und Logi-Admins",
        decidersAdmins: "Entscheiden können Logi-Admins",
        accept: {
            member: "Als Mitglied aufnehmen",
            recruit: "Als Rekrut aufnehmen",
            mercenary: "Als Söldner aufnehmen",
        },
        reject: "Ablehnen…",
        undecidedButton: "Noch nicht entschieden",
        mercenaryUnavailable:
            "Söldner können noch nicht aufgenommen werden: Der Clan hat keine Söldner-Kategorie.",
        decidedTitle: {
            member: "{name} ist als Mitglied aufgenommen",
            recruit: "{name} ist als Rekrut aufgenommen",
            mercenary: "{name} ist als Söldner aufgenommen",
            pending: "{name} wartet auf eine Entscheidung",
            denied: "{name} wurde nicht aufgenommen",
        },
        outcome: {
            member: "Mitglied",
            recruit: "Rekrut",
            mercenary: "Söldner",
            pending: "Wartet auf Entscheidung",
            denied: "Abgelehnt",
        },
        rolesPending: "Rollen werden vergeben",
        decidedBy: "Entschieden von {member} · {time}",
        rolesAdd: {
            one: "Logi vergibt die Rolle {roles} innerhalb einer Minute.",
            other: "Logi vergibt die Rollen {roles} innerhalb einer Minute.",
        },
        rolesRemove: {
            one: "Logi entfernt die Rolle {roles} innerhalb einer Minute.",
            other: "Logi entfernt die Rollen {roles} innerhalb einer Minute.",
        },
        closedFooter: "Der Thread ist gesperrt und archiviert",
    },
    rejectModal: {
        title: "Bewerbung #{number} ablehnen",
        body: "{name} bekommt den Grund per DM. Der Thread wird dann gesperrt und archiviert.",
        reason: "Grund",
        reasonHelp: "Der Bewerber sieht ihn.",
        reasonPlaceholder:
            "Z. B. wir nehmen gerade keine Reserve auf, versuch es im November.",
    },
    decision: {
        notAllowed: {
            title: "Über Bewerbungen entscheidet die Rekrutierung",
            body: "Bewerbungen der Kategorie {category} bearbeiten {roles} oder Logi-Admins.",
            bodyAdmins:
                "Bewerbungen der Kategorie {category} bearbeiten Logi-Admins.",
        },
        unverifiable: {
            title: "Deine Rollen lassen sich gerade nicht prüfen",
            body: "Discord hat nicht geantwortet. Versuch es gleich noch einmal.",
        },
        alreadyDecided: {
            title: "Über Bewerbung #{number} ist schon entschieden",
            body: "Entschieden von {member}: {outcome}. Die Mitgliedschaft änderst du im Web unter Mitglieder.",
            members: "Mitglieder in Logi",
        },
        notTracked: {
            title: "Dieser Thread ist keine Bewerbung",
            body: "Entschieden wird im Thread, der aus einer Bewerbung entstanden ist.",
        },
        noMercenaryCategory: {
            title: "Der Clan hat keine Söldner-Kategorie",
            body: "Ein Admin legt sie in Logi unter Einstellungen → Mitgliedschaft → Kategorien an. Dann kannst du Söldner aufnehmen.",
        },
        dmFailed:
            "Dem Bewerber kann keine DM geschickt werden. Er findet die Entscheidung im Bewerbungsthread.",
    },
    dm: {
        label: "Clan {clan} · Bewerbung #{number}",
        accepted: {
            member: "Willkommen im Clan, du bist Mitglied",
            recruit: "Willkommen im Clan, du bist Rekrut",
            mercenary: "Willkommen im Clan, du bist Söldner",
        },
        acceptedBody:
            "Die Rekrutierung hat deine Bewerbung für {game} angenommen.",
        roles: {
            one: "Die Rolle {roles} bekommst du auf dem Server innerhalb einer Minute.",
            other: "Die Rollen {roles} bekommst du auf dem Server innerhalb einer Minute.",
        },
        rejectedTitle: "Deine Bewerbung wurde nicht angenommen",
        rejectedHelp:
            "Wenn du eine Frage hast, öffne ein Ticket auf dem Server {clan} im Kanal {channel}.",
        rejectedHelpNoTickets:
            "Wenn du eine Frage hast, schreib den Admins auf dem Server {clan}.",
        pendingTitle: "Deine Bewerbung wartet auf eine Entscheidung",
        pendingBody:
            "Die Rekrutierung hat deine Bewerbung vorerst zurückgestellt. Wir melden uns, wenn sie entscheidet.",
        openThread: "Thread öffnen",
        confirmationTitle: "Bewerbung #{number} ist abgeschickt",
        confirmationBody:
            "Die Rekrutierung meldet sich im Bewerbungsthread. Die Entscheidung bekommst du auch hier per DM.",
    },
    command: {
        closedTitle: "Bewerbung #{number} geschlossen: {outcome}",
        rejectedTitle: "Bewerbung #{number} abgelehnt",
        roles: {
            one: "{name} bekommt die Rolle {roles} innerhalb einer Minute.",
            other: "{name} bekommt die Rollen {roles} innerhalb einer Minute.",
        },
        delivered:
            "Die Entscheidung steht im Thread und der Bewerber hat sie per DM bekommen.",
        notDelivered:
            "Die Entscheidung steht im Thread. Dem Bewerber kann keine DM geschickt werden, er findet sie dort.",
        dmOff: "Die Entscheidung steht im Thread. Der Clan hat Entscheidungs-DMs in den Nachrichteneinstellungen ausgeschaltet.",
        wrongPlace: {
            title: "/close_application funktioniert nur im Bewerbungsthread",
            body: "Öffne den Bewerbungsthread und starte den Befehl dort.",
        },
        alreadyClosed: {
            title: "Bewerbung #{number} ist schon geschlossen",
            body: "Entscheidung: {outcome}. Die Mitgliedschaft änderst du im Web unter Mitglieder.",
            members: "Mitglieder in Logi",
        },
        notAllowedTitle: "Über diese Bewerbung entscheidet die Rekrutierung",
    },
}

const applicationMessages: Record<ClanLanguage, Copy> = { cs, en, de, pl, fr }

export const getApplicationMessages: (
    language?: string | null
) => ApplicationCopy = clanCopy(applicationMessages)

/** The panel defaults of every clan language, to recognise a default text. */
export const applicationPanelDefaults: readonly PanelDefaultCopy[] = [
    cs.panel,
    en.panel,
    de.panel,
    pl.panel,
    fr.panel,
]
