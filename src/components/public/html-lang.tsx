"use client"

import { useEffect } from "react"

/**
 * The root layout sits above the `[locale]` segment and cannot know the
 * language without making every page dynamic, so it renders `lang="en"`.
 * This sets the document language from the route once the page hydrates,
 * keeps it after a client-side switch to another language, and puts it back
 * whenever React re-applies the root layout's props to `<html>`.
 */
export function HtmlLang({ locale }: { locale: string }) {
    useEffect(() => {
        const root = document.documentElement
        const apply = () => {
            if (root.lang !== locale) root.lang = locale
        }
        apply()
        const observer = new MutationObserver(apply)
        observer.observe(root, { attributes: true, attributeFilter: ["lang"] })
        return () => observer.disconnect()
    }, [locale])
    return null
}
