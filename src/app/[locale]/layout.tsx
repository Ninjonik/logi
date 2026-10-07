import { getMessages, setRequestLocale } from "next-intl/server"
import { NextIntlClientProvider } from "next-intl"
import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { RootDocument } from "@/components/providers/root-document"
import { isLocale, type Locale } from "@/i18n/config"

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>
}): Promise<Metadata> {
    const { locale } = await params
    if (!isLocale(locale)) return {}

    return { openGraph: { locale } }
}

export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    if (!isLocale(locale)) notFound()
    setRequestLocale(locale)
    const messages = await getMessages()

    return (
        <RootDocument lang={locale}>
            <NextIntlClientProvider messages={messages}>
                {children}
            </NextIntlClientProvider>
        </RootDocument>
    )
}

export function generateStaticParams() {
    return [
        { locale: "en" satisfies Locale },
        { locale: "cs" satisfies Locale },
        { locale: "de" satisfies Locale },
    ]
}
