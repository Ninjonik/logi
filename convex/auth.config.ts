import type { AuthConfig } from "convex/server";

function getJwksDataUri() {
  const jwks = process.env.AUTH_JWKS_JSON ?? process.env.JWKS;
  if (!jwks) {
    throw new Error("Missing AUTH_JWKS_JSON for Convex custom JWT auth.");
  }

  return `data:text/plain;charset=utf-8,${encodeURIComponent(jwks)}`;
}

export default {
  providers: [
    {
      type: "customJwt",
      applicationID: process.env.AUTH_JWT_AUDIENCE ?? "convex",
      issuer: process.env.AUTH_JWT_ISSUER ?? process.env.SITE_URL ?? "http://localhost:3000",
      jwks: getJwksDataUri(),
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
