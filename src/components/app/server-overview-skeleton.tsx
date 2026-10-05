import { Skeleton } from "@/components/ui/skeleton"

function Panel({
    className,
    children,
}: {
    className: string
    children: React.ReactNode
}) {
    return (
        <div
            className={`bg-card flex min-w-0 flex-col gap-4 rounded-2xl border p-5 sm:p-6 ${className}`}
        >
            {children}
        </div>
    )
}

/** Mirrors the clan overview's blocks so route transitions retain their layout. */
export function ServerOverviewSkeleton() {
    return (
        <div
            aria-busy="true"
            aria-live="polite"
            className="mx-auto flex w-full max-w-[70rem] flex-col gap-6 px-4 pb-10 lg:px-6"
        >
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-44" />
                    <Skeleton className="h-4 w-72 max-w-full" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-32 rounded-xl" />
                    <Skeleton className="h-9 w-32 rounded-xl" />
                </div>
            </div>
            <div className="flex flex-wrap items-stretch gap-4">
                <Panel className="flex-[999_1_420px]">
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-6 w-64 max-w-full" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-2 w-full rounded-full" />
                    <div className="flex gap-2">
                        <Skeleton className="h-9 w-36 rounded-xl" />
                        <Skeleton className="h-9 w-28 rounded-xl" />
                    </div>
                </Panel>
                <Panel className="flex-[1_1_300px]">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-4 w-48" />
                </Panel>
            </div>
            <div className="space-y-2.5">
                <Skeleton className="h-3 w-24" />
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(7.5rem,100%),1fr))] gap-2">
                    {Array.from({ length: 7 }, (_, index) => (
                        <Skeleton key={index} className="h-24 rounded-xl" />
                    ))}
                </div>
            </div>
            <Panel className="w-full">
                <Skeleton className="h-3 w-48" />
                <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: 10 }, (_, index) => (
                        <Skeleton key={index} className="size-8 rounded-lg" />
                    ))}
                </div>
            </Panel>
        </div>
    )
}
