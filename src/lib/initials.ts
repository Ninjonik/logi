/**
 * Two letters for a clan or person without a picture: the first letters of
 * the first two words ("Váš klan" → "VK"), or the first two letters of a
 * single word ("Ninjonik" → "NI").
 */
export function initialsOf(name: string | undefined, fallback = "?"): string {
    const words = (name ?? "").trim().split(/\s+/).filter(Boolean)
    if (!words.length) return fallback
    const letters =
        words.length > 1
            ? `${Array.from(words[0])[0]}${Array.from(words[1])[0]}`
            : Array.from(words[0]).slice(0, 2).join("")
    return letters.toUpperCase()
}
