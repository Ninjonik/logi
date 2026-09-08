import { enMessages } from "@/i18n/messages/en"
import { deMessages } from "@/i18n/messages/de"
import { csMessages } from "@/i18n/messages/cs"
import type { Locale } from "@/i18n/config"

const dictionaries = {
    en: enMessages,
    cs: csMessages,
    de: deMessages,
} satisfies Record<
    Locale,
    typeof enMessages | typeof csMessages | typeof deMessages
>

export type Dictionary = (typeof dictionaries)[Locale]

export function getDictionary(locale: Locale): Dictionary {
    return dictionaries[locale]
}
