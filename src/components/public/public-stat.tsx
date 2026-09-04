export function PublicStat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>;
}
