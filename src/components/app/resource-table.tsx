import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Dictionary } from "@/i18n/dictionaries";

export function ResourceTable<T extends { id: string }>({
  columns,
  rows,
  getHref,
  dictionary,
}: {
  columns: Array<{
    key: string;
    title: string;
    render: (row: T) => React.ReactNode;
  }>;
  rows: T[];
  getHref: (row: T) => string;
  dictionary: Dictionary;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key}>{column.title}</TableHead>
            ))}
            <TableHead className="w-[120px] text-right">{dictionary.common.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {columns.map((column) => (
                <TableCell key={column.key}>{column.render(row)}</TableCell>
              ))}
              <TableCell className="text-right">
                <Button asChild variant="ghost" size="sm">
                  <Link href={getHref(row)}>
                    {dictionary.shared.openColumn}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!rows.length ? (
        <div className="border-t px-6 py-12 text-center text-sm text-muted-foreground">
          {dictionary.shared.nothingCreatedYet}
        </div>
      ) : null}
    </div>
  );
}

export function StatusBadge({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <Badge variant={active ? "default" : "secondary"} className="rounded-full px-3">
      {active ? activeLabel : inactiveLabel}
    </Badge>
  );
}
