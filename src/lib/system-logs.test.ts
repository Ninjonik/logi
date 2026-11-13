import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import assert from "node:assert/strict"
import { tmpdir } from "node:os"
import test from "node:test"
import path from "node:path"

test("storage and console failures cannot escape system logging", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "logi-log-test-"))
    try {
        const result = spawnSync(
            process.execPath,
            [
                "--import",
                "tsx",
                "--input-type=module",
                "-e",
                `
            const { writeSystemLog } = await import('./src/lib/system-logs.ts');
            console.log = console.warn = console.error = () => { throw new Error('closed stream') };
            const error = new Error('cyclic'); error.cause = error;
            for (const level of ['INFO', 'WARN', 'ERROR']) {
                writeSystemLog({ level, source: 'discord-bot', scope: 'test', message: 'test', context: { error } });
            }
        `,
            ],
            {
                cwd: process.cwd(),
                encoding: "utf8",
                timeout: 20_000,
                // A directory is deliberately not a writable SQLite database file.
                env: { ...process.env, LOGI_LOG_DB_PATH: directory },
            }
        )
        assert.equal(result.status, 0, result.stderr || result.error?.message)
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})
