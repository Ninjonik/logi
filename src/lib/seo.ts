import { locales, type Locale } from "@/i18n/config"
import { getSiteUrl } from "@/lib/env"

/** Build stable, absolute public URLs for metadata and sitemap entries. */
export function getPublicUrl(pathname: string) {
    return new URL(pathname, getSiteUrl()).toString()
}

export function getLocalizedAlternates(pathname: string) {
    return {
        languages: Object.fromEntries(
            locales.map((locale) => [
                locale,
                getPublicUrl(`/${locale}${pathname}`),
            ])
        ) as Record<Locale, string>,
        "x-default": getPublicUrl(`/en${pathname}`),
    }
}

export function getLocalizedCanonical(locale: Locale, pathname: string) {
    return {
        canonical: getPublicUrl(`/${locale}${pathname}`),
        languages: getLocalizedAlternates(pathname).languages,
    }
}
