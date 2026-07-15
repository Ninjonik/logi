"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatDateTime, formatTime } from "@/lib/format";
import type { MatchRecord, MatchStatBreakdown, MatchTeamSide } from "@/types/domain";

const TYPE_LABELS: Array<{ key: keyof MatchStatBreakdown; label: string }> = [
  { key: "infantry", label: "Infantry" },
  { key: "machine_gun", label: "Machine Gun" },
  { key: "artillery", label: "Artillery" },
  { key: "armor", label: "Armor" },
  { key: "sniper", label: "Sniper" },
  { key: "commander", label: "Commander" },
  { key: "grenade", label: "Grenade" },
  { key: "bazooka", label: "Bazooka" },
  { key: "satchel", label: "Satchel" },
  { key: "mine", label: "Mine" },
];

function formatDuration(start: string, end: string) {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return "-";
  }

  const totalMinutes = Math.round((endMs - startMs) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function normalizeTeamValue(side: string | undefined) {
  return side?.trim().toLowerCase() ?? "";
}

function isUnknownTeam(side: string | undefined) {
  const normalized = normalizeTeamValue(side);
  return !normalized || normalized === "unknown";
}

function getTeamLabel(side: MatchTeamSide, dictionary: Dictionary) {
  if (side === "allies") return dictionary.event.alliedTeam;
  if (side === "axis") return dictionary.event.axisTeam;
  if (isUnknownTeam(side)) return dictionary.event.teamUnknown;
  return side;
}

function getTeamColor(side: MatchTeamSide, index = 0) {
  if (side === "allies") return "var(--chart-1)";
  if (side === "axis") return "var(--chart-5)";
  if (isUnknownTeam(side)) return "var(--muted-foreground)";

  const palette = [
    "var(--chart-1)",
    "var(--chart-5)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-2)",
  ];

  return palette[index % palette.length];
}

function getChartStyles() {
  return {
    grid: "var(--border)",
    axis: "var(--muted-foreground)",
    tooltipBackground: "var(--popover)",
    tooltipBorder: "var(--border)",
    tooltipText: "var(--popover-foreground)",
    treemapFill: "var(--chart-2)",
    treemapStroke: "var(--border)",
  };
}

type TeamSeries = {
  key: string;
  side: MatchTeamSide;
  label: string;
  color: string;
};

function buildTeamSeries(players: MatchRecord["raw"]["player_stats"], dictionary: Dictionary) {
  const seen = new Set<string>();
  const series: TeamSeries[] = [];

  for (const player of players) {
    if (isUnknownTeam(player.team.side)) {
      continue;
    }

    const key = normalizeTeamValue(player.team.side);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    series.push({
      key,
      side: player.team.side,
      label: getTeamLabel(player.team.side, dictionary),
      color: getTeamColor(player.team.side, series.length),
    });
  }

  if (series.length === 0) {
    series.push({
      key: "unknown",
      side: "unknown",
      label: dictionary.event.teamUnknown,
      color: getTeamColor("unknown"),
    });
  }

  return series;
}

function renderTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string; value?: number | string; color?: string; payload?: Record<string, unknown> }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const chartStyles = getChartStyles();

  return (
    <div
      className="min-w-40 rounded-xl border px-3 py-2 text-sm shadow-lg"
      style={{
        backgroundColor: chartStyles.tooltipBackground,
        borderColor: chartStyles.tooltipBorder,
        color: chartStyles.tooltipText,
      }}
    >
      {label !== undefined ? <div className="mb-2 font-medium">{String(label)}</div> : null}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={`${entry.name}-${index}`} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: entry.color ?? chartStyles.axis }}
              />
              <span>{entry.name}</span>
            </span>
            <span className="font-medium">{String(entry.value ?? "-")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildBreakdownTotals(
  players: MatchRecord["raw"]["player_stats"],
  teamSeries: TeamSeries[],
  key: "kills_by_type" | "deaths_by_type",
) {
  const base = new Map<string, { label: string; total: number } & Record<string, number | string>>(
    TYPE_LABELS.map(({ key: typeKey, label }) => [typeKey, { label, total: 0 }]),
  );
  const teamKeys = new Set(teamSeries.map((team) => team.key));

  for (const player of players) {
    const target = normalizeTeamValue(player.team.side);
    if (!teamKeys.has(target)) continue;

    for (const { key: typeKey } of TYPE_LABELS) {
      const value = player[key]?.[typeKey] ?? 0;
      const existing = base.get(typeKey);
      if (existing) {
        existing[target] = Number(existing[target] ?? 0) + value;
        existing.total += value;
      }
    }
  }

  return [...base.values()].filter((item) => item.total > 0);
}

function buildWeaponTotals(
  players: MatchRecord["raw"]["player_stats"],
  teamSeries: TeamSeries[],
  key: "weapons" | "death_by_weapons",
) {
  const totals = new Map<string, { weapon: string; total: number } & Record<string, number | string>>();
  const teamKeys = new Set(teamSeries.map((team) => team.key));

  for (const player of players) {
    const target = normalizeTeamValue(player.team.side);
    if (!teamKeys.has(target)) continue;

    for (const [weapon, amount] of Object.entries(player[key])) {
      const current = totals.get(weapon) ?? { weapon, total: 0 };
      current[target] = Number(current[target] ?? 0) + amount;
      current.total += amount;
      totals.set(weapon, current);
    }
  }

  return [...totals.values()].sort((left, right) => right.total - left.total).slice(0, 12);
}

export function MatchDetails({
  match,
  dictionary,
  timezone,
}: {
  match: MatchRecord;
  dictionary: Dictionary;
  timezone?: string;
}) {
  const chartStyles = getChartStyles();
  const players = useMemo(
    () => [...match.raw.player_stats].sort((left, right) => right.kills - left.kills || right.kill_death_ratio - left.kill_death_ratio),
    [match.raw.player_stats],
  );
  const teamSeries = useMemo(() => buildTeamSeries(players, dictionary), [dictionary, players]);
  const teamSeriesByKey = useMemo(
    () => new Map(teamSeries.map((team) => [team.key, team])),
    [teamSeries],
  );
  const killTypeData = useMemo(() => buildBreakdownTotals(players, teamSeries, "kills_by_type"), [players, teamSeries]);
  const deathTypeData = useMemo(() => buildBreakdownTotals(players, teamSeries, "deaths_by_type"), [players, teamSeries]);
  const weaponData = useMemo(() => buildWeaponTotals(players, teamSeries, "weapons"), [players, teamSeries]);
  const deathWeaponData = useMemo(() => buildWeaponTotals(players, teamSeries, "death_by_weapons"), [players, teamSeries]);
  const scatterData = useMemo(
    () => players.map((player) => ({
      name: player.player,
      team: player.team.side,
      kills: player.kills,
      deaths: player.deaths,
      kd: Number(player.kill_death_ratio.toFixed(2)),
      fill: teamSeriesByKey.get(normalizeTeamValue(player.team.side))?.color ?? getTeamColor(player.team.side),
    })),
    [players, teamSeriesByKey],
  );
  const killTypeSummaryData = useMemo(
    () => killTypeData
      .map((entry) => ({
        label: entry.label,
        total: entry.total,
      }))
      .sort((left, right) => right.total - left.total),
    [killTypeData],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="rounded-2xl border-border/60 xl:col-span-2">
          <CardHeader>
            <CardDescription>{dictionary.event.score}</CardDescription>
            <CardTitle className="text-3xl">
              {match.raw.result.allied} : {match.raw.result.axis}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>{match.raw.map.pretty_name}</div>
            <div>{match.raw.map.game_mode}{match.raw.map.environment ? ` • ${match.raw.map.environment}` : ""}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardDescription>{dictionary.event.players}</CardDescription>
            <CardTitle>{players.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardDescription>{dictionary.event.duration}</CardDescription>
            <CardTitle>{formatDuration(match.raw.start, match.raw.end)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardDescription>{dictionary.event.importedAt}</CardDescription>
            <CardTitle className="text-base">{formatDateTime(match.importedAt, timezone)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start rounded-2xl p-1">
          <TabsTrigger value="overview">{dictionary.event.overviewTab}</TabsTrigger>
          <TabsTrigger value="players">{dictionary.event.playersTab}</TabsTrigger>
          <TabsTrigger value="types">{dictionary.event.killsByTypeTab}</TabsTrigger>
          <TabsTrigger value="weapons">{dictionary.event.weaponsTab}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="rounded-2xl border-border/60">
              <CardHeader>
                <CardTitle>{dictionary.event.performanceScatter}</CardTitle>
                <CardDescription>{dictionary.event.rawStats}</CardDescription>
              </CardHeader>
              <CardContent className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid stroke={chartStyles.grid} strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="deaths" name="Deaths" tick={{ fill: chartStyles.axis, fontSize: 12 }} axisLine={{ stroke: chartStyles.grid }} tickLine={{ stroke: chartStyles.grid }} />
                    <YAxis type="number" dataKey="kills" name="Kills" tick={{ fill: chartStyles.axis, fontSize: 12 }} axisLine={{ stroke: chartStyles.grid }} tickLine={{ stroke: chartStyles.grid }} />
                    <ZAxis type="number" dataKey="kd" range={[60, 220]} />
                    <Tooltip cursor={{ stroke: chartStyles.grid, strokeDasharray: "3 3" }} content={renderTooltipContent} />
                    <Scatter data={scatterData} />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border/60">
              <CardHeader>
                <CardTitle>{dictionary.event.killsByTypeTab}</CardTitle>
                <CardDescription>{dictionary.event.rawStats}</CardDescription>
              </CardHeader>
              <CardContent className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={killTypeSummaryData} layout="vertical" margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <CartesianGrid stroke={chartStyles.grid} strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fill: chartStyles.axis, fontSize: 12 }} axisLine={{ stroke: chartStyles.grid }} tickLine={{ stroke: chartStyles.grid }} />
                    <YAxis type="category" dataKey="label" width={110} tick={{ fill: chartStyles.axis, fontSize: 12 }} axisLine={{ stroke: chartStyles.grid }} tickLine={{ stroke: chartStyles.grid }} />
                    <Tooltip cursor={false} content={renderTooltipContent} />
                    <Bar dataKey="total" name="Total" fill="var(--chart-2)" activeBar={false} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <Card className="rounded-2xl border-border/60">
            <CardHeader>
              <CardTitle>{dictionary.event.rawSource}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div>
                <div className="text-muted-foreground">{dictionary.event.playedAt}</div>
                <div className="font-medium">{formatDateTime(match.raw.start, timezone)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Server</div>
                <div className="font-medium">#{match.raw.server_number}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Match ID</div>
                <div className="font-medium">{match.raw.id}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{dictionary.event.rawSource}</div>
                <a className="font-medium text-primary underline-offset-4 hover:underline" href={match.sourceUrl} target="_blank" rel="noreferrer">
                  {match.sourceUrl}
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="players">
          <Card className="rounded-2xl border-border/60">
            <CardHeader>
              <CardTitle>{dictionary.event.playersTab}</CardTitle>
              <CardDescription>{formatTime(match.raw.start, timezone)} - {formatTime(match.raw.end, timezone)}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Lvl</TableHead>
                      <TableHead>Kills</TableHead>
                      <TableHead>K/D</TableHead>
                      <TableHead>Deaths</TableHead>
                      <TableHead>Off</TableHead>
                      <TableHead>Def</TableHead>
                      <TableHead>Sup</TableHead>
                      <TableHead>TK</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players.map((player, index) => {
                      const teamStyle = teamSeriesByKey.get(normalizeTeamValue(player.team.side));

                      return (
                        <TableRow key={`${player.player_id}-${index}`}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell style={{ color: teamStyle?.color ?? getTeamColor(player.team.side) }}>{teamStyle?.label ?? getTeamLabel(player.team.side, dictionary)}</TableCell>
                          <TableCell className="font-medium">{player.player}</TableCell>
                          <TableCell>{player.level}</TableCell>
                          <TableCell>{player.kills}</TableCell>
                          <TableCell>{player.kill_death_ratio.toFixed(2)}</TableCell>
                          <TableCell>{player.deaths}</TableCell>
                          <TableCell>{player.offense}</TableCell>
                          <TableCell>{player.defense}</TableCell>
                          <TableCell>{player.support}</TableCell>
                          <TableCell>{player.teamkills}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types" className="space-y-6">
          {[{ title: dictionary.event.killsByTypeTab, data: killTypeData }, { title: "Deaths by type", data: deathTypeData }].map((section) => (
            <Card key={section.title} className="rounded-2xl border-border/60">
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={section.data} layout="vertical" margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <CartesianGrid stroke={chartStyles.grid} strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fill: chartStyles.axis, fontSize: 12 }} axisLine={{ stroke: chartStyles.grid }} tickLine={{ stroke: chartStyles.grid }} />
                    <YAxis type="category" dataKey="label" width={110} tick={{ fill: chartStyles.axis, fontSize: 12 }} axisLine={{ stroke: chartStyles.grid }} tickLine={{ stroke: chartStyles.grid }} />
                    <Tooltip cursor={false} content={renderTooltipContent} />
                    {teamSeries.map((team) => (
                      <Bar key={team.key} dataKey={team.key} name={team.label} fill={team.color} activeBar={false} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="weapons">
          <Card className="rounded-2xl border-border/60">
            <CardHeader>
              <CardTitle>{dictionary.event.weaponsTab}</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="top-weapons">
                  <AccordionTrigger>{dictionary.event.topWeapons}</AccordionTrigger>
                  <AccordionContent>
                    <div className="h-[360px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weaponData} layout="vertical" margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                          <CartesianGrid stroke={chartStyles.grid} strokeDasharray="3 3" />
                          <XAxis type="number" tick={{ fill: chartStyles.axis, fontSize: 12 }} axisLine={{ stroke: chartStyles.grid }} tickLine={{ stroke: chartStyles.grid }} />
                          <YAxis type="category" dataKey="weapon" width={160} tick={{ fill: chartStyles.axis, fontSize: 12 }} axisLine={{ stroke: chartStyles.grid }} tickLine={{ stroke: chartStyles.grid }} />
                          <Tooltip cursor={false} content={renderTooltipContent} />
                          {teamSeries.map((team) => (
                            <Bar key={team.key} dataKey={team.key} name={team.label} fill={team.color} activeBar={false} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="death-weapons">
                  <AccordionTrigger>{dictionary.event.deathsByWeapon}</AccordionTrigger>
                  <AccordionContent>
                    <div className="h-[360px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={deathWeaponData} layout="vertical" margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                          <CartesianGrid stroke={chartStyles.grid} strokeDasharray="3 3" />
                          <XAxis type="number" tick={{ fill: chartStyles.axis, fontSize: 12 }} axisLine={{ stroke: chartStyles.grid }} tickLine={{ stroke: chartStyles.grid }} />
                          <YAxis type="category" dataKey="weapon" width={160} tick={{ fill: chartStyles.axis, fontSize: 12 }} axisLine={{ stroke: chartStyles.grid }} tickLine={{ stroke: chartStyles.grid }} />
                          <Tooltip cursor={false} content={renderTooltipContent} />
                          {teamSeries.map((team) => (
                            <Bar key={team.key} dataKey={team.key} name={team.label} fill={team.color} activeBar={false} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
