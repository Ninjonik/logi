export type TrendMatch = { kd: number; offense: number; support: number };

export function getPerformanceTrendDeltas(matches: TrendMatch[]) {
  const recent = matches.slice(0, 5);
  const previous = matches.slice(5, 10);
  if (!recent.length || !previous.length) return null;
  const average = (rows: TrendMatch[], key: keyof TrendMatch) => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
  return {
    kd: Math.round(average(recent, "kd") - average(previous, "kd")),
    offense: Math.round(average(recent, "offense") - average(previous, "offense")),
    support: Math.round(average(recent, "support") - average(previous, "support")),
  };
}
