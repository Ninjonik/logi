import { Skeleton } from "@/components/ui/skeleton"

/** Loading states in the shape of the clan workspace pages (design K4). */
function HeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
    return (
        <div className="flex flex-col gap-4 px-4 lg:flex-row lg:items-end lg:justify-between lg:px-6">
            <div className="space-y-2">
                <Skeleton className="h-8 w-44 rounded-xl" />
                <Skeleton className="h-4 w-full max-w-xl rounded" />
            </div>
            {withAction ? <Skeleton className="h-10 w-36 rounded-xl" /> : null}
        </div>
    )
}

export function CalendarPageSkeleton() {
    return (
        <div role="status" aria-busy="true" className="space-y-6">
            <HeaderSkeleton />
            <div className="space-y-6 px-4 lg:px-6">
                <div className="border-border/60 overflow-hidden rounded-2xl border">
                    <div className="flex items-center justify-between border-b px-4 py-4">
                        <Skeleton className="h-7 w-40 rounded-lg" />
                        <Skeleton className="h-9 w-32 rounded-xl" />
                    </div>
                    <div className="divide-y md:hidden">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="flex gap-3 px-4 py-3">
                                <Skeleton className="h-5 w-14 rounded" />
                                <Skeleton className="h-12 flex-1 rounded-xl" />
                            </div>
                        ))}
                    </div>
                    <div className="hidden grid-cols-7 md:grid">
                        {Array.from({ length: 35 }).map((_, index) => (
                            <div
                                key={index}
                                className="border-border/60 min-h-28 border-r border-b p-2 [&:nth-child(7n)]:border-r-0"
                            >
                                <Skeleton className="size-7 rounded-full" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export function CardListSkeleton({
    withAction = true,
}: {
    withAction?: boolean
}) {
    return (
        <div role="status" aria-busy="true" className="space-y-6">
            <HeaderSkeleton withAction={withAction} />
            <div className="space-y-4 px-4 lg:px-6">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="border-border/60 space-y-3 rounded-2xl border p-6"
                    >
                        <Skeleton className="h-5 w-2/3 max-w-sm rounded" />
                        <Skeleton className="h-4 w-full max-w-xl rounded" />
                        <Skeleton className="h-3 w-24 rounded" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function ActivityListSkeleton() {
    return (
        <div role="status" aria-busy="true" className="space-y-6">
            <HeaderSkeleton />
            <div className="px-4 lg:px-6">
                <div className="border-border/60 divide-y rounded-2xl border">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="flex items-start gap-3 p-4">
                            <Skeleton className="size-5 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-48 rounded" />
                                <Skeleton className="h-3 w-64 max-w-full rounded" />
                            </div>
                            <Skeleton className="h-3 w-20 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
