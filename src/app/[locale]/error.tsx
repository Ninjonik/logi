"use client"

import { useLocale } from "next-intl"
import Link from "next/link"

import { RouteError } from "@/components/app/route-error"
import { Logo } from "@/components/logo"

/** A public page (or the dashboard frame itself) failed to render. */
export default function PublicError({
    error,
    retry,
}: {
    error: Error & { digest?: string }
    retry: () => void
}) {
    const locale = useLocale()
    return (
        <div className="bg-background text-foreground flex min-h-dvh flex-col">
            <header className="border-b">
                <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6 lg:px-8">
                    <Link
                        href={`/${locale}`}
                        className="inline-flex items-center gap-2.5 text-sm font-semibold tracking-wide"
                    >
                        <span className="bg-card flex size-9 items-center justify-center rounded-lg border">
                            <Logo size={19} />
                        </span>
                        Logi
                    </Link>
                </div>
            </header>
            <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-10 sm:px-6">
                <RouteError error={error} retry={retry} />
            </main>
        </div>
    )
}
