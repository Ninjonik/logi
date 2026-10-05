import { getTranslations } from "next-intl/server"

import { Skeleton } from "@/components/ui/skeleton"

/** "My account" while it loads: the header and its settings sections. */
export default async function Loading() {
    const t = await getTranslations("appStates")
    return (
        <div
            role="status"
            aria-label={t("loadingPage")}
            aria-busy="true"
            className="px-4 pb-12 lg:px-6"
        >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
                <div className="flex items-center gap-4">
                    <Skeleton className="size-14 rounded-full" />
                    <div className="flex flex-1 flex-col gap-2">
                        <Skeleton className="h-7 w-40 rounded-lg" />
                        <Skeleton className="h-4 w-56 max-w-full rounded" />
                    </div>
                </div>
                {[3, 2, 2, 2].map((rows, section) => (
                    <div
                        key={section}
                        className="bg-card flex flex-col rounded-[14px] border px-4 py-2 sm:px-[22px]"
                    >
                        <Skeleton className="mt-3.5 mb-3 h-5 w-36 rounded" />
                        {Array.from({ length: rows }, (_, row) => (
                            <div
                                key={row}
                                className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t py-3.5"
                            >
                                <Skeleton className="h-4 flex-[1_1_200px] rounded" />
                                <Skeleton className="h-9 flex-[2_1_240px] rounded-lg" />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}
