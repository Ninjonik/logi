import { CircleAlert, Circle } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { getLogiServices, overallLogiStatus } from "@/lib/logi-status"
import { EmptyState } from "@/components/app/empty-state"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Service status",
    robots: { index: false, follow: false },
}

const toneClassName = {
    operational: "text-emerald-600 dark:text-emerald-400",
    degraded: "text-amber-600 dark:text-amber-400",
    unknown: "text-muted-foreground",
} as const

export default async function StatusPage({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const t = getDictionary(safeLocale).publicSite.status
    const services = await getLogiServices()
    // The overall status comes from the same read as the list, so the two
    // never disagree and no external status URL is needed to show it.
    const status = overallLogiStatus(services)

    return (
        <PublicSiteShell locale={safeLocale}>
            <PublicPage className="max-w-2xl">
                <section className="bg-card w-full rounded-2xl border p-6 shadow-sm sm:p-8">
                    <p className="text-muted-foreground text-sm font-medium">
                        {t.eyebrow}
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                        {t.title}
                    </h1>
                    <p
                        className={`mt-6 flex items-center gap-2 text-base font-medium ${toneClassName[status]}`}
                    >
                        <Circle
                            className="size-3 fill-current"
                            aria-hidden="true"
                        />
                        {t[status]}
                    </p>
                    <p className="text-muted-foreground mt-4 text-sm">
                        {t.description}
                    </p>
                    {services ? (
                        <ul className="mt-6 divide-y rounded-lg border">
                            {services.map((service) => (
                                <li
                                    key={service.name}
                                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                                >
                                    <span className="min-w-0 break-words">
                                        {service.name}
                                    </span>
                                    <span
                                        className={`inline-flex shrink-0 items-center gap-1.5 ${
                                            service.online
                                                ? toneClassName.operational
                                                : toneClassName.degraded
                                        }`}
                                    >
                                        <span
                                            className="inline-block size-2 rounded-full bg-current"
                                            aria-hidden="true"
                                        />
                                        {service.online
                                            ? t.serviceOperational
                                            : t.serviceDegraded}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <EmptyState
                            className="mt-6"
                            icon={CircleAlert}
                            title={t.unavailableTitle}
                            description={t.unavailableDescription}
                            actions={
                                <Button
                                    asChild
                                    variant="outline"
                                    className="rounded-xl"
                                >
                                    <Link href={`/${safeLocale}/status`}>
                                        {t.reload}
                                    </Link>
                                </Button>
                            }
                        />
                    )}
                </section>
            </PublicPage>
        </PublicSiteShell>
    )
}
