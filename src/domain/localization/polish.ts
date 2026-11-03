/** Polish counted nouns: 1, 2–4 (except 12–14), remaining integers, fractions. */
export function polishNoun(
    count: number,
    one: string,
    few: string,
    many: string,
    other = many
): string {
    const category = new Intl.PluralRules("pl").select(count)
    return category === "one"
        ? one
        : category === "few"
          ? few
          : category === "many"
            ? many
            : other
}

/** Counts supplied by panel read models may already contain grouping separators. */
export function polishPlayers(count: string | number): string {
    const value =
        typeof count === "number" ? count : Number(count.replace(/[\s,]/g, ""))
    return polishNoun(value, "gracz", "graczy", "graczy")
}
