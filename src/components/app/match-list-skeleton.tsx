import { Skeleton } from "@/components/ui/skeleton"

function RowsSkeleton({ rows }: { rows: number }) {
    return (
        <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <div className="divide-border/70 divide-y overflow-hidden rounded-[14px] border">
                {Array.from({ length: rows }, (_, index) => (
                    <div
                        key={index}
                        className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-[18px]"
                    >
                        <div className="flex w-14 flex-col items-center gap-1">
                            <Skeleton className="h-3 w-12" />
                            <Skeleton className="h-4 w-10" />
                        </div>
                        <div className="flex min-w-0 flex-[1_1_13.75rem] flex-col gap-1.5">
                            <Skeleton className="h-4 w-48 max-w-full" />
                            <Skeleton className="h-3 w-64 max-w-full" />
                        </div>
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-6 w-32 rounded-full" />
                    </div>
                ))}
            </div>
        </div>
    )
}

/** The match and training lists while they load, in the shape of the list. */
export function MatchListSkeleton({ queue = true }: { queue?: boolean }) {
    return (
        <div
            aria-busy="true"
            aria-live="polite"
            className="mx-auto flex w-full max-w-[70rem] flex-col gap-6 px-4 pb-10 lg:px-6"
        >
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-8 w-56" />
                    <Skeleton className="h-4 w-80 max-w-full" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-32 rounded-lg" />
                    <Skeleton className="h-9 w-32 rounded-lg" />
                </div>
            </div>
            {queue ? (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(16.25rem,100%),1fr))] gap-3">
                    {Array.from({ length: 3 }, (_, index) => (
                        <Skeleton key={index} className="h-[70px] rounded-xl" />
                    ))}
                </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Skeleton className="h-[38px] w-72 max-w-full rounded-[10px]" />
                <Skeleton className="h-8 w-80 max-w-full rounded-lg" />
            </div>
            <RowsSkeleton rows={2} />
            <RowsSkeleton rows={3} />
        </div>
    )
}
