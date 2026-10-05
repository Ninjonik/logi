/**
 * The shape of the ticket copy (boards L4 1.4, M3 1.5 and L2 1.8). The
 * words live in `src/lib/clan-language/tickets.ts` in cs, en and de; the
 * views take them as input and hold no fixed words.
 */

export type TicketCopy = {
    panel: {
        /** Placeholder of the category select a panel with many categories uses. */
        selectPlaceholder: string
    }
    form: {
        /** The window's title when a category has no name. */
        fallbackTitle: string
    }
    opened: {
        /** "Ticket #{number} je otevřený". */
        title: string
        /** "Pokračuj ve vlákně {thread}. Podpora se ti ozve tam." */
        body: string
        openThread: string
    }
    failed: { title: string; body: string }
    disabled: { title: string; body: string }
    staleCategory: { title: string; body: string }
    thread: {
        /** "{category} #{number}". */
        name: string
        /** "uzavřeno · {category} #{number}". */
        closedName: string
        /** "Ticket #{number} · {category}". */
        label: string
        /** The card title when the category has none: "{author} · {category}". */
        title: string
        openChip: string
        /** "Otevřeno {time}". */
        openedAt: string
        /** "Ticket uzavře podpora příkazem /close_ticket". */
        footer: string
    }
    closed: {
        /** "Ticket #{number} · uzavřen". */
        label: string
        title: string
        chip: string
        /** "Zavřel {closer} · {time}". */
        closedBy: string
        /** "Vlákno je zamčené a archivované". */
        footer: string
        /** The audit log reason without a stated reason. */
        auditReason: string
    }
    dm: {
        /** "Klan {clan} · Ticket #{number}". */
        label: string
        title: string
        /** "{category} · zavřel {closer}". */
        closedBy: string
        openThread: string
    }
    close: {
        /** "Ticket #{number} je uzavřený". */
        successTitle: string
        successBody: string
        dmFailedBody: string
        /** The clan switched the ticket-closed DM off (N1-42). */
        dmOffBody: string
        notAllowedTitle: string
        /** "Ticket z kategorie {category} zavírá {roles} nebo správci Logi. …" */
        notAllowedBody: string
        /** The same without support roles: only Logi's admins close it. */
        notAllowedAdminsBody: string
        /** The joiner of the last role: " nebo ". */
        or: string
        unverifiableTitle: string
        unverifiableBody: string
        outsideTitle: string
        outsideBody: string
        notTicketTitle: string
        notTicketBody: string
        /** "Ticket #{number} je už uzavřený". */
        alreadyClosedTitle: string
        alreadyClosedBody: string
    }
}
