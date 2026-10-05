import { Skeleton } from "@/components/ui/skeleton"

/** The setup guide's frame while the clan's settings load. */
export default function GuidedSetupLoading() {
    return (
        <div className="bg-background min-h-dvh" aria-busy="true">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
                <div className="flex items-center gap-2.5">
                    <Skeleton className="size-7 rounded-lg" />
                    <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-4 w-32" />
            </div>
            <div className="bg-muted h-1" />
            <div className="mx-auto flex max-w-[1040px] flex-col gap-6 px-4 pt-6 sm:px-6 md:flex-row md:items-start md:gap-8 md:pt-10">
                <div className="hidden w-60 shrink-0 flex-col gap-3 md:flex">
                    {Array.from({ length: 6 }, (_, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-3 p-2"
                        >
                            <Skeleton className="size-7 rounded-full" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    ))}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-4 rounded-[14px] border p-5 sm:p-8">
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="h-7 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                </div>
            </div>
        </div>
    )
}
