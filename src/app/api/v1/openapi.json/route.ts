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
const collectionPage = (item: z.ZodType) => z.object({ page: z.array(item), total: z.number(), offset: z.number(), limit: z.number(), nextOffset: z.number().nullable() });
const collectionParameters = [
  { name: "filter[field]", in: "query", description: "Exact-match any top-level field. Repeat filters to combine them with AND.", schema: { type: "string" } },
  { name: "filter[parent.field]", in: "query", description: "Exact-match a field one level inside a top-level object.", schema: { type: "string" } },
  { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
];
const nestedCollectionParameters = (collections: string[]) => [{ name: "collection", in: "query", required: false, description: "Returns this nested collection as a filtered, paginated page. Omit it for the complete resource.", schema: { type: "string", enum: collections } }, ...collectionParameters];

const specification = {
  openapi: "3.1.1", info: { title: "Logi API", version: "1.0.0", description: "Read-only API for public Logi data and clan websites." }, servers: [{ url: "/api/v1" }],
  components: { securitySchemes: { clanApiKey: { type: "http", scheme: "bearer", bearerFormat: "API key" } } },
  paths: {
    "/clan": { get: { summary: "Get the complete authenticated clan website dataset", security: [{ clanApiKey: [] }], responses: { "200": { description: "Clan website data", ...response(data(clanDataSchema)) }, "401": errorResponse, "429": errorResponse } } },
    "/clan/articles": { get: { summary: "List and filter the authenticated clan's articles", description: "Filters use exact matching. Supported paths are any response field at depth one or two; all filters are combined with AND.", security: [{ clanApiKey: [] }], parameters: collectionParameters, responses: { "200": { description: "Articles", ...response(data(collectionPage(z.object({ id: z.string(), guildId: z.string(), title: z.string(), description: z.string(), tags: z.array(z.string()), body: z.string(), attachments: z.array(z.string()), authorId: z.string(), createdAt: z.string(), updatedAt: z.string() })))) }, "400": errorResponse, "401": errorResponse, "429": errorResponse } } },
    "/clan/{collection}": { get: { summary: "List, filter, and paginate an authenticated clan collection", description: "Available collections: events, groups, rosters, assignments, calendarItems, stratmaps, topicPresets, squadPresets, matches, and articles. Filters use exact matching of any response field at depth one or two, and every filter is combined with AND.", security: [{ clanApiKey: [] }], parameters: [{ name: "collection", in: "path", required: true, schema: { type: "string", enum: ["events", "groups", "rosters", "assignments", "calendarItems", "stratmaps", "topicPresets", "squadPresets", "matches", "articles"] } }, ...collectionParameters], responses: { "200": { description: "Collection page", ...response(data(collectionPage(z.unknown()))) }, "400": errorResponse, "401": errorResponse, "404": errorResponse, "429": errorResponse } } },
    "/public/competitions/{slug}": { get: { summary: "Get a public competition and fixtures", description: "Set collection=divisions to filter and paginate divisions; otherwise returns the complete competition.", parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }, ...nestedCollectionParameters(["divisions"])], responses: { "200": { description: "Competition or collection page", ...response(data(z.union([competition, collectionPage(z.unknown())]))) }, "400": errorResponse, "404": errorResponse, "429": errorResponse } } },
    "/public/clans/{clanId}": { get: { summary: "Get a public clan profile", description: "Set collection=recentMatches to filter and paginate the profile's match history.", parameters: [{ name: "clanId", in: "path", required: true, schema: { type: "string" } }, ...nestedCollectionParameters(["recentMatches"])], responses: { "200": { description: "Clan or collection page", ...response(data(z.union([publicClanSchema, collectionPage(z.unknown())]))) }, "400": errorResponse, "404": errorResponse, "429": errorResponse } } },
    "/public/players/{playerId}": { get: { summary: "Get a public player profile", description: "Set collection=clans or collection=recentMatches to filter and paginate that nested collection.", parameters: [{ name: "playerId", in: "path", required: true, schema: { type: "string" } }, ...nestedCollectionParameters(["clans", "recentMatches"])], responses: { "200": { description: "Player or collection page", ...response(data(z.union([publicPlayerSchema, collectionPage(z.unknown())]))) }, "400": errorResponse, "404": errorResponse, "429": errorResponse } } },
    "/public/matches": { get: { summary: "List, filter, and paginate published match results", description: "Filters use exact matching of any response field at depth one or two, and every filter is combined with AND. Use cursor from the previous response, or offset for the first page.", parameters: [{ name: "cursor", in: "query", schema: { type: "string", nullable: true } }, ...collectionParameters], responses: { "200": { description: "Paginated matches", ...response(data(page)) }, "400": errorResponse, "429": errorResponse } } },
    "/public/matches/{eventId}": { get: { summary: "Get a published match and detailed statistics", description: "Set collection=playerStats to filter and paginate player statistics; otherwise returns the complete match.", parameters: [{ name: "eventId", in: "path", required: true, schema: { type: "string" } }, ...nestedCollectionParameters(["playerStats"])], responses: { "200": { description: "Match or collection page", ...response(data(z.union([matchSchema, collectionPage(z.unknown())]))) }, "400": errorResponse, "404": errorResponse, "429": errorResponse } } },
  },
};

export async function GET() { return NextResponse.json(specification, { headers: { "Cache-Control": "no-store" } }); }
