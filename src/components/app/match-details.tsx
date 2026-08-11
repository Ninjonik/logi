"use client";

import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import { Bomb, ShieldAlert, Swords, Target, TrendingDown, TrendingUp } from "lucide-react";
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

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatDateTime, formatTime } from "@/lib/format";
import type { MatchRecord, MatchTeamSide } from "@/types/domain";

const TYPE_LABELS: Array<{ key: string; label: string }> = [
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

type MatchPlayer = MatchRecord["raw"]["player_stats"][number];

type TeamSeries = {
  key: string;
  side: MatchTeamSide;
  label: string;
  color: string;
};

type EncounterRow = {
  opponent: string;
  kills: number;
  deaths: number;
  plusMinus: number;
};

type RecordRow = {
  label: string;
  value: number;
};

type RivalryRow = {
  left: string;
  right: string;
  leftKills: number;
  rightKills: number;
  total: number;
};

type AwardRow = {
  label: string;
  player: string;
  detail: string;
  icon: LucideIcon;
};

type BadgeTone = "default" | "secondary" | "destructive" | "outline";

type PlayerBadge = {
  label: string;
  tone: BadgeTone;
};

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
  };
}

function buildTeamSeries(players: MatchPlayer[], dictionary: Dictionary) {
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
  payload?: ReadonlyArray<{ name?: string; value?: number | string; color?: string }>;
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
              <span className="size-2 rounded-full" style={{ backgroundColor: entry.color ?? chartStyles.axis }} />
              <span>{entry.name}</span>
            </span>
            <span className="font-medium">{String(entry.value ?? "-")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildBreakdownTotals(players: MatchPlayer[], teamSeries: TeamSeries[], key: "kills_by_type" | "deaths_by_type") {
  const base = new Map<string, { label: string; total: number } & Record<string, number | string>>(
    TYPE_LABELS.map(({ key: typeKey, label }) => [typeKey, { label, total: 0 }]),
  );
  const teamKeys = new Set(teamSeries.map((team) => team.key));

  for (const player of players) {
    const target = normalizeTeamValue(player.team.side);
    if (!teamKeys.has(target)) continue;

    for (const { key: typeKey } of TYPE_LABELS) {
      const value = player[key]?.[typeKey] ?? 0;
      const current = base.get(typeKey);
      if (!current) {
        continue;
      }

      current[target] = Number(current[target] ?? 0) + value;
      current.total += value;
    }
  }

  return [...base.values()].filter((item) => item.total > 0);
}

function buildWeaponTotals(players: MatchPlayer[], teamSeries: TeamSeries[], key: "weapons" | "death_by_weapons") {
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

function sortRecord(record: Record<string, number>) {
  return Object.entries(record)
    .map(([label, value]) => ({ label, value }))
    .filter((entry) => entry.value > 0)
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
}

function buildEncounterRows(player: MatchPlayer) {
  const rows = new Map<string, EncounterRow>();

  for (const [opponent, kills] of Object.entries(player.most_killed)) {
    const current = rows.get(opponent) ?? { opponent, kills: 0, deaths: 0, plusMinus: 0 };
    current.kills += kills;
    current.plusMinus = current.kills - current.deaths;
    rows.set(opponent, current);
  }

  for (const [opponent, deaths] of Object.entries(player.death_by)) {
    const current = rows.get(opponent) ?? { opponent, kills: 0, deaths: 0, plusMinus: 0 };
    current.deaths += deaths;
    current.plusMinus = current.kills - current.deaths;
    rows.set(opponent, current);
  }

  return [...rows.values()]
    .sort((left, right) =>
      (right.kills + right.deaths) - (left.kills + left.deaths) ||
      right.plusMinus - left.plusMinus ||
      left.opponent.localeCompare(right.opponent))
    .slice(0, 8);
}

function hasMatchingWeapon(record: Record<string, number>, pattern: RegExp) {
  return Object.entries(record).some(([weapon, value]) => value > 0 && pattern.test(weapon));
}

function buildPlayerBadges(player: MatchPlayer) {
  const badges: PlayerBadge[] = [];

  if (hasMatchingWeapon(player.weapons, /knife|spade|trench/i)) {
    badges.push({ label: "Blade", tone: "default" });
  }
  if (hasMatchingWeapon(player.weapons, /mine/i)) {
    badges.push({ label: "Miner", tone: "default" });
  }
  if ((player.kills_by_type?.artillery ?? 0) >= 3) {
    badges.push({ label: "Artillery", tone: "secondary" });
  }
  if (player.kills_streak >= 8) {
    badges.push({ label: "Streak", tone: "default" });
  }
  if (player.teamkills >= 3) {
    badges.push({ label: "Friendly Fire", tone: "destructive" });
  }
  if ((Object.values(player.death_by).sort((left, right) => right - left)[0] ?? 0) >= 5) {
    badges.push({ label: "Nemesis", tone: "outline" });
  }
  if (player.kills >= 25 && player.deaths <= 10) {
    badges.push({ label: "Carry", tone: "default" });
  }

  return badges.slice(0, 4);
}

function buildRivalries(players: MatchPlayer[]) {
  const directed = new Map<string, number>();

  for (const player of players) {
    for (const [opponent, kills] of Object.entries(player.most_killed)) {
      directed.set(`${player.player}:::${opponent}`, kills);
    }
  }

  const pairKeys = new Set<string>();
  for (const key of directed.keys()) {
    const [left, right] = key.split(":::");
    pairKeys.add([left, right].sort((a, b) => a.localeCompare(b)).join(":::"));
  }

  return [...pairKeys]
    .map((pairKey) => {
      const [left, right] = pairKey.split(":::");
      const leftKills = directed.get(`${left}:::${right}`) ?? 0;
      const rightKills = directed.get(`${right}:::${left}`) ?? 0;
      return {
        left,
        right,
        leftKills,
        rightKills,
        total: leftKills + rightKills,
      };
    })
    .filter((entry) => entry.total > 0)
    .sort((left, right) => right.total - left.total || Math.abs(right.leftKills - right.rightKills) - Math.abs(left.leftKills - left.rightKills))
    .slice(0, 8);
}

function buildAwards(players: MatchPlayer[]) {
  if (players.length === 0) {
    return [] as AwardRow[];
  }

  const topKills = [...players].sort((left, right) => right.kills - left.kills)[0]!;
  const topDefense = [...players].sort((left, right) => right.defense - left.defense)[0]!;
  const topSupport = [...players].sort((left, right) => right.support - left.support)[0]!;
  const bestKd = [...players].filter((player) => player.kills >= 8).sort((left, right) => right.kill_death_ratio - left.kill_death_ratio)[0];
  const roughDay = [...players].sort((left, right) => right.deaths - left.deaths)[0]!;
  const streak = [...players].sort((left, right) => right.kills_streak - left.kills_streak)[0]!;

  return [
    { label: "Top Fragger", player: topKills.player, detail: `${topKills.kills} kills`, icon: Swords },
    { label: "Anchor", player: topDefense.player, detail: `${topDefense.defense} defense`, icon: ShieldAlert },
    { label: "Support Spine", player: topSupport.player, detail: `${topSupport.support} support`, icon: Target },
    ...(bestKd ? [{ label: "Cleanest K/D", player: bestKd.player, detail: `${bestKd.kill_death_ratio.toFixed(2)} K/D`, icon: TrendingUp }] : []),
    { label: "Under Fire", player: roughDay.player, detail: `${roughDay.deaths} deaths`, icon: TrendingDown },
    { label: "Hot Streak", player: streak.player, detail: `${streak.kills_streak} streak`, icon: Bomb },
  ];
}

function renderRecordList(rows: RecordRow[], emptyLabel: string) {
  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
          <span>{row.label}</span>
          <Badge variant="secondary" className="rounded-full px-3">{row.value}</Badge>
        </div>
      ))}
    </div>
  );
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
  const teamSeriesByKey = useMemo(() => new Map(teamSeries.map((team) => [team.key, team])), [teamSeries]);
  const killTypeData = useMemo(() => buildBreakdownTotals(players, teamSeries, "kills_by_type"), [players, teamSeries]);
  const deathTypeData = useMemo(() => buildBreakdownTotals(players, teamSeries, "deaths_by_type"), [players, teamSeries]);
  const weaponData = useMemo(() => buildWeaponTotals(players, teamSeries, "weapons"), [players, teamSeries]);
  const deathWeaponData = useMemo(() => buildWeaponTotals(players, teamSeries, "death_by_weapons"), [players, teamSeries]);
  const rivalryData = useMemo(() => buildRivalries(players), [players]);
  const awards = useMemo(() => buildAwards(players), [players]);
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
      .map((entry) => ({ label: entry.label, total: entry.total }))
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

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="rounded-2xl border-border/60">
              <CardHeader>
                <CardTitle>{dictionary.event.standoutAwards}</CardTitle>
                <CardDescription>{dictionary.event.rawStats}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {awards.map((award) => {
                  const Icon = award.icon;
                  return (
                    <div key={`${award.label}-${award.player}`} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <Icon className="size-4" />
                        </div>
                        <div>
                          <div className="font-medium">{award.label}</div>
                          <div className="text-sm text-muted-foreground">{award.player}</div>
                        </div>
                      </div>
                      <div className="text-sm font-medium">{award.detail}</div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/60">
              <CardHeader>
                <CardTitle>{dictionary.event.topRivalries}</CardTitle>
                <CardDescription>{dictionary.event.encountersDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {rivalryData.length ? rivalryData.map((rivalry) => (
                  <div key={`${rivalry.left}-${rivalry.right}`} className="rounded-xl border border-border/60 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{rivalry.left} vs {rivalry.right}</div>
                      <Badge variant="secondary" className="rounded-full px-3">{rivalry.total} duels</Badge>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {rivalry.leftKills} - {rivalry.rightKills}
                    </div>
                  </div>
                )) : (
                  <div className="text-sm text-muted-foreground">{dictionary.event.noDerivedData}</div>
                )}
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

        <TabsContent value="players" className="space-y-6">
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
                      <TableHead>{dictionary.event.badges}</TableHead>
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
                      const badges = buildPlayerBadges(player);

                      return (
                        <TableRow key={`${player.player_id}-${index}`}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell style={{ color: teamStyle?.color ?? getTeamColor(player.team.side) }}>{teamStyle?.label ?? getTeamLabel(player.team.side, dictionary)}</TableCell>
                          <TableCell className="font-medium">{player.player}</TableCell>
                          <TableCell>
                            <div className="flex min-w-40 flex-wrap gap-1">
                              {badges.length ? badges.map((badge) => (
                                <Badge key={`${player.player}-${badge.label}`} variant={badge.tone} className="rounded-full px-2.5">
                                  {badge.label}
                                </Badge>
                              )) : <span className="text-xs text-muted-foreground">{dictionary.event.noDerivedData}</span>}
                            </div>
                          </TableCell>
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

          <Card className="rounded-2xl border-border/60">
            <CardHeader>
              <CardTitle>{dictionary.event.playerBreakdowns}</CardTitle>
              <CardDescription>{dictionary.event.encountersDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {players.map((player, index) => {
                  const encounters = buildEncounterRows(player);
                  const killWeapons = sortRecord(player.weapons).slice(0, 8);
                  const deathWeapons = sortRecord(player.death_by_weapons).slice(0, 8);
                  const teamStyle = teamSeriesByKey.get(normalizeTeamValue(player.team.side));

                  return (
                    <AccordionItem key={`${player.player_id}-${index}-detail`} value={`${player.player_id}-${index}`}>
                      <AccordionTrigger>
                        <div className="flex flex-1 items-center justify-between gap-4 pr-4 text-left">
                          <div>
                            <div className="font-medium">{player.player}</div>
                            <div className="text-sm text-muted-foreground" style={{ color: teamStyle?.color ?? undefined }}>
                              {teamStyle?.label ?? getTeamLabel(player.team.side, dictionary)}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{player.kills} K</span>
                            <span>{player.deaths} D</span>
                            <span>{player.kill_death_ratio.toFixed(2)} K/D</span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 xl:grid-cols-3">
                          <div className="rounded-xl border border-border/60 p-4">
                            <div className="mb-3 font-medium">{dictionary.event.encounters}</div>
                            {encounters.length ? (
                              <div className="space-y-2">
                                {encounters.map((encounter) => (
                                  <div key={`${player.player}-${encounter.opponent}`} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                                    <div className="font-medium">{encounter.opponent}</div>
                                    <div className="mt-1 flex items-center justify-between gap-3 text-muted-foreground">
                                      <span>{dictionary.event.killed}: {encounter.kills}</span>
                                      <span>{dictionary.event.diedTo}: {encounter.deaths}</span>
                                      <span className={encounter.plusMinus >= 0 ? "text-emerald-600" : "text-rose-600"}>
                                        {dictionary.event.plusMinus}: {encounter.plusMinus > 0 ? `+${encounter.plusMinus}` : encounter.plusMinus}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : <div className="text-sm text-muted-foreground">{dictionary.event.noDerivedData}</div>}
                          </div>

                          <div className="rounded-xl border border-border/60 p-4">
                            <div className="mb-3 font-medium">{dictionary.event.killsByWeaponForPlayer}</div>
                            {renderRecordList(killWeapons, dictionary.event.noDerivedData)}
                          </div>

                          <div className="rounded-xl border border-border/60 p-4">
                            <div className="mb-3 font-medium">{dictionary.event.deathsByWeaponForPlayer}</div>
                            {renderRecordList(deathWeapons, dictionary.event.noDerivedData)}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
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
