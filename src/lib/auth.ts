import { cookies } from "next/headers";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { createLocalJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";

import { getAuthAudience, getAuthIssuer, getAuthJwksJson, getAuthKeyId, getAuthPrivateKeyPem } from "@/lib/env";

const currentPlayerReference = makeFunctionReference<"query">("players:current");
const syncDiscordProfileReference = makeFunctionReference<"mutation">("players:syncDiscordProfile");
const linkSteamReference = makeFunctionReference<"mutation">("players:linkSteam");
const unlinkSteamReference = makeFunctionReference<"mutation">("players:unlinkSteam");

const SESSION_COOKIE_NAME = "token";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionClaims = {
  sub: string;
  name: string;
  avatar: string;
};

async function getSigningKey() {
  return importPKCS8(getAuthPrivateKeyPem(), "RS256");
}

function getVerificationKeySet() {
  const jwks = JSON.parse(getAuthJwksJson());
  return createLocalJWKSet(jwks);
}

export async function createSessionToken(claims: SessionClaims) {
  const key = await getSigningKey();
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({
    name: claims.name,
    avatar: claims.avatar,
  })
    .setProtectedHeader({
      alg: "RS256",
      typ: "JWT",
      kid: getAuthKeyId(),
    })
    .setIssuer(getAuthIssuer())
    .setAudience(getAuthAudience())
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_MAX_AGE_SECONDS)
    .sign(key);
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getVerificationKeySet(), {
      issuer: getAuthIssuer(),
      audience: getAuthAudience(),
    });

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
    } satisfies SessionClaims;
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

export async function getSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function getSession() {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  return await verifySessionToken(token);
}

export async function getCurrentPlayer() {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return null;
  }

  try {
    return await fetchQuery(currentPlayerReference, {}, { token });
  } catch {
    return null;
  }
}

export async function syncCurrentPlayerFromDiscord(session: SessionClaims, token: string) {
  return await fetchMutation(
    syncDiscordProfileReference,
    {
      name: session.name,
      avatar: session.avatar,
    },
    { token },
  );
}

export async function linkSteamForCurrentPlayer(steamId: string) {
  const token = await getSessionToken();
  if (!token) {
    throw new Error("You must be signed in.");
  }

  return await fetchMutation(linkSteamReference, { steamId }, { token });
}

export async function unlinkSteamForCurrentPlayer() {
  const token = await getSessionToken();
  if (!token) {
    throw new Error("You must be signed in.");
  }

  return await fetchMutation(unlinkSteamReference, {}, { token });
}
