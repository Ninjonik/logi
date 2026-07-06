import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarConfigProvider } from "@/contexts/sidebar-context";
import { inter } from "@/lib/fonts";

export const metadata: Metadata = {
  metadataBase: new URL("https://logi.local"),
  title: {
    default: "Logi | Hell Let Loose event organizer",
    template: "%s | Logi",
  },
  description:
    "Frontend preview for a Hell Let Loose event organizer built for clans, rosters, briefings, and operations.",
  openGraph: {
    title: "Logi",
    description:
      "Prepare clan events, squad presets, topic briefings, and publish rosters from one dashboard.",
    siteName: "Logi",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className={inter.className}>
        <ThemeProvider defaultTheme="system" storageKey="nextjs-ui-theme">
          <SidebarConfigProvider>
            {children}
          </SidebarConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
