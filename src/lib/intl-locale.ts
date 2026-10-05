/** The `Intl` locale used to format dates and numbers for an app locale. */
export function toIntlLocale(locale: string): string {
    if (locale === "cs") return "cs-CZ"
    if (locale === "de") return "de-DE"
    return "en-GB"
}
