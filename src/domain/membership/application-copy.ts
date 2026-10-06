import type { PluralForms } from "../discord-messages/format"

import type { ApplicationDefaultFormCopy } from "./application-form"
import type { ApplicationOutcome } from "./application-decision"

/**
 * Every word of the application in Discord (boards L6, L4 1.0–1.3, M3 1.6
 * and L2 1.8), in one clan language. The copy itself lives in
 * `src/lib/clan-language/application.ts`; the views in
 * `application-views.ts` take it as input, so the bot and the dashboard
 * preview write the same words.
 */
export type ApplicationCopy = {
    /** Intl locale of the clan language. */
    locale: string
    /** The last joint of a list: "Role Klan a Člen". */
    listAnd: string
    defaultForm: ApplicationDefaultFormCopy
    panel: {
        apply: string
        applyOnWeb: string
        /** "Přihláška má tři krátká okna a zabere asi 3 minuty." */
        windowsNote: { two: string; three: string }
        /** The panel title a new clan starts with: "Přidej se ke klanu {clan}". */
        defaultTitle: string
        /** The same without a clan name. */
        defaultTitleNoClan: string
        /** The panel text a new clan starts with, by the number of windows. */
        defaultText: { two: string; three: string }
    }
    /** "Přihláška do klanu {clan}"; the header label adds the step. */
    label: string
    /** "Krok {step} ze {total}". */
    step: string
    reviewStep: string
    /** "Přihláška · {step} ze {total} · {name}". */
    windowTitle: string
    /** "Přihláška · {step}{suffix} · {name}" for 3b and 3c. */
    windowTitleExtra: string
    windowNames: { about: string; accounts: string; questions: string }
    fields: {
        games: { label: string; help: string; placeholder: string }
        category: { label: string; help: string; placeholder: string }
        name: { label: string; help: string }
        previous: {
            label: string
            /** "Podle herního jména {name} z prvního okna." */
            help: string
            none: string
            noneHelp: string
            /** "{platform} · naposledy {date} na {server}". */
            seen: string
            seenNoServer: string
        }
        steam: { label: string; help: string }
        epic: { label: string; placeholder: string }
        xbox: { label: string; placeholder: string }
        playstation: { label: string; placeholder: string }
        selectPlaceholder: string
        memberPlaceholder: string
        optional: string
        yes: string
        no: string
    }
    platforms: {
        steam: string
        epic: string
        xbox: string
        playstation: string
        other: string
    }
    progress: {
        intro: {
            about: string
            accounts: string
            questions: string
            questionsMore: string
        }
        done: string
        fix: string
        steamVerified: string
        accountsPending: string
        /** "Steam {id} · v okně už je vyplněný". */
        accountsVerified: string
        accountsLocked: string
        questionsCount: PluralForms
        /** "{value} let". */
        ageValue: string
        continue: string
        edit: string
        cancel: string
        verifySteam: string
        verifySteamRequired: string
        /** Opens the `/link` guide inside the application (L4-60). */
        findAccount: string
        keepNote: string
    }
    review: {
        title: string
        submit: string
        cancel: string
        note: string
        games: string
        category: string
        name: string
    }
    /** Short labels in summaries ("Odkud: …", "Věk: 24", "Pozval: @…"). */
    summaryLabels: {
        source: string
        age: string
        referrer: string
        specialization: string
    }
    fixTitle: { about: string; accounts: string; questions: string }
    fixButton: { about: string; accounts: string; questions: string }
    issues: {
        /** "{field}: …" */
        required: string
        number: string
        tooLong: string
        choice: string
        tooFew: string
        tooMany: string
        member: string
        steam: string
        accountMissing: string
        unknown: string
    }
    sent: { title: string; body: string; openThread: string }
    cancelled: { title: string; body: string }
    expired: { title: string; body: string }
    windowExpired: {
        title: string
        /** "Uložené kroky zůstaly: {steps}. Pokračuj …, okno {window} vyplň znovu." */
        body: string
        bodyNothing: string
        continue: string
    }
    alreadyInClan: { title: string; body: string; bodyNoTickets: string }
    openApplication: { title: string; body: string; open: string }
    closed: { title: string; body: string; bodyNoChannel: string }
    sendFailed: { title: string; body: string }
    /** Thread names: `{name}` is the applicant, then the thread's own name. */
    threadName: string
    closedThreadName: string
    /** The thread intro when the clan has not written its own welcome (L6-42). */
    welcome: { withRoles: string; withoutRoles: string }
    card: {
        /** "Přihláška #{number} · {games}". */
        label: string
        closedLabel: string
        /** "{name} · {category}". */
        title: string
        pending: string
        /** "podáno {time}". */
        submitted: string
        /** "herní jméno {name}". */
        inGameName: string
        accounts: string
        source: string
        /** "pozval {member}". */
        invitedBy: string
        /** "Ještě nerozhodnuto · {name}, {time}". */
        undecided: string
        undecidedNote: string
        /** "Rozhodnout můžou {roles} a správci Logi". */
        deciders: string
        decidersAdmins: string
        accept: Record<"member" | "recruit" | "mercenary", string>
        reject: string
        undecidedButton: string
        /** Under the buttons while the clan has no mercenary category. */
        mercenaryUnavailable: string
        decidedTitle: Record<ApplicationOutcome, string>
        outcome: Record<ApplicationOutcome, string>
        rolesPending: string
        /** "Rozhodl {member} · {time}". */
        decidedBy: string
        rolesAdd: { one: string; other: string }
        rolesRemove: { one: string; other: string }
        closedFooter: string
    }
    rejectModal: {
        title: string
        body: string
        reason: string
        reasonHelp: string
        reasonPlaceholder: string
    }
    decision: {
        notAllowed: { title: string; body: string; bodyAdmins: string }
        unverifiable: { title: string; body: string }
        alreadyDecided: { title: string; body: string; members: string }
        notTracked: { title: string; body: string }
        /** "Přijmout jako žoldáka" while the clan has no mercenary category. */
        noMercenaryCategory: { title: string; body: string }
        dmFailed: string
    }
    dm: {
        /** "Klan {clan} · Přihláška #{number}". */
        label: string
        accepted: Record<"member" | "recruit" | "mercenary", string>
        /** "Nábor přijal tvoji přihlášku do {game}." */
        acceptedBody: string
        roles: { one: string; other: string }
        rejectedTitle: string
        rejectedHelp: string
        rejectedHelpNoTickets: string
        pendingTitle: string
        pendingBody: string
        openThread: string
        confirmationTitle: string
        confirmationBody: string
    }
    command: {
        /** "Přihláška #{number} uzavřena: {outcome}". */
        closedTitle: string
        rejectedTitle: string
        /** "{name} dostane role {roles} do minuty." */
        roles: { one: string; other: string }
        delivered: string
        notDelivered: string
        /** Decision DMs are switched off in "Zprávy a panely" (N1-39). */
        dmOff: string
        wrongPlace: { title: string; body: string }
        alreadyClosed: { title: string; body: string; members: string }
        notAllowedTitle: string
    }
}
