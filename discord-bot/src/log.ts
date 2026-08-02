import { writeSystemLog, type SystemLogContext } from "@/lib/system-logs";

type LogContext = SystemLogContext;

function write(level: "INFO" | "WARN" | "ERROR", scope: string, message: string, context?: LogContext) {
  writeSystemLog({
    level,
    source: "discord-bot",
    scope,
    message,
    context,
  });
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
