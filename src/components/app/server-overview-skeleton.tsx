import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function StatCardSkeleton() {
    return (
        <Card className="border-border/60 min-w-[220px] flex-1 rounded-2xl lg:basis-0">
            <CardHeader className="pb-2">
                <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-9 w-14" />
                <Skeleton className="mt-2 h-4 w-32" />
            </CardContent>
        </Card>
    )
}

function ChartSkeleton() {
    return (
        <Card className="border-border/60 overflow-hidden rounded-2xl">
            <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-2 h-4 w-28" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-56 w-full rounded-xl" />
            </CardContent>
        </Card>
    )
}

/** Mirrors the server overview's cards so route transitions retain their layout. */
export function ServerOverviewSkeleton() {
    return (
        <div aria-busy="true" aria-live="polite">
            <div className="flex flex-col gap-2 px-4 sm:gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4 lg:px-6">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-56" />
                    <Skeleton className="h-4 w-80 max-w-full" />
                </div>
            </div>
            <div className="space-y-6 px-4 lg:px-6">
                <Card className="border-border/60 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,rgba(90,110,55,.18),rgba(201,168,78,.08))]">
                    <CardHeader>
                        <Skeleton className="h-7 w-36" />
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <Skeleton className="h-3 w-36" />
                                <Skeleton className="mt-3 h-9 w-64 max-w-full" />
                                <Skeleton className="mt-3 h-4 w-96 max-w-full" />
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <Skeleton className="h-10 w-32 rounded-xl" />
                                <Skeleton className="h-10 w-36 rounded-xl" />
                                <Skeleton className="h-10 w-28 rounded-xl" />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <StatCardSkeleton />
                            <StatCardSkeleton />
                            <StatCardSkeleton />
                            <StatCardSkeleton />
                        </div>
                    </CardContent>
                </Card>
                <div className="grid gap-6 xl:grid-cols-2">
                    <ChartSkeleton />
                    <ChartSkeleton />
                    <ChartSkeleton />
                </div>
                <Card className="border-border/60 overflow-hidden rounded-2xl">
                    <CardHeader>
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="mt-2 h-4 w-52" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {Array.from({ length: 4 }, (_, index) => (
                            <Skeleton
                                key={index}
                                className="h-14 w-full rounded-xl"
                            />
                        ))}
                    </CardContent>
                </Card>
                <Card className="border-border/60 overflow-hidden rounded-2xl">
                    <CardHeader>
                        <Skeleton className="h-5 w-36" />
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 lg:grid-cols-7">
                            {Array.from({ length: 7 }, (_, index) => (
                                <div
                                    key={index}
                                    className="border-border/60 rounded-2xl border p-3"
                                >
                                    <Skeleton className="h-3 w-10" />
                                    <Skeleton className="mt-2 h-5 w-16" />
                                    <Skeleton className="mt-4 h-16 w-full rounded-xl" />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
            <span className="sr-only">Loading workspace overview</span>
        </div>
    )
}
