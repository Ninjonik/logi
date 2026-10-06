import { fillTemplate } from "../discord-messages/format"

import {
    resolveApplicationForm,
    type ApplicationCategory,
} from "./application-form"
import { applicationWindowCount } from "./application-plan"
import type { ApplicationCopy } from "./application-copy"

/**
 * The application panel's title and text (L6-12, L4-05, L4-06, N4-07,
 * N4-08). A new clan starts with the board copy in the clan language
 * ("Přidej se ke klanu Vlci", "Vyber, jak s námi chceš hrát. …"). A clan
 * that never changed the default text, including the pre-redesign default
 * the dashboard seeded in its own language, gets the current default in the
 * clan language; custom text is kept as written.
 */

export type PanelDefaultCopy = Pick<
    ApplicationCopy["panel"],
    "defaultTitle" | "defaultTitleNoClan" | "defaultText"
>

/** The defaults the dashboard seeded before the redesign (cs, en, de). */
export const LEGACY_PANEL_DEFAULTS = {
    titles: [
        "Přihlásit se do klanu",
        "Apply to the clan",
        "Bewirb dich beim Clan",
    ],
    texts: [
        "Vyberte typ přihlášky, který vám odpovídá. Pokud ještě potřebujeme vaše platform ID, nejdřív vás tím provedeme.",
        "Pick the application type that matches you. If we still need your platform ID, we will guide you through it first.",
        "Wähle die Bewerbungsart, die zu dir passt. Wenn uns deine Plattform-ID noch fehlt, führen wir dich zuerst hindurch.",
    ],
} as const

/** "Přidej se ke klanu Vlci", or "Přidej se k nám" without a clan name. */
export function defaultPanelTitle(copy: PanelDefaultCopy, clanName: string) {
    const clan = clanName.trim()
    return clan
        ? fillTemplate(copy.defaultTitle, { clan })
        : copy.defaultTitleNoClan
}

/** The default text for a panel whose application has `windows` windows. */
export function defaultPanelText(copy: PanelDefaultCopy, windows: 2 | 3) {
    return windows === 3 ? copy.defaultText.three : copy.defaultText.two
}

const same = (left: string, right: string) => left.trim() === right.trim()

/** Whether a stored title is a default (current in any language, or legacy). */
export function isDefaultPanelTitle(
    title: string | null | undefined,
    clanName: string,
    known: readonly PanelDefaultCopy[]
) {
    if (!title?.trim()) return true
    return (
        LEGACY_PANEL_DEFAULTS.titles.some((value) => same(value, title)) ||
        known.some(
            (copy) =>
                same(defaultPanelTitle(copy, clanName), title) ||
                same(copy.defaultTitleNoClan, title)
        )
    )
}

/** Whether a stored text is a default (current in any language, or legacy). */
export function isDefaultPanelText(
    text: string | null | undefined,
    known: readonly PanelDefaultCopy[]
) {
    if (!text?.trim()) return true
    return (
        LEGACY_PANEL_DEFAULTS.texts.some((value) => same(value, text)) ||
        known.some(
            (copy) =>
                same(copy.defaultText.two, text) ||
                same(copy.defaultText.three, text)
        )
    )
}

/**
 * The title and text the panel shows. `defaultText` is true when the text is
 * the default, which already says how many windows the application has, so
 * the panel leaves out its own windows note (as on board N4).
 */
export function effectivePanelCopy(
    input: {
        title?: string | null
        text?: string | null
        clanName: string
        windows: 2 | 3
    },
    copy: PanelDefaultCopy,
    known: readonly PanelDefaultCopy[]
) {
    const defaultText = isDefaultPanelText(input.text, known)
    const title = input.title?.trim() ?? ""
    return {
        title:
            !title || isDefaultPanelTitle(title, input.clanName, known)
                ? defaultPanelTitle(copy, input.clanName)
                : title,
        text: defaultText
            ? defaultPanelText(copy, input.windows)
            : (input.text ?? ""),
        defaultText,
    }
}

/**
 * The recruitment panel's words as the bot posts them (res. 23): the number
 * of windows of the clan's form, the effective title and text, and the
 * separate windows note only under the clan's own text (the default text
 * already names the windows). The bot's panel and the "Panel náboru"
 * preview on "Zprávy a panely" both use it (N1-B07).
 */
export function membershipPanelCopy(
    input: {
        title?: string | null
        text?: string | null
        clanName: string
        /** The stored application form; invalid or missing is the default form. */
        form: unknown
        categories: readonly ApplicationCategory[]
    },
    copy: Pick<ApplicationCopy, "panel" | "defaultForm">,
    known: readonly PanelDefaultCopy[]
) {
    const windows = applicationWindowCount(
        resolveApplicationForm(input.form, input.categories, copy.defaultForm),
        input.categories
    )
    const panel = effectivePanelCopy(
        {
            title: input.title,
            text: input.text,
            clanName: input.clanName,
            windows,
        },
        copy.panel,
        known
    )
    return {
        title: panel.title,
        text: panel.text,
        windowsNote: !panel.defaultText,
        windows,
    }
}
