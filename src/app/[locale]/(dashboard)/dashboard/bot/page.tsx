import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, AppWindow, Bot, DatabaseZap, Filter } from "lucide-react";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { ResourceTable } from "@/components/app/resource-table";
import { StatCard } from "@/components/app/stat-card";
import { TablePageLayout } from "@/components/app/table-page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getCurrentPlayer, isCurrentUserSuperadmin } from "@/lib/auth";
import { getKnownLogScopes, getLogDatabasePath, getSystemLogStats, querySystemLogs, type SystemLogLevel, type SystemLogSource } from "@/lib/system-logs";

const LEVEL_OPTIONS: Array<{ value: SystemLogLevel; label: string }> = [
  { value: "ERROR", label: "ERROR" },
  { value: "WARN", label: "WARN" },
  { value: "INFO", label: "INFO" },
];

const SOURCE_OPTIONS: Array<{ value: SystemLogSource; label: string }> = [
  { value: "nextjs", label: "Next.js" },
  { value: "discord-bot", label: "Discord bot" },
];

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dictionary = getDictionary(isLocale(locale) ? locale : "en");
  return {
    title: dictionary.dashboard.botTitle,
    description: dictionary.dashboard.botDescription,
  };
}

export default async function BotDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const user = await getCurrentPlayer();

  if (!user) {
    redirect(`/${safeLocale}/login`);
  }

  if (!(await isCurrentUserSuperadmin())) {
    redirect(`/${safeLocale}/dashboard`);
  }

  const query = await searchParams;
  const search = typeof query.search === "string" ? query.search : "";
  const level = typeof query.level === "string" ? query.level as SystemLogLevel : undefined;
  const source = typeof query.source === "string" ? query.source as SystemLogSource : undefined;
  const scope = typeof query.scope === "string" ? query.scope : undefined;
  const page = parsePositiveInt(typeof query.page === "string" ? query.page : undefined, 1);
  const pageSize = parsePositiveInt(typeof query.pageSize === "string" ? query.pageSize : undefined, 20);

  const [stats, scopeOptions] = await Promise.all([
    Promise.resolve(getSystemLogStats()),
    getKnownLogScopes(),
  ]);
  const logResult = querySystemLogs({
    page,
    pageSize,
    search,
    level,
    source,
    scope,
  });

  const queryPairs = [
    search ? `search=${encodeURIComponent(search)}` : null,
    level ? `level=${encodeURIComponent(level)}` : null,
    source ? `source=${encodeURIComponent(source)}` : null,
    scope ? `scope=${encodeURIComponent(scope)}` : null,
    `page=${page}`,
    `pageSize=${pageSize}`,
  ].filter(Boolean);
  const baseHref = `/${safeLocale}/dashboard/bot${queryPairs.length ? `?${queryPairs.join("&")}` : ""}`;

  return (
    <TablePageLayout
      header={(
        <PageHeader
          title={dictionary.dashboard.botTitle}
          description={`${dictionary.dashboard.botDescription} ${getLogDatabasePath()}`}
        />
      )}
    >
      <div className="flex h-full min-h-0 flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard title={dictionary.dashboard.totalLogs} value={stats.total} description={dictionary.dashboard.botDescription} icon={DatabaseZap} />
          <StatCard title={dictionary.dashboard.totalErrors} value={stats.errors} description={dictionary.dashboard.tableLevel} icon={AlertTriangle} />
          <StatCard title={dictionary.dashboard.errorsToday} value={stats.errorsToday} description={dictionary.dashboard.filtersTitle} icon={Filter} />
          <StatCard title={dictionary.dashboard.nextjsLogs} value={stats.nextjs} description={dictionary.dashboard.tableSource} icon={AppWindow} />
          <StatCard title={dictionary.dashboard.discordBotLogs} value={stats.discordBot} description={dictionary.dashboard.tableSource} icon={Bot} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="rounded-2xl border-border/60">
            <CardHeader>
              <CardTitle>{dictionary.dashboard.filtersTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-4" method="get">
                <div className="space-y-2">
                  <Label htmlFor="search">{dictionary.shared.searchTable}</Label>
                  <Input id="search" name="search" defaultValue={search} placeholder={dictionary.shared.searchTable} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level">{dictionary.dashboard.filterLevel}</Label>
                  <select id="level" name="level" defaultValue={level ?? ""} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm">
                    <option value="">{dictionary.dashboard.allLevels}</option>
                    {LEVEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source">{dictionary.dashboard.filterSource}</Label>
                  <select id="source" name="source" defaultValue={source ?? ""} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm">
                    <option value="">{dictionary.dashboard.allSources}</option>
                    {SOURCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scope">{dictionary.dashboard.filterScope}</Label>
                  <select id="scope" name="scope" defaultValue={scope ?? ""} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm">
                    <option value="">{dictionary.dashboard.allScopes}</option>
                    {scopeOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <input type="hidden" name="pageSize" value={String(pageSize)} />
                <div className="flex gap-2">
                  <Button type="submit" className="rounded-xl">{dictionary.dashboard.applyFilters}</Button>
                  <Button asChild type="button" variant="outline" className="rounded-xl">
                    <Link href={`/${safeLocale}/dashboard/bot`}>{dictionary.dashboard.resetFilters}</Link>
                  </Button>
                </div>
              </form>

              <div className="space-y-3 rounded-xl border border-border/60 p-4">
                <div className="flex items-center gap-2 font-medium">
                  <Bot className="size-4" />
                  {dictionary.dashboard.topScopes}
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {stats.topScopes.length ? stats.topScopes.map((entry) => (
                    <div key={entry.scope} className="flex items-center justify-between gap-3">
                      <span className="truncate">{entry.scope}</span>
                      <span>{entry.total}</span>
                    </div>
                  )) : <div>{dictionary.shared.nothingCreatedYet}</div>}
                </div>
              </div>
            </CardContent>
          </Card>

          <ResourceTable
            dictionary={dictionary}
            columns={[
              {
                key: "timestamp",
                title: dictionary.dashboard.tableTimestamp,
                render: (row) => <span id={`log-${row.id}`} className="whitespace-nowrap text-xs text-muted-foreground">{new Date(row.timestamp).toLocaleString()}</span>,
                className: "whitespace-nowrap",
              },
              {
                key: "level",
                title: dictionary.dashboard.tableLevel,
                render: (row) => row.level,
              },
              {
                key: "source",
                title: dictionary.dashboard.tableSource,
                render: (row) => row.source,
              },
              {
                key: "scope",
                title: dictionary.dashboard.tableScope,
                render: (row) => row.scope,
              },
              {
                key: "message",
                title: dictionary.dashboard.tableMessage,
                render: (row) => <span className="line-clamp-2">{row.message}</span>,
              },
              {
                key: "context",
                title: dictionary.dashboard.tableContext,
                render: (row) => (
                  <code className="block max-w-[420px] overflow-hidden text-ellipsis whitespace-pre-wrap text-xs text-muted-foreground">
                    {JSON.stringify(row.context ?? {}, null, 0)}
                  </code>
                ),
              },
            ]}
            rows={logResult.rows}
            getHref={(row) => `${baseHref}#log-${row.id}`}
            page={logResult.page}
            pageSize={logResult.pageSize}
            pageCount={logResult.pageCount}
            totalRows={logResult.totalRows}
            search={search}
            searchPlaceholder={dictionary.shared.searchTable}
            className="min-h-[720px]"
          />
        </div>
      </div>
    </TablePageLayout>
  );
}
