import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, type Locale } from "@/i18n/config";
import { AppSidebar } from "@/components/app/app-sidebar";
import { SiteFooter } from "@/components/app/site-footer";
import { SiteHeader } from "@/components/app/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentPlayer, getVisibleGuildsForLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = (isLocale(locale) ? locale : "en") as Locale;
  const dictionary = getDictionary(safeLocale);
  const user = await getCurrentPlayer();
  if (!user) {
    redirect(`/${safeLocale}/login`);
  }
  const visibleServers = await getVisibleGuildsForLoggedInUser();

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "18rem",
          "--sidebar-width-icon": "3.25rem",
          "--header-height": "calc(var(--spacing) * 14)",
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
      />
      <SidebarInset className="bg-[linear-gradient(180deg,rgba(201,168,78,.03),transparent_20%)] overflow-hidden">
        <SiteHeader locale={safeLocale} dictionary={dictionary} servers={visibleServers} user={user} />
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden py-6">{children}</div>
        <SiteFooter dictionary={dictionary} />
      </SidebarInset>
    </SidebarProvider>
  );
}
