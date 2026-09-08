import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { PerformanceSnapshot } from "@/lib/read-models/performance-history";

export function PlayerTrendIndicators({ matches, dictionary }: { matches: PerformanceSnapshot[]; dictionary: Dictionary }) {
  const recent = matches.slice(0, 5), previous = matches.slice(5, 10);
  if (!previous.length) return <span className="text-xs text-muted-foreground">—</span>;
  const metrics: Array<["kd" | "offense" | "support", string]> = [["kd", dictionary.clan.kd], ["offense", dictionary.clan.offense], ["support", dictionary.clan.support]];
  return <div className="flex flex-wrap gap-x-2 gap-y-1">{metrics.map(([key, label]) => {
    const average = (rows: PerformanceSnapshot[]) => rows.reduce((total, row) => total + row[key], 0) / rows.length;
    const delta = Math.round(average(recent) - average(previous));
    const Icon = delta >= 0 ? ArrowUpRight : ArrowDownRight;
    return <span key={key} className={delta >= 0 ? "flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400" : "flex items-center text-xs font-medium text-rose-600 dark:text-rose-400"}><Icon className="size-3" />{label} {delta >= 0 ? "+" : ""}{delta}</span>;
  })}</div>;
}
