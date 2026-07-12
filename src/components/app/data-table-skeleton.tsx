import { Skeleton } from "@/components/ui/skeleton";
import { TablePageLayout } from "@/components/app/table-page-layout";

export function TablePageSkeleton({
  columns = 5,
  rows = 8,
  withAction = true,
}: {
  columns?: number;
  rows?: number;
  withAction?: boolean;
}) {
  return (
    <TablePageLayout
      header={
        <div className="flex flex-col gap-4 px-4 lg:flex-row lg:items-end lg:justify-between lg:px-6">
          <div className="space-y-2">
            <Skeleton className="h-9 w-48 rounded-xl" />
            <Skeleton className="h-4 w-full max-w-3xl rounded" />
            <Skeleton className="h-4 w-72 rounded" />
          </div>
          {withAction ? <Skeleton className="h-10 w-36 rounded-xl" /> : null}
        </div>
      }
    >
      <DataTableSkeleton columns={columns} rows={rows} />
    </TablePageLayout>
  );
}

export function DataTableSkeleton({
  columns = 5,
  rows = 8,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card">
      <div className="shrink-0 flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-full max-w-sm rounded-xl" />
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-full">
          <div
            className="sticky top-0 z-10 grid border-b bg-card px-4 py-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-24 rounded" />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid items-center gap-4 border-b px-4 py-4 last:border-b-0"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: columns }).map((__, columnIndex) => (
                <Skeleton
                  key={columnIndex}
                  className={`h-4 rounded ${columnIndex === 0 ? "w-32" : "w-20"}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="shrink-0 flex items-center justify-between border-t px-4 py-4">
        <Skeleton className="h-4 w-32 rounded" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 w-20 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
