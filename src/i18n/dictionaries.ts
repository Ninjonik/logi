import { enMessages } from "@/i18n/messages/en"
import { csMessages } from "@/i18n/messages/cs"
import type { Locale } from "@/i18n/config"

const dictionaries = {
    en: enMessages,
    cs: csMessages,
} satisfies Record<Locale, typeof enMessages | typeof csMessages>

export type Dictionary = (typeof dictionaries)[Locale]

export function getDictionary(locale: Locale): Dictionary {
    return dictionaries[locale]
}
