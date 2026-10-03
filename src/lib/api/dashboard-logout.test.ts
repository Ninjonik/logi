import { dashboardLogout } from "./dashboard-logout"
import assert from "node:assert/strict"
import { test } from "node:test"

const issuer = "https://logi.invalid"
const request = (method: string, origin?: string, suffix = "") =>
    new Request(`${issuer}/api/auth/logout${suffix}`, {
        method,
        headers: origin ? { origin } : {},
    })

test("GET and cross-site or missing-origin POST never revoke a session", async () => {
    const revoked: boolean[] = []
    const ports = {
        issuer: () => issuer,
        revoke: async (global: boolean) => {
            revoked.push(global)
        },
    }
    for (const input of [
        request("GET", undefined, "?global=true"),
        request("POST"),
        request("POST", "https://external.invalid"),
        request("POST", "null"),
    ]) {
        const response = await dashboardLogout(input, ports)
        assert.equal(response.status, input.method === "GET" ? 405 : 403)
        assert.equal(response.headers.get("cache-control"), "no-store")
    }
    assert.deepEqual(revoked, [])
})

test("same-origin POST revokes the requested session scope before a local 303 redirect", async () => {
    const revoked: boolean[] = []
    const ports = {
        issuer: () => issuer,
        revoke: async (global: boolean) => {
            revoked.push(global)
        },
    }
    const local = await dashboardLogout(
        request("POST", issuer, "?redirectTo=%2Fcs%2Flogin"),
        ports
    )
    const global = await dashboardLogout(
        request(
            "POST",
            issuer,
            "?global=true&redirectTo=https%3A%2F%2Fexternal.invalid"
        ),
        ports
    )
    assert.deepEqual(revoked, [false, true])
    assert.equal(local.status, 303)
    assert.equal(local.headers.get("location"), `${issuer}/cs/login`)
    assert.equal(global.status, 303)
    assert.equal(global.headers.get("location"), `${issuer}/en/login`)
})

test("revocation failure is not reported as a completed logout or leaked in the response", async () => {
    const response = await dashboardLogout(request("POST", issuer), {
        issuer: () => issuer,
        revoke: async () => {
            throw new Error("private-storage-detail")
        },
    })
    assert.equal(response.status, 503)
    assert.equal(response.headers.get("location"), null)
    assert.equal(
        (await response.text()).includes("private-storage-detail"),
        false
    )
})
