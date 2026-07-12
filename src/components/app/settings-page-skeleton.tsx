import { Skeleton } from "@/components/ui/skeleton";

export function SettingsPageSkeleton({
  cards = 2,
}: {
  cards?: number;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2 px-4 lg:px-6">
        <Skeleton className="h-9 w-56 rounded-xl" />
        <Skeleton className="h-4 w-full max-w-3xl rounded" />
        <Skeleton className="h-4 w-80 rounded" />
      </div>
      <div className="grid gap-6 px-4 lg:px-6 xl:grid-cols-[1.15fr_1fr]">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border/60 bg-card p-6">
            <Skeleton className="mb-6 h-6 w-40 rounded" />
            <div className="space-y-4">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
