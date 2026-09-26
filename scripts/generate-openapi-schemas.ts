/**
 * Builds the OpenAPI component schemas from the same Convex validators that
 * validate persisted API resources. Run after changing convex/schema.ts.
 */
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"

import importedSchema from "../convex/schema"

type JsonSchema = Record<string, unknown>
type ConvexValidator = {
    kind: string
    isOptional?: "optional" | "required"
    fields?: Record<string, ConvexValidator>
    element?: ConvexValidator
    members?: ConvexValidator[]
    tableName?: string
    value?: unknown
}

const schema =
    (
        importedSchema as {
            default?: { tables: Record<string, { validator: ConvexValidator }> }
        }
    ).default ??
    (importedSchema as unknown as {
        tables: Record<string, { validator: ConvexValidator }>
    })

function toJsonSchema(validator: ConvexValidator): JsonSchema {
    switch (validator.kind) {
        case "string":
            return { type: "string" }
        case "boolean":
            return { type: "boolean" }
        case "float64":
            return { type: "number" }
        case "int64":
            return { type: "integer" }
        case "null":
            return { type: "null" }
        case "id":
            return {
                type: "string",
                description: `Convex ID for ${validator.tableName}`,
            }
        case "literal":
            return { const: validator.value }
        case "array":
            return { type: "array", items: toJsonSchema(validator.element!) }
        case "record":
            return {
                type: "object",
                additionalProperties: toJsonSchema(
                    (validator as ConvexValidator & { value: ConvexValidator })
                        .value
                ),
            }
        case "union":
            return { anyOf: validator.members!.map(toJsonSchema) }
        case "object": {
            const properties = Object.fromEntries(
                Object.entries(validator.fields!).map(([name, field]) => [
                    name,
                    toJsonSchema(field),
                ])
            )
            const required = Object.entries(validator.fields!)
                .filter(([, field]) => field.isOptional !== "optional")
                .map(([name]) => name)
            return {
                type: "object",
                properties,
                ...(required.length ? { required } : {}),
            }
        }
        case "any":
            return {}
        default:
            throw new Error(
                `Unsupported Convex validator kind: ${validator.kind}`
            )
    }
}

function exampleFor(validator: ConvexValidator): unknown {
    switch (validator.kind) {
        case "string":
        case "id":
            return "string"
        case "boolean":
            return true
        case "float64":
        case "int64":
            return 0
        case "null":
            return null
        case "literal":
            return validator.value
        case "array":
            return [exampleFor(validator.element!)]
        case "record":
            return {
                key: exampleFor(
                    (validator as ConvexValidator & { value: ConvexValidator })
                        .value
                ),
            }
        case "union":
            return exampleFor(validator.members![0]!)
        case "object":
            return Object.fromEntries(
                Object.entries(validator.fields!).map(([name, field]) => [
                    name,
                    exampleFor(field),
                ])
            )
        case "any":
            return null
        default:
            throw new Error(
                `Unsupported Convex validator kind: ${validator.kind}`
            )
    }
}

const apiResourceTables = {
    events: "events",
    groups: "groups",
    rosters: "rosters",
    assignments: "userAssignments",
    "calendar-items": "calendarItems",
    stratmaps: "stratmaps",
    "topic-presets": "topicPresets",
    "squad-presets": "squadPresets",
    matches: "matchStats",
    articles: "articles",
    users: "users",
} as const

const components = Object.fromEntries(
    Object.entries(apiResourceTables).map(([resource, table]) => {
        const document = toJsonSchema(schema.tables[table]!.validator)
        const properties = document.properties as Record<string, JsonSchema>
        // apiDocument() serializes Convex _id as id; _creationTime is never sent.
        properties.id = { type: "string", description: "Opaque resource ID." }
        const required = new Set(
            (document.required as string[] | undefined) ?? []
        )
        required.add("id")
        document.required = [...required]
        document.example = {
            ...(exampleFor(schema.tables[table]!.validator) as object),
            id: "string",
        }
        return [
            `Clan${resource.replace(/(^|-)([a-z])/g, (_, separator, letter) => `${separator}${letter.toUpperCase()}`).replace(/-/g, "")}Document`,
            document,
        ]
    })
)

const output = `// Generated by scripts/generate-openapi-schemas.ts. Do not edit manually.\n\nexport const generatedOpenApiSchemas = ${JSON.stringify(components, null, 4)} as const\n`
writeFileSync(
    resolve(process.cwd(), "src/lib/api/generated-openapi-schemas.ts"),
    output
)
