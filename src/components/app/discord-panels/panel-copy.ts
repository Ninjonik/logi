import type { PanelError } from "@/domain/discord-publications/panel-delivery"
import type { Dictionary } from "@/i18n/dictionaries"

/** Replaces `{name}` placeholders. */
export function fill(
    template: string,
    values: Record<string, string | number>
) {
    return template.replace(/\{(\w+)\}/g, (match, key: string) =>
        key in values ? String(values[key]) : match
    )
}

export type PluralForms = {
    one: string
    few: string
    many: string
    other: string
}

/** The reader's plural form of `forms` with `{count}` filled in. */
export function plural(forms: PluralForms, count: number, locale: string) {
    const form = new Intl.PluralRules(locale).select(count)
    const template =
        form === "one" || form === "few" || form === "many"
            ? forms[form]
            : forms.other
    return fill(template, { count })
}

/** "Zápas a Liga", "A, B a C". */
export function joinWords(items: readonly string[], and: string) {
    if (items.length <= 1) return items.join("")
    return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`
}

/**
 * The plain sentence and fix step of a panel error (P1-16, P2-32), from the
 * `discordPanelStatus.errors` copy with the channel and permission names.
 * `past` words an error the panel already recovered from ("Discord
 * neodpověděl včas.").
 */
export function panelErrorText(
    error: Pick<PanelError, "code" | "permissions">,
    input: { channel: string; dictionary: Dictionary; past?: boolean }
) {
    const status = input.dictionary.discordPanelStatus
    const copy = status.errors[error.code]
    const permissions = joinWords(
        (error.permissions ?? []).map((name) => status.permissions[name]),
        input.dictionary.discordPanelsPage.list.meta.and
    )
    const values = { channel: input.channel, permissions }
    return {
        title: fill(input.past ? copy.past : copy.title, values),
        fix: fill(copy.fix, values),
    }
}

/** `#name` of a channel, or the unknown-channel word. */
export function channelLabel(
    channelId: string | null | undefined,
    channels: ReadonlyArray<{ id: string; name: string }> | null,
    unknown: string
) {
    if (!channelId) return unknown
    const found = channels?.find((channel) => channel.id === channelId)
    return found ? `#${found.name}` : unknown
}
