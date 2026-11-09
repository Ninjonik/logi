/** The `Intl` locale used to format dates and numbers for an app locale. */
export function toIntlLocale(locale: string): string {
    if (locale === "cs") return "cs-CZ"
    if (locale === "de") return "de-DE"
    if (locale === "fr") return "fr-FR"
    if (locale === "pl") return "pl-PL"
    return "en-GB"
}
