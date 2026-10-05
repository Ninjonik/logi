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
 * Sticky footer of a settings form (designs A2, D4, G2, G3): how many changes
 * are unsaved, discard and save. On phones it is a bar at the bottom of the
 * screen with the count and save (design K2).
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
        <div
            data-mobile-action-bar=""
            className="bg-background/95 supports-[backdrop-filter]:bg-background/80 z-30 flex items-center justify-between gap-3 backdrop-blur max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:border-t max-sm:px-3.5 max-sm:pt-3 max-sm:pb-[max(1.125rem,env(safe-area-inset-bottom))] sm:sticky sm:bottom-0 sm:-mx-1 sm:flex-wrap sm:rounded-xl sm:border sm:px-4 sm:py-3 sm:shadow-sm"
        >
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
                        className="rounded-xl max-sm:hidden"
                        disabled={saving}
                        onClick={onDiscard}
                    >
                        {text.discard}
                    </Button>
                ) : null}
                <Button
                    type="button"
                    className="rounded-xl max-sm:h-11 max-sm:px-6"
                    disabled={!changes || saving}
                    onClick={onSave}
                >
                    {text.save}
                </Button>
            </div>
        </div>
    )
}
