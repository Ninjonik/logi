"use client"
import dynamic from "next/dynamic"
const DemoPlayers = dynamic(() =>
    import("./native-examples").then((m) => m.DemoPlayers)
)
const DemoNewMatch = dynamic(() =>
    import("./native-examples").then((m) => m.DemoNewMatch)
)
const DemoPlayerProfile = dynamic(() =>
    import("./native-examples").then((m) => m.DemoPlayerProfile)
)
import { useWalkthrough } from "./walkthrough-context"
import type { Dictionary } from "@/i18n/dictionaries"
import type { Locale } from "@/i18n/config"
const SectionExamples = dynamic(() =>
    import("./section-examples").then((m) => m.SectionExamples)
)
import type { ReactNode } from "react"
export function OnboardingPage({
    children,
    dictionary,
    locale,
}: {
    children: ReactNode
    dictionary: Dictionary
    locale: Locale
}) {
    const runtime = useWalkthrough()
    const mock = runtime.active ? runtime.step?.mock : null
    const sampleServerId = runtime.workspaceId ?? "onboarding-example"
    return (
        <div
            id="onboarding-page"
            data-onboarding-example={runtime.active ? "" : undefined}
            className="flex min-h-0 flex-1 flex-col gap-4"
        >
            {mock === "players" ? (
                <DemoPlayers
                    dictionary={dictionary}
                    locale={locale}
                    serverId={sampleServerId}
                />
            ) : mock === "profile" ? (
                <DemoPlayerProfile dictionary={dictionary} locale={locale} />
            ) : mock === "match" ? (
                <DemoNewMatch
                    dictionary={dictionary}
                    locale={locale}
                    serverId={sampleServerId}
                />
            ) : runtime.active && runtime.step ? (
                <SectionExamples
                    chapter={
                        runtime.step.chapter === "players"
                            ? "overview"
                            : runtime.step.chapter === "performance"
                              ? "overview"
                              : runtime.step.chapter
                    }
                    dictionary={dictionary}
                    locale={locale}
                    serverId={sampleServerId}
                    limited={runtime.limited}
                    canManage={runtime.canManage}
                />
            ) : (
                children
            )}
        </div>
    )
}

/** Live clan banners sit outside the page slot and must not leak into sample steps. */
export function OnboardingLiveOnly({ children }: { children: ReactNode }) {
    return useWalkthrough().active ? null : children
}
