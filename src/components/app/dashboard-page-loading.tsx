import { getTranslations } from "next-intl/server"

import { Skeleton } from "@/components/ui/skeleton"

/** Placeholder rows shaped like a list of matches or members (design K4). */
function ListSkeleton({ rows = 3 }: { rows?: number }) {
    const widths = [
        ["60%", "40%"],
        ["52%", "34%"],
        ["66%", "30%"],
        ["48%", "38%"],
    ]
    return (
        <div className="bg-card flex flex-col overflow-hidden rounded-[14px] border">
            {Array.from({ length: rows }, (_, index) => {
                const [title, meta] = widths[index % widths.length]
                return (
                    <div
                        key={index}
                        className="flex items-center gap-3.5 border-t px-4 py-4 first:border-t-0 sm:px-5"
                    >
                        <Skeleton className="h-9 w-13 shrink-0 rounded-lg" />
                        <div className="flex flex-1 flex-col gap-2">
                            <Skeleton
                                className="h-3 rounded"
                                style={{ width: title }}
                            />
                            <Skeleton
                                className="h-2.5 rounded"
                                style={{ width: meta }}
                            />
                        </div>
                        <Skeleton className="hidden h-5.5 w-22 rounded-full sm:block" />
                    </div>
                )
            })}
        </div>
    )
}

/** Dashboard page loading: a page header and a list, as the page will look. */
export async function DashboardPageLoading() {
    const t = await getTranslations("appStates")
    return (
        <div
            role="status"
            aria-label={t("loadingPage")}
            aria-busy="true"
            className="flex flex-col gap-5 px-4 lg:px-6"
        >
            <div className="flex flex-col gap-2">
                <Skeleton className="h-7 w-48 rounded-lg" />
                <Skeleton className="h-4 w-full max-w-md rounded" />
            </div>
            <ListSkeleton />
        </div>
    )
}

/** Public page loading: the site header bar, a heading and content blocks. */
export async function PublicPageLoading() {
    const t = await getTranslations("appStates")
    return (
        <div
            role="status"
            aria-label={t("loadingPage")}
            aria-busy="true"
            className="bg-background flex min-h-dvh flex-col"
        >
            <div className="border-b">
                <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                    <Skeleton className="size-9 rounded-lg" />
                    <div className="flex gap-2">
                        <Skeleton className="h-8 w-16 rounded-lg" />
                        <Skeleton className="h-8 w-24 rounded-lg" />
                    </div>
                </div>
            </div>
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
                <Skeleton className="h-8 w-64 max-w-full rounded-lg" />
                <Skeleton className="h-4 w-full max-w-xl rounded" />
                <ListSkeleton rows={4} />
            </div>
        </div>
    )
}
