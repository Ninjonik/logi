import { Badge } from "@/components/ui/badge";

export function PageHeader({
  title,
  description,
  badge,
  actions,
}: {
  title: string;
  description?: string;
  badge?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 sm:gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4 lg:px-6">
      <div className="space-y-1 sm:space-y-1.5 lg:space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <h1 className="text-xl font-semibold tracking-tight xl:text-2xl 2xl:text-3xl">{title}</h1>
          {badge ? <Badge className="h-5 rounded-full px-2 text-[10px] 2xl:h-auto 2xl:px-3 2xl:text-xs">{badge}</Badge> : null}
        </div>
        {description ? <p className="max-w-3xl text-xs leading-snug text-muted-foreground 2xl:text-sm">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
