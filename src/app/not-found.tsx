import { getLocale } from "next-intl/server"

import { PublicNotFoundPage } from "@/components/app/not-found-page"
import { RootDocument } from "@/components/providers/root-document"
import { defaultLocale, isLocale } from "@/i18n/config"

/**
 * 404 for addresses no route matches. It renders above `[locale]/layout.tsx`,
 * so it brings its own document, in the language the i18n proxy resolved.
 */
export default async function NotFound() {
    const locale = await getLocale().catch(() => defaultLocale)
    return (
        <RootDocument lang={isLocale(locale) ? locale : defaultLocale}>
            <PublicNotFoundPage />
        </RootDocument>
    )
}
