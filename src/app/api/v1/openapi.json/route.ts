import { NextResponse } from "next/server";
import { z } from "zod";

import { clanDataSchema, eventSchema, matchSchema, publicClanSchema, publicPlayerSchema, rosterSchema } from "@/lib/public-api-contract";

const error = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const page = z.object({ page: z.array(matchSchema), continueCursor: z.string(), isDone: z.boolean() });
const competition = z.object({ id: z.string(), slug: z.string(), name: z.string(), season: z.string(), divisions: z.array(z.object({ id: z.string(), name: z.string(), teams: z.array(z.object({ id: z.string(), name: z.string(), withdrawn: z.boolean() })), fixtures: z.array(z.object({ id: z.string(), phase: z.enum(["league", "playoff", "relegation"]), teamAId: z.string(), teamBId: z.string(), scoreA: z.number().optional(), scoreB: z.number().optional(), status: z.enum(["scheduled", "final", "forfeit"]), scheduledAt: z.string().optional(), eventId: z.string().optional() })) })) });
const schema = (value: z.ZodType) => z.toJSONSchema(value, { target: "draft-2020-12", unrepresentable: "any" });
const response = (value: z.ZodType) => ({ content: { "application/json": { schema: schema(value) } } });
const data = (value: z.ZodType) => z.object({ data: value });
const errorResponse = { description: "Error", ...response(error) };

const specification = {
  openapi: "3.1.1", info: { title: "Logi API", version: "1.0.0", description: "Read-only API for public Logi data and clan websites." }, servers: [{ url: "/api/v1" }],
  components: { securitySchemes: { clanApiKey: { type: "http", scheme: "bearer", bearerFormat: "API key" } } },
  paths: {
    "/clan": { get: { summary: "Get the complete authenticated clan website dataset", security: [{ clanApiKey: [] }], responses: { "200": { description: "Clan website data", ...response(data(clanDataSchema)) }, "401": errorResponse, "429": errorResponse } } },
    "/clan/articles": { get: { summary: "List the authenticated clan's articles", security: [{ clanApiKey: [] }], responses: { "200": { description: "Articles", ...response(data(z.array(z.object({ id: z.string(), guildId: z.string(), title: z.string(), description: z.string(), tags: z.array(z.string()), body: z.string(), attachments: z.array(z.string()), authorId: z.string(), createdAt: z.string(), updatedAt: z.string() })))) }, "401": errorResponse, "429": errorResponse } } },
    "/public/competitions/{slug}": { get: { summary: "Get a public competition and fixtures", parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Competition", ...response(data(competition)) }, "404": errorResponse, "429": errorResponse } } },
    "/public/clans/{clanId}": { get: { summary: "Get a public clan profile", parameters: [{ name: "clanId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Clan", ...response(data(publicClanSchema)) }, "404": errorResponse, "429": errorResponse } } },
    "/public/players/{playerId}": { get: { summary: "Get a public player profile", parameters: [{ name: "playerId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Player", ...response(data(publicPlayerSchema)) }, "404": errorResponse, "429": errorResponse } } },
    "/public/matches": { get: { summary: "List published match results", parameters: [{ name: "cursor", in: "query", schema: { type: "string", nullable: true } }], responses: { "200": { description: "Paginated matches", ...response(data(page)) }, "429": errorResponse } } },
    "/public/matches/{eventId}": { get: { summary: "Get a published match and detailed statistics", parameters: [{ name: "eventId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Match", ...response(data(matchSchema)) }, "404": errorResponse, "429": errorResponse } } },
  },
};

export async function GET() { return NextResponse.json(specification, { headers: { "Cache-Control": "no-store" } }); }
