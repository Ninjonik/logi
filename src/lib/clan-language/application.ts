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
        recruitPending: "Rekrut · čeká na rozhodnutí",
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
        description: "Rozhodne o přihlášce v tomto vlákně.",
        outcomeOption: "Čím se uchazeč stane",
        reasonOption: "Důvod, který uchazeč uvidí v DM.",
        choices: {
            member: "Člen",
            recruit: "Rekrut",
            mercenary: "Žoldák",
            pending: "Čeká na rozhodnutí",
            denied: "Zamítnuto",
        },
        closedTitle: "Přihláška #{number} uzavřena: {outcome}",
        rejectedTitle: "Přihláška #{number} zamítnuta",
        roles: {
            one: "{name} dostane roli {roles} do minuty.",
            other: "{name} dostane role {roles} do minuty.",
        },
        delivered: "Rozhodnutí je ve vlákně a uchazeč ho dostal do DM.",
        notDelivered:
            "Rozhodnutí je ve vlákně. Uchazeči nejde poslat DM, najde ho tam.",
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
        recruitPending: "Recruit · awaiting decision",
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
        description: "Decides the application in this thread.",
        outcomeOption: "What the applicant becomes",
        reasonOption: "Reason the applicant sees in the DM.",
        choices: {
            member: "Member",
            recruit: "Recruit",
            mercenary: "Mercenary",
            pending: "Awaiting decision",
            denied: "Rejected",
        },
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
        recruitPending: "Rekrut · wartet auf Entscheidung",
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
        description: "Entscheidet über die Bewerbung in diesem Thread.",
        outcomeOption: "Was der Bewerber wird",
        reasonOption: "Grund, den der Bewerber in der DM sieht.",
        choices: {
            member: "Mitglied",
            recruit: "Rekrut",
            mercenary: "Söldner",
            pending: "Wartet auf Entscheidung",
            denied: "Abgelehnt",
        },
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

const applicationMessages: Record<ClanLanguage, Copy> = { cs, en, de }

export const getApplicationMessages: (
    language?: string | null
) => ApplicationCopy = clanCopy(applicationMessages)
