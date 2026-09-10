import type { ReactNode } from "react"

import {
    getVisibleGuildsForLoggedInUser,
    isCurrentUserSuperadmin,
} from "@/lib/auth"
import { DashboardOnboarding } from "@/components/app/dashboard-onboarding"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { SiteHeader } from "@/components/app/site-header"
import { SiteFooter } from "@/components/app/site-footer"
import { AppSidebar } from "@/components/app/app-sidebar"
import type { Dictionary } from "@/i18n/dictionaries"
import type { AppUser } from "@/types/domain"
import type { Locale } from "@/i18n/config"

export async function DashboardShell({
    children,
    dictionary,
    locale,
    user,
}: {
    children: ReactNode
    dictionary: Dictionary
    locale: Locale
    user: AppUser
}) {
    const [visibleServers, isSuperadmin] = await Promise.all([
        getVisibleGuildsForLoggedInUser(),
        isCurrentUserSuperadmin(),
    ])

    return (
        <DashboardOnboarding
            dictionary={dictionary}
            servers={visibleServers}
            onboarding={user.onboarding}
            userId={user.discordId}
        >
            <SidebarProvider className="min-h-dvh [--footer-height:2.5rem] [--header-height:2.5rem] [--sidebar-width-icon:3rem] [--sidebar-width:14.5rem] md:[--header-height:2.75rem] xl:[--header-height:3rem] xl:[--sidebar-width:15rem] 2xl:[--footer-height:4rem] 2xl:[--header-height:3.5rem] 2xl:[--sidebar-width-icon:3.25rem] 2xl:[--sidebar-width:18rem]">
                <AppSidebar
                    locale={locale}
                    dictionary={dictionary}
                    servers={visibleServers}
                    user={user}
                    activeServerId={undefined}
                    canAdmin={false}
                    isSuperadmin={isSuperadmin}
                />
                <SidebarInset className="min-h-dvh overflow-x-hidden bg-[linear-gradient(180deg,rgba(201,168,78,.03),transparent_20%)]">
                    <SiteHeader
                        locale={locale}
                        dictionary={dictionary}
                        servers={visibleServers}
                        user={user}
                    />
                    <div className="relative flex flex-1 flex-col gap-3 py-3 sm:gap-4 sm:py-4 2xl:gap-6 2xl:py-6">
                        {children}
                    </div>
                    <SiteFooter dictionary={dictionary} />
                </SidebarInset>
            </SidebarProvider>
        </DashboardOnboarding>
    )
}
