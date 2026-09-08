import { TopLoaderProvider } from "@/components/providers/top-loader-provider"
import { AppProviders } from "@/components/providers/app-providers"
import { SidebarConfigProvider } from "@/contexts/sidebar-context"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { getSiteUrl } from "@/lib/env"
import type { Metadata } from "next"
import { inter } from "@/lib/fonts"
import "./globals.css"

export const metadata: Metadata = {
    metadataBase: new URL(getSiteUrl()),
    title: {
        default: "Logi | Hell Let Loose event organizer",
        template: "%s | Logi",
    },
    description:
        "Free open-source admin tool for Hell Let Loose clans, rosters, events, briefings, and Discord coordination.",
    openGraph: {
        title: "Logi",
        description:
            "Plan Hell Let Loose clan events, build rosters, prepare briefings, and coordinate through Discord.",
        siteName: "Logi",
        type: "website",
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html
            lang="en"
            className={`${inter.variable} antialiased`}
            data-scroll-behavior="smooth"
        >
            <body className={inter.className}>
                <AppProviders>
                    <ThemeProvider
                        defaultTheme="system"
                        storageKey="nextjs-ui-theme"
                    >
                        <TopLoaderProvider />
                        <SidebarConfigProvider>
                            {children}
                        </SidebarConfigProvider>
                        <Toaster />
                    </ThemeProvider>
                </AppProviders>
            </body>
        </html>
    )
}
