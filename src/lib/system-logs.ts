import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type SystemLogLevel = "INFO" | "WARN" | "ERROR";
export type SystemLogSource = "nextjs" | "discord-bot";

export type SystemLogContext = Record<string, unknown>;

export type SystemLogEntry = {
  id: string;
  timestamp: string;
  level: SystemLogLevel;
  source: SystemLogSource;
  scope: string;
  message: string;
  context: SystemLogContext | null;
  serverId?: string;
  userId?: string;
  requestPath?: string;
};

export type SystemLogFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  level?: SystemLogLevel;
  source?: SystemLogSource;
  scope?: string;
};

type SqliteLogRow = {
  id: number;
  timestamp: string;
  level: SystemLogLevel;
  source: SystemLogSource;
  scope: string;
  message: string;
  context_json: string | null;
  server_id: string | null;
  user_id: string | null;
  request_path: string | null;
};

const LOG_DB_PATH = process.env.LOGI_LOG_DB_PATH ?? path.join(process.cwd(), "data", "logs.db");

let database: DatabaseSync | null = null;

function ensureDatabase() {
  if (database) {
    return database;
  }

  mkdirSync(path.dirname(LOG_DB_PATH), { recursive: true });

  const db = new DatabaseSync(LOG_DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      level TEXT NOT NULL,
      source TEXT NOT NULL,
      scope TEXT NOT NULL,
      message TEXT NOT NULL,
      context_json TEXT,
      server_id TEXT,
      user_id TEXT,
      request_path TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs (timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs (level);
    CREATE INDEX IF NOT EXISTS idx_system_logs_source ON system_logs (source);
    CREATE INDEX IF NOT EXISTS idx_system_logs_scope ON system_logs (scope);
    CREATE INDEX IF NOT EXISTS idx_system_logs_server_id ON system_logs (server_id);
    CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs (user_id);
  `);

  database = db;
  return db;
}

function safeSerialize(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify("[unserializable]");
  }
}

type SerializedError = {
  name: string;
  message: string;
  stack?: string;
  cause?: unknown;
};

function normalizeError(error: Error & { cause?: unknown }): SerializedError {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause: error.cause instanceof Error
      ? normalizeError(error.cause)
      : error.cause,
  };
}

function sanitizeContextValue(value: unknown): unknown {
  if (value instanceof Error) {
    return normalizeError(value as Error & { cause?: unknown });
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeContextValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeContextValue(entry)]),
    );
  }

  return value;
}

function sanitizeContext(context?: SystemLogContext) {
  if (!context) {
    return null;
  }

  const entries = Object.entries(context)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, sanitizeContextValue(value)] as const);

  if (!entries.length) {
    return null;
  }

  return Object.fromEntries(entries);
}

function mapRow(row: SqliteLogRow): SystemLogEntry {
  return {
    id: String(row.id),
    timestamp: row.timestamp,
    level: row.level,
    source: row.source,
    scope: row.scope,
    message: row.message,
    context: row.context_json ? safeParseJson(row.context_json) : null,
    serverId: row.server_id ?? undefined,
    userId: row.user_id ?? undefined,
    requestPath: row.request_path ?? undefined,
  };
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as SystemLogContext;
  } catch {
    return { raw: value };
  }
}

function getLine(level: SystemLogLevel, source: SystemLogSource, scope: string, message: string, context: SystemLogContext | null) {
  const serializedContext = context ? ` ${Object.entries(context).map(([key, value]) => `${key}=${safeSerialize(value)}`).join(" ")}` : "";
  return `[${new Date().toISOString()}] [${source}] [${level}] [${scope}] ${message}${serializedContext}`;
}

export function writeSystemLog(input: {
  level: SystemLogLevel;
  source: SystemLogSource;
  scope: string;
  message: string;
  context?: SystemLogContext;
}) {
  const context = sanitizeContext(input.context);
  const timestamp = new Date().toISOString();

  const line = getLine(input.level, input.source, input.scope, input.message, context);
  try {
    const db = ensureDatabase();

    db.prepare(`
      INSERT INTO system_logs (
        timestamp,
        level,
        source,
        scope,
        message,
        context_json,
        server_id,
        user_id,
        request_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      timestamp,
      input.level,
      input.source,
      input.scope,
      input.message,
      context ? safeSerialize(context) : null,
      typeof context?.serverId === "string" ? context.serverId : null,
      typeof context?.userId === "string" ? context.userId : null,
      typeof context?.requestPath === "string" ? context.requestPath : null,
    );
  } catch (error) {
    const isSqliteLock =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "ERR_SQLITE_ERROR";

    if (!isSqliteLock) {
      throw error;
    }
  }

  if (input.level === "ERROR") {
    console.error(line);
    return;
  }
  if (input.level === "WARN") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function logNextInfo(scope: string, message: string, context?: SystemLogContext) {
  writeSystemLog({ level: "INFO", source: "nextjs", scope, message, context });
}

export function logNextWarn(scope: string, message: string, context?: SystemLogContext) {
  writeSystemLog({ level: "WARN", source: "nextjs", scope, message, context });
}

export function logNextError(scope: string, message: string, context?: SystemLogContext) {
  writeSystemLog({ level: "ERROR", source: "nextjs", scope, message, context });
}

export function querySystemLogs(filters: SystemLogFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const clauses: string[] = [];
  const values: Array<string | number> = [];

  if (filters.level) {
    clauses.push("level = ?");
    values.push(filters.level);
  }
  if (filters.source) {
    clauses.push("source = ?");
    values.push(filters.source);
  }
  if (filters.scope) {
    clauses.push("scope = ?");
    values.push(filters.scope);
  }
  if (filters.search?.trim()) {
    clauses.push("(message LIKE ? OR scope LIKE ? OR IFNULL(context_json, '') LIKE ? OR IFNULL(server_id, '') LIKE ? OR IFNULL(user_id, '') LIKE ? OR IFNULL(request_path, '') LIKE ?)");
    const query = `%${filters.search.trim()}%`;
    values.push(query, query, query, query, query, query);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const db = ensureDatabase();
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM system_logs ${whereClause}`).get(...values) as { total: number };
  const rows = db.prepare(`
    SELECT
      id,
      timestamp,
      level,
      source,
      scope,
      message,
      context_json,
      server_id,
      user_id,
      request_path
    FROM system_logs
    ${whereClause}
    ORDER BY timestamp DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...values, pageSize, (page - 1) * pageSize) as SqliteLogRow[];

  return {
    rows: rows.map(mapRow),
    page,
    pageSize,
    totalRows: countRow.total,
    pageCount: Math.max(1, Math.ceil(countRow.total / pageSize)),
  };
}

export function getSystemLogStats() {
  const db = ensureDatabase();
  const totalRow = db.prepare("SELECT COUNT(*) as total FROM system_logs").get() as { total: number };
  const errorRow = db.prepare("SELECT COUNT(*) as total FROM system_logs WHERE level = 'ERROR'").get() as { total: number };
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();
  const todayErrorRow = db.prepare("SELECT COUNT(*) as total FROM system_logs WHERE level = 'ERROR' AND timestamp >= ?").get(todayIso) as { total: number };
  const nextRow = db.prepare("SELECT COUNT(*) as total FROM system_logs WHERE source = 'nextjs'").get() as { total: number };
  const botRow = db.prepare("SELECT COUNT(*) as total FROM system_logs WHERE source = 'discord-bot'").get() as { total: number };
  const scopes = db.prepare(`
    SELECT scope, COUNT(*) as total
    FROM system_logs
    GROUP BY scope
    ORDER BY total DESC, scope ASC
    LIMIT 5
  `).all() as Array<{ scope: string; total: number }>;

  return {
    total: totalRow.total,
    errors: errorRow.total,
    errorsToday: todayErrorRow.total,
    nextjs: nextRow.total,
    discordBot: botRow.total,
    topScopes: scopes,
  };
}

export async function getKnownLogScopes() {
  const db = ensureDatabase();
  const rows = db.prepare("SELECT DISTINCT scope FROM system_logs ORDER BY scope ASC").all() as Array<{ scope: string }>;
  return rows.map((row) => row.scope);
}

export async function readLogDatabaseFile() {
  return await readFile(LOG_DB_PATH);
}

export function getLogDatabasePath() {
  return LOG_DB_PATH;
}
