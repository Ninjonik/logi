import { PublicNotFoundPage } from "@/components/app/not-found-page"
import { RootDocument } from "@/components/providers/root-document"
import { defaultLocale } from "@/i18n/config"

/**
 * 404 for addresses no route matches. It sits above `[locale]/layout.tsx`,
 * so it brings its own document, and it is static and in the default
 * language: reading the request here (for its locale) would make every page
 * dynamic. A localized page that calls `notFound()` gets the localized 404
 * (`[locale]/not-found.tsx`) instead.
 */
export default function NotFound() {
    return (
        <RootDocument lang={defaultLocale}>
            <PublicNotFoundPage locale={defaultLocale} />
        </RootDocument>
    )
}
