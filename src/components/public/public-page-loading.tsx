"use client"

import { useTranslations } from "next-intl"

import { Skeleton } from "@/components/ui/skeleton"

/**
 * Public page loading: the site header bar, a heading and list rows. A client
 * component on purpose: Next.js renders a segment's loading UI apart from its
 * layout, so a server version would read the locale from the request and make
 * every localized page dynamic. Here the locale comes from the layout's
 * NextIntlClientProvider.
 */
export function PublicPageLoading() {
    const t = useTranslations("appStates")
    return (
        <div
            role="status"
            aria-label={t("loadingPage")}
            aria-busy="true"
            className="bg-background flex min-h-dvh flex-col"
        >
            <div className="border-b">
                <div className="mx-auto flex h-16 w-full max-w-[75rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                    <Skeleton className="size-9 rounded-lg" />
                    <div className="flex gap-2">
                        <Skeleton className="h-8 w-16 rounded-lg" />
                        <Skeleton className="h-8 w-24 rounded-lg" />
                    </div>
                </div>
            </div>
            <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-5 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
                <Skeleton className="h-8 w-64 max-w-full rounded-lg" />
                <Skeleton className="h-4 w-full max-w-xl rounded" />
                <div className="bg-card flex flex-col overflow-hidden rounded-2xl border">
                    {[60, 52, 66, 48].map((width) => (
                        <div
                            key={width}
                            className="flex items-center gap-3.5 border-t px-4 py-4 first:border-t-0 sm:px-5"
                        >
                            <Skeleton className="h-9 w-13 shrink-0 rounded-lg" />
                            <div className="flex flex-1 flex-col gap-2">
                                <Skeleton
                                    className="h-3 rounded"
                                    style={{ width: `${width}%` }}
                                />
                                <Skeleton
                                    className="h-2.5 rounded"
                                    style={{ width: `${width - 20}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
