function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getFirstEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }
  return undefined;
}

export function getSiteUrl() {
  return process.env.SITE_URL ?? "http://localhost:3000";
}

export function getAuthIssuer() {
  return process.env.AUTH_JWT_ISSUER ?? getSiteUrl();
}

export function getAuthAudience() {
  return process.env.AUTH_JWT_AUDIENCE ?? "convex";
}

export function getDiscordClientId() {
  return getFirstEnv("DISCORD_CLIENT_ID", "AUTH_DISCORD_ID") ?? requireEnv("DISCORD_CLIENT_ID");
}

export function getDiscordClientSecret() {
  return getFirstEnv("DISCORD_CLIENT_SECRET", "AUTH_DISCORD_SECRET") ?? requireEnv("DISCORD_CLIENT_SECRET");
}

export function getDiscordRedirectUri() {
  return process.env.DISCORD_REDIRECT_URI ?? `${getSiteUrl()}/api/auth/callback/discord`;
}

export function getAuthPrivateKeyPem() {
  return getFirstEnv("AUTH_PRIVATE_KEY", "JWT_PRIVATE_KEY") ?? requireEnv("AUTH_PRIVATE_KEY");
}

export function getAuthKeyId() {
  return process.env.AUTH_JWT_KID ?? "logi-main";
}

export function getAuthJwksJson() {
  return getFirstEnv("AUTH_JWKS_JSON", "JWKS") ?? requireEnv("AUTH_JWKS_JSON");
}
