import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, type Locale } from "@/i18n/config";
import { AppSidebar } from "@/components/app/app-sidebar";
import { SiteFooter } from "@/components/app/site-footer";
import { SiteHeader } from "@/components/app/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentPlayer, getVisibleGuildsForLoggedInUser, isCurrentUserSuperadmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  await connection();

  const { locale } = await params;
  const safeLocale = (isLocale(locale) ? locale : "en") as Locale;
  const dictionary = getDictionary(safeLocale);
  const user = await getCurrentPlayer();
  if (!user) {
    redirect(`/${safeLocale}/login`);
  }
  const visibleServers = await getVisibleGuildsForLoggedInUser();
  const isSuperadmin = await isCurrentUserSuperadmin();

  return (
    <SidebarProvider
      className="min-h-dvh [--header-height:2.5rem] sm:[--header-height:3rem] lg:[--header-height:3.5rem]"
      style={
        {
          "--sidebar-width": "18rem",
          "--sidebar-width-icon": "3.25rem",
          "--footer-height": "calc(var(--spacing) * 16)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        locale={safeLocale}
        dictionary={dictionary}
        user={user}
        servers={visibleServers}
        activeServerId={undefined}
        canAdmin={false}
        isSuperadmin={isSuperadmin}
      />
      <SidebarInset className="min-h-dvh bg-[linear-gradient(180deg,rgba(201,168,78,.03),transparent_20%)] overflow-x-hidden">
        <SiteHeader locale={safeLocale} dictionary={dictionary} servers={visibleServers} user={user} />
        <div className="flex flex-1 flex-col gap-4 py-4 sm:gap-5 sm:py-5 lg:gap-6 lg:py-6">{children}</div>
        <SiteFooter dictionary={dictionary} />
      </SidebarInset>
    </SidebarProvider>
  );
}
