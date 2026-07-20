import { cookies } from "next/headers";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { jwtVerify, SignJWT } from "jose";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getInternalAuthSecret, getJwtSecret } from "@/lib/env";
import { parsePlatformIdsInput } from "@/lib/platform-ids";
import type { AppUser, Guild } from "@/types/domain";

const getUserByIdReference = makeFunctionReference<"query">("players:getById");
const getVisibleGuildsReference = makeFunctionReference<"query">("guilds:visibleForUser");
const syncDiscordProfileReference = makeFunctionReference<"mutation">("players:syncDiscordProfile");
const syncManagedGuildsReference = makeFunctionReference<"mutation">("guilds:syncManagedGuilds");
const updatePlatformIdsReference = makeFunctionReference<"mutation">("players:updatePlatformIds");
const clearPlatformIdsReference = makeFunctionReference<"mutation">("players:clearPlatformIds");

const SESSION_COOKIE_NAME = "token";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionClaims = {
  sub: string;
  name: string;
  avatar: string;
};

function getSessionSecret() {
  return new TextEncoder().encode(getJwtSecret());
}

export async function createSessionToken(claims: SessionClaims) {
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({
    name: claims.name,
    avatar: claims.avatar,
  })
    .setProtectedHeader({
      alg: "HS256",
      typ: "JWT",
    })
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_MAX_AGE_SECONDS)
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());

    if (
      typeof payload.sub !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.avatar !== "string"
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      name: payload.name,
      avatar: payload.avatar,
    };
  } catch {
    return null;
  }
}

export async function setSessionToken(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionToken() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export const getSessionToken = cache(async function getSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
});

export const getSession = cache(async function getSession() {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  return await verifySessionToken(token);
});

export const getLoggedInUser = cache(async function getLoggedInUser(): Promise<AppUser | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }

  try {
    return await fetchQuery(getUserByIdReference, { userId: session.sub });
  } catch {
    return null;
  }
});

export const getCurrentPlayer = getLoggedInUser;

export const getVisibleGuildsForLoggedInUser = cache(async function getVisibleGuildsForLoggedInUser(): Promise<Guild[]> {
  const user = await getLoggedInUser();
  if (!user) {
    return [];
  }

  try {
    return (await fetchQuery(getVisibleGuildsReference, { userId: user.discordId })) as Guild[];
  } catch {
    return [];
  }
});

export async function handleIfNotLoggedIn(redirectUrl: string) {
  const user = await getLoggedInUser();
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
  }

  return user;
}

export async function syncCurrentPlayerFromDiscord(session: SessionClaims) {
  return await fetchMutation(syncDiscordProfileReference, {
    secret: getInternalAuthSecret(),
    id: session.sub,
    name: session.name,
    avatar: session.avatar,
  });
}

export async function syncManagedGuildsForCurrentPlayer(userId: string, guilds: {
  id: string;
  name: string;
  avatar: string;
  botInside: boolean;
}[]) {
  return await fetchMutation(syncManagedGuildsReference, {
    secret: getInternalAuthSecret(),
    userId,
    guilds,
  });
}

export async function updatePlatformIdsForCurrentPlayer(platformIds: string[]) {
  const session = await getSession();
  if (!session) {
    throw new Error("You must be signed in.");
  }

  return await fetchMutation(updatePlatformIdsReference, {
    secret: getInternalAuthSecret(),
    userId: session.sub,
    platformIds,
  });
}

export async function clearPlatformIdsForCurrentPlayer() {
  const session = await getSession();
  if (!session) {
    throw new Error("You must be signed in.");
  }

  return await fetchMutation(clearPlatformIdsReference, {
    secret: getInternalAuthSecret(),
    userId: session.sub,
  });
}

export async function updateCurrentPlayerProfile(input: { avatar: string; platformIds?: string | string[] }) {
  const session = await getSession();
  if (!session) {
    throw new Error("You must be signed in.");
  }

  await fetchMutation(syncDiscordProfileReference, {
    secret: getInternalAuthSecret(),
    id: session.sub,
    name: session.name,
    avatar: input.avatar,
  });

  const normalizedPlatformIds = parsePlatformIdsInput(input.platformIds);
  if (normalizedPlatformIds.length > 0) {
    await fetchMutation(updatePlatformIdsReference, {
      secret: getInternalAuthSecret(),
      userId: session.sub,
      platformIds: normalizedPlatformIds,
    });
    return session.sub;
  }

  await fetchMutation(clearPlatformIdsReference, {
    secret: getInternalAuthSecret(),
    userId: session.sub,
  });

  return session.sub;
}
