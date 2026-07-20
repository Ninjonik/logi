type LogContext = Record<string, unknown>;

function formatContext(context?: LogContext) {
  if (!context) return "";

  const entries = Object.entries(context).filter(([, value]) => value !== undefined);
  if (!entries.length) return "";

  return ` ${entries.map(([key, value]) => `${key}=${formatValue(value)}`).join(" ")}`;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return String(value);
  if (Array.isArray(value)) return `[${value.map((item) => formatValue(item)).join(",")}]`;

  try {
    return JSON.stringify(value);
  } catch {
    return '"[unserializable]"';
  }
}

function write(level: "INFO" | "WARN" | "ERROR", scope: string, message: string, context?: LogContext) {
  const line = `[${new Date().toISOString()}] [${level}] [${scope}] ${message}${formatContext(context)}`;
  if (level === "ERROR") {
    console.error(line);
    return;
  }
  if (level === "WARN") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function logInfo(scope: string, message: string, context?: LogContext) {
  write("INFO", scope, message, context);
}

export function logWarn(scope: string, message: string, context?: LogContext) {
  write("WARN", scope, message, context);
}

export function logError(scope: string, message: string, context?: LogContext) {
  write("ERROR", scope, message, context);
}
