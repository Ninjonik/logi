import { TablePageSkeleton } from "@/components/app/data-table-skeleton";

export default function Loading() {
  return <TablePageSkeleton columns={5} rows={8} />;
}
