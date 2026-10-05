/**
 * The admin-written call text (P3 "Text výzvy"). Logi adds the title, the
 * progress and the buttons itself; the text may use four placeholders.
 */

export type SeedTemplateKey = "server" | "players" | "missing" | "threshold"

/** The placeholder spelling offered by the editor in each clan language. */
export const SEED_TEMPLATE_TOKENS: Record<
    "cs" | "en" | "de",
    Record<SeedTemplateKey, string>
> = {
    cs: {
        server: "{server}",
        players: "{hráči}",
        missing: "{chybí}",
        threshold: "{hranice}",
    },
    en: {
        server: "{server}",
        players: "{players}",
        missing: "{missing}",
        threshold: "{threshold}",
    },
    de: {
        server: "{server}",
        players: "{spieler}",
        missing: "{fehlen}",
        threshold: "{schwelle}",
    },
}

const ALIASES: ReadonlyMap<string, SeedTemplateKey> = new Map(
    Object.values(SEED_TEMPLATE_TOKENS).flatMap((tokens) =>
        Object.entries(tokens).map(
            ([key, token]) =>
                [token.slice(1, -1), key as SeedTemplateKey] as const
        )
    )
)
// Plain-ASCII spellings of the Czech placeholders are accepted too.
const ASCII: ReadonlyArray<readonly [string, SeedTemplateKey]> = [
    ["hraci", "players"],
    ["chybi", "missing"],
]

const TOKEN = /\{([^{}\s]{1,24})\}/gu
export const SEED_TEMPLATE_MAX_LENGTH = 600

function keyOf(name: string): SeedTemplateKey | null {
    const normalized = name.normalize("NFC").toLowerCase()
    return (
        ALIASES.get(normalized) ??
        ASCII.find(([alias]) => alias === normalized)?.[1] ??
        null
    )
}

/** Placeholders in the text that Logi does not know, in order of appearance. */
export function unknownSeedTemplatePlaceholders(template: string): string[] {
    const unknown: string[] = []
    for (const match of template.matchAll(TOKEN))
        if (!keyOf(match[1]) && !unknown.includes(match[0]))
            unknown.push(match[0])
    return unknown
}

export type SeedTemplateValues = {
    server: string
    players: number | null
    missing: number | null
    threshold: number
}

/** Fills the known placeholders; an unknown count reads "?". Unknown tokens stay as written. */
export function renderSeedTemplate(
    template: string,
    values: SeedTemplateValues
): string {
    return template.replace(TOKEN, (whole, name: string) => {
        switch (keyOf(name)) {
            case "server":
                return values.server
            case "players":
                return values.players === null ? "?" : String(values.players)
            case "missing":
                return values.missing === null ? "?" : String(values.missing)
            case "threshold":
                return String(values.threshold)
            default:
                return whole
        }
    })
}
