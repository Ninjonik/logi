/* eslint-disable @typescript-eslint/no-explicit-any -- This isolated heterogeneous database fixture deliberately accepts every Convex table and handler result. Production code uses the generated DataModel. */
/** Isolated handler fixture. Convex transaction semantics are simulated, not a deployed database. */
export type TestRow = { _id: string; [key: string]: any }
export class TestDatabase {
    tables: Record<string, TestRow[]> = {}
    private sequence = 0
    seed(table: string, value: TestRow) {
        ;(this.tables[table] ??= []).push(structuredClone(value))
        return value._id
    }
    async get(id: string) {
        return (
            Object.values(this.tables)
                .flat()
                .find((row) => row._id === id) ?? null
        )
    }
    normalizeId(table: string, id: string) {
        return id.startsWith(`${table}:`) ||
            this.tables[table]?.some((row) => row._id === id)
            ? id
            : null
    }
    async insert(table: string, value: Record<string, unknown>) {
        const id = `${table}:${++this.sequence}`
        this.seed(table, { ...value, _id: id })
        return id
    }
    async patch(id: string, value: Record<string, unknown>) {
        const row = await this.get(id)
        if (!row) throw new Error("Missing row")
        Object.assign(row, value)
    }
    async replace(id: string, value: Record<string, unknown>) {
        await this.delete(id)
        this.seed(id.split(":")[0], { ...value, _id: id })
    }
    async delete(id: string) {
        for (const table of Object.values(this.tables)) {
            const i = table.findIndex((row) => row._id === id)
            if (i >= 0) table.splice(i, 1)
        }
    }
    query(table: string) {
        const tests: Array<(row: TestRow) => boolean> = []
        let fields: string[] = [],
            direction = 1
        const predicate =
            (op: string, field: string, value: any) => (row: TestRow) =>
                op === "eq"
                    ? row[field] === value
                    : op === "gt"
                      ? row[field] > value
                      : op === "gte"
                        ? row[field] >= value
                        : op === "lt"
                          ? row[field] < value
                          : row[field] <= value
        const index: any = {}
        for (const op of ["eq", "gt", "gte", "lt", "lte"])
            index[op] = (field: string, value: unknown) => {
                tests.push(predicate(op, field, value))
                return index
            }
        const expr: any = {
            field: (s: string) => s,
            and:
                (...args: any[]) =>
                (row: TestRow) =>
                    args.every((fn) => fn(row)),
            or:
                (...args: any[]) =>
                (row: TestRow) =>
                    args.some((fn) => fn(row)),
        }
        for (const op of ["eq", "gt", "gte", "lt", "lte"])
            expr[op] = (field: string, value: unknown) =>
                predicate(op, field, value)
        const rows = () =>
            (this.tables[table] ?? [])
                .filter((row) => tests.every((fn) => fn(row)))
                .slice()
                .sort((a, b) => {
                    for (const field of fields)
                        if (a[field] !== b[field])
                            return (a[field] < b[field] ? -1 : 1) * direction
                    return 0
                })
        const query = {
            withIndex: (name: string, fn?: (q: any) => unknown) => {
                fields = name.split("_")
                fn?.(index)
                return query
            },
            filter: (fn: (q: any) => (row: TestRow) => boolean) => {
                tests.push(fn(expr))
                return query
            },
            order: (value: string) => {
                direction = value === "desc" ? -1 : 1
                return query
            },
            unique: async () => rows()[0] ?? null,
            first: async () => rows()[0] ?? null,
            collect: async () => rows(),
            take: async (n: number) => rows().slice(0, n),
            paginate: async ({
                cursor,
                numItems,
            }: {
                cursor: string | null
                numItems: number
            }) => {
                const all = rows(),
                    start = Number(cursor ?? 0),
                    end = start + numItems
                return {
                    page: all.slice(start, end),
                    continueCursor: String(end),
                    isDone: end >= all.length,
                }
            },
        }
        return query
    }
}
export function testContext() {
    return {
        db: new TestDatabase(),
        scheduler: {
            calls: [] as unknown[],
            runAfter: async function (...args: unknown[]) {
                this.calls.push(args)
                return "scheduled"
            },
        },
    }
}
export async function invoke(
    fn: unknown,
    ctx: ReturnType<typeof testContext>,
    args: Record<string, unknown> = {}
): Promise<any> {
    const snapshot = structuredClone(ctx.db.tables),
        scheduled = ctx.scheduler.calls.length
    try {
        return await (
            fn as {
                _handler: (ctx: unknown, args: unknown) => Promise<unknown>
            }
        )._handler(ctx, args)
    } catch (error) {
        ctx.db.tables = snapshot
        ctx.scheduler.calls.splice(scheduled)
        throw error
    }
}
