"use client"

import { useEffect } from "react"

/**
 * The root layout sits above the `[locale]` segment and cannot know the
 * language without making every page dynamic, so it renders `lang="en"`.
 * This sets the document language from the route: the inline script runs
 * while the page is parsed, before the first paint, and the effect keeps it
 * right after a client-side switch to another language.
 */
export function HtmlLang({ locale }: { locale: string }) {
    useEffect(() => {
        document.documentElement.lang = locale
    }, [locale])
    return (
        <script
            // The locale is one of the configured route locales, never user input.
            dangerouslySetInnerHTML={{
                __html: `document.documentElement.lang=${JSON.stringify(locale)}`,
            }}
        />
    )
}
