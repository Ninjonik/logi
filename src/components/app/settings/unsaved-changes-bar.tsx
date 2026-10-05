"use client"

import { useLocale } from "next-intl"

import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

/** The text for `count` unsaved changes in the reader's plural form. */
export function unsavedChangesLabel(
    count: number,
    locale: string,
    text: Dictionary["settingsHub"]["saveBar"]
) {
    if (!count) return text.none
    const form = new Intl.PluralRules(locale).select(count)
    const template =
        form === "one" || form === "few" || form === "many"
            ? text.changes[form]
            : text.changes.other
    return template.split("{count}").join(String(count))
}

/**
 * Sticky footer of a settings form (designs D4, G2, G3): how many changes are
 * unsaved, discard and save.
 */
export function UnsavedChangesBar({
    changes,
    saving,
    onDiscard,
    onSave,
    dictionary,
}: {
    changes: number
    saving: boolean
    onDiscard: () => void
    onSave: () => void
    dictionary: Dictionary
}) {
    const locale = useLocale()
    const text = dictionary.settingsHub.saveBar
    return (
        <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-sm backdrop-blur">
            <span
                role="status"
                className={
                    changes
                        ? "text-sm font-medium"
                        : "text-muted-foreground text-sm"
                }
            >
                {unsavedChangesLabel(changes, locale, text)}
            </span>
            <div className="flex gap-2">
                {changes ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        disabled={saving}
                        onClick={onDiscard}
                    >
                        {text.discard}
                    </Button>
                ) : null}
                <Button
                    type="button"
                    className="rounded-xl"
                    disabled={!changes || saving}
                    onClick={onSave}
                >
                    {text.save}
                </Button>
            </div>
        </div>
    )
}
