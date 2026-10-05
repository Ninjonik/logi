/**
 * Message forms for a counted phrase. Czech needs `few` (2–4) and `many`
 * (fractions); English and German use only `one` and `other`, so their
 * dictionaries repeat `other` there to keep the keys identical.
 */
export type PluralForms = {
    one: string
    few: string
    many: string
    other: string
}

/** Picks the plural form for `count` in `locale` and fills in `{count}`. */
export function pluralize(
    locale: string,
    count: number,
    forms: PluralForms
): string {
    const category = new Intl.PluralRules(locale).select(count)
    const template =
        category === "one"
            ? forms.one
            : category === "few"
              ? forms.few
              : category === "many"
                ? forms.many
                : forms.other
    return template.split("{count}").join(String(count))
}
