import { createHash, randomBytes } from "node:crypto";

import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getInternalAuthSecret } from "@/lib/env";

const createKeyReference = makeFunctionReference<"mutation">("publicApi:createKey");
const listKeysReference = makeFunctionReference<"query">("publicApi:listKeys");
const revokeKeyReference = makeFunctionReference<"mutation">("publicApi:revokeKey");
const rateLimitReference = makeFunctionReference<"mutation">("publicApi:checkRateLimit");
const clanDataReference = makeFunctionReference<"query">("publicApi:getClanData");

export function hashApiKey(value: string) { return createHash("sha256").update(value).digest("hex"); }

export async function createClanApiKey(guildId: string, name: string) {
  const value = `logi_${randomBytes(32).toString("base64url")}`;
  await fetchMutation(createKeyReference, { secret: getInternalAuthSecret(), guildId, name, keyHash: hashApiKey(value), keyPrefix: value.slice(0, 13) });
  return value;
}

export async function listClanApiKeys(guildId: string) {
  return await fetchQuery(listKeysReference, { secret: getInternalAuthSecret(), guildId }) as Array<{ id: string; name: string; keyPrefix: string; createdAt: string; lastUsedAt?: string; revokedAt?: string }>;
}

export async function revokeClanApiKey(guildId: string, keyId: string) {
  await fetchMutation(revokeKeyReference, { secret: getInternalAuthSecret(), guildId, keyId: keyId as never });
}

export async function checkPublicApiRateLimit(bucket: string, limit: number) {
  return await fetchMutation(rateLimitReference, { secret: getInternalAuthSecret(), bucket, limit, windowMs: 60_000 }) as { allowed: boolean; remaining: number; resetAt: number };
}

export async function getClanApiData(key: string) {
  return await fetchQuery(clanDataReference, { secret: getInternalAuthSecret(), keyHash: hashApiKey(key) });
}

export function readBearerToken(request: Request) {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7).trim() : null;
}

export function rateLimitHeaders(result: { remaining: number; resetAt: number }) {
  return { "RateLimit-Limit": "300", "RateLimit-Remaining": String(result.remaining), "RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)) };
}
