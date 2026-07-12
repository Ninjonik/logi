export const DEFAULT_TABLE_PAGE_SIZE = 10;

export type TableSearchParams = {
  page: number;
  pageSize: number;
  search: string;
};

export type TablePageResult<T> = {
  rows: T[];
  totalRows: number;
  page: number;
  pageSize: number;
  pageCount: number;
  search: string;
};

function normalizePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizePageSize(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_TABLE_PAGE_SIZE;
  }

  return Math.min(Math.max(parsed, 5), 50);
}

function normalizeSearch(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}

export function parseTableSearchParams(
  searchParams?: Record<string, string | string[] | undefined>,
): TableSearchParams {
  return {
    page: normalizePage(searchParams?.page),
    pageSize: normalizePageSize(searchParams?.pageSize),
    search: normalizeSearch(searchParams?.search),
  };
}

export function getPaginatedRows<T>(input: {
  rows: T[];
  searchParams?: Record<string, string | string[] | undefined>;
  getSearchText?: (row: T) => string;
}): TablePageResult<T> {
  const { page, pageSize, search } = parseTableSearchParams(input.searchParams);
  const normalizedSearch = search.toLocaleLowerCase();

  const filteredRows = normalizedSearch && input.getSearchText
    ? input.rows.filter((row) => input.getSearchText?.(row).toLocaleLowerCase().includes(normalizedSearch))
    : input.rows;

  const totalRows = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, pageCount);
  const startIndex = (safePage - 1) * pageSize;
  const rows = filteredRows.slice(startIndex, startIndex + pageSize);

  return {
    rows,
    totalRows,
    page: safePage,
    pageSize,
    pageCount,
    search,
  };
}
