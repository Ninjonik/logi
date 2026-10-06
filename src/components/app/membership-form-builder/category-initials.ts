/** Vowel length marks (á, ů) are dropped; háček letters (Č, Ž) are letters of their own. */
const withoutLength = (value: string) =>
    value.normalize("NFD").replace(/[́̊]/g, "").normalize("NFC")

/**
 * The two-letter badge of a category on the settings page (N4-29..N4-31):
 * the initials of the first two words ("Hlavní člen" → "HČ"), or the first
 * two letters of a one-word name ("Záloha" → "ZA", "Žoldák" → "ŽO").
 */
export function categoryInitials(label: string | null | undefined) {
    const words = (label ?? "").trim().split(/\s+/).filter(Boolean)
    const letters =
        words.length >= 2
            ? words.slice(0, 2).map((word) => Array.from(word)[0] ?? "")
            : Array.from(words[0] ?? "").slice(0, 2)
    return withoutLength(letters.join("")).toLocaleUpperCase() || "?"
}
