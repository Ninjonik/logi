import * as React from "react";

import type { Dictionary } from "@/i18n/dictionaries";
import { ResourceTableClient } from "@/components/app/resource-table-client";

type ColumnConfig<T> = {
  key: string;
  title: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

export function ResourceTable<T extends { id: string }>({
  columns,
  rows,
  getHref,
  dictionary,
  page,
  pageSize,
  pageCount,
  totalRows,
  search,
  searchPlaceholder,
  className,
}: {
  columns: Array<ColumnConfig<T>>;
  rows: T[];
  getHref: (row: T) => string;
  dictionary: Dictionary;
  page: number;
  pageSize: number;
  pageCount: number;
  totalRows: number;
  search: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  return (
    <ResourceTableClient
      dictionary={dictionary}
      page={page}
      pageSize={pageSize}
      pageCount={pageCount}
      totalRows={totalRows}
      search={search}
      searchPlaceholder={searchPlaceholder}
      className={className}
      columnTitles={columns.map((column) => column.title)}
      columnClassNames={columns.map((column) => column.className ?? "")}
      rows={rows.map((row) => ({
        id: row.id,
        href: getHref(row),
        cells: columns.map((column) => column.render(row)),
      }))}
    />
  );
}

export { StatusBadge } from "@/components/app/resource-table-client";
