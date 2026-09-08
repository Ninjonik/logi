export function PublicStat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xl font-semibold tabular-nums">{value}</p>
            <p className="text-muted-foreground text-xs">{label}</p>
        </div>
    )
}
