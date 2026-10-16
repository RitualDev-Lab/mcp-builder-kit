import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { McpCodeGenerator } from "../src/generator.js";
import { OpenApiToMcpConverter } from "../src/openapi.js";
import type { ToolDefinition } from "../src/types.js";

describe("Phase 2: Intelligent Tool, Resource & OpenAPI Generators Suite", () => {
  const sampleTool: ToolDefinition = {
    name: "calculate_tax",
    description: "Calculates federal and state sales tax",
    parameters: [
      {
        name: "subtotal",
        type: "number",
        description: "Subtotal amount in dollars",
        required: true,
      },
      {
        name: "state_code",
        type: "string",
        description: "Two letter state abbreviation",
        required: true,
      },
      {
        name: "tax_exempt",
        type: "boolean",
        description: "Whether customer has tax exempt status",
        required: false,
      },
    ],
  };

  test("generates strongly typed TypeScript tool code and Zod schemas", () => {
    const tsCode = McpCodeGenerator.generateTypeScriptTool(sampleTool);

    assert.ok(tsCode.includes("calculateTaxToolDefinition"));
    assert.ok(tsCode.includes("calculateTaxArgsSchema = z.object({"));
    assert.ok(tsCode.includes("subtotal: z.number()"));
    assert.ok(tsCode.includes("state_code: z.string()"));
    assert.ok(
      tsCode.includes(
        'tax_exempt: z.boolean().describe("Whether customer has tax exempt status").optional()',
      ),
    );
    assert.ok(tsCode.includes("handleCalculateTax("));
  });

  test("generates python FastMCP tool function with docstring and types", () => {
    const pyCode = McpCodeGenerator.generatePythonTool(sampleTool);

    assert.ok(pyCode.includes("@mcp.tool()"));
    assert.ok(
      pyCode.includes(
        "def calculate_tax(subtotal: float, state_code: str, tax_exempt: bool = None) -> str:",
      ),
    );
    assert.ok(pyCode.includes("Calculates federal and state sales tax"));
  });

  test("generates dynamic MCP resource definitions", () => {
    const resCode = McpCodeGenerator.generateTypeScriptResource({
      uri: "postgres://analytics/schema",
      name: "Analytics Schema",
      mimeType: "application/json",
      description: "Live Postgres schema definitions",
    });

    assert.ok(resCode.includes("analyticsSchemaResourceDefinition"));
    assert.ok(resCode.includes("postgres://analytics/schema"));
    assert.ok(resCode.includes("readAnalyticsSchemaResource()"));
  });

  test("converts OpenAPI specification into production MCP tools", () => {
    const sampleOpenApi = {
      openapi: "3.0.0",
      info: { title: "Pet Store API", version: "1.0.0" },
      paths: {
        "/pets": {
          get: {
            operationId: "list_pets",
            summary: "List all pets",
            parameters: [
              { name: "limit", in: "query", schema: { type: "integer" }, required: false },
              { name: "status", in: "query", schema: { type: "string" }, required: true },
            ],
          },
          post: {
            operationId: "create_pet",
            summary: "Create a new pet entry",
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["name", "species"],
                    properties: {
                      name: { type: "string", description: "Pet name" },
                      species: { type: "string", description: "Dog, cat, or bird" },
                      age: { type: "integer", description: "Pet age in years" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const conversion = OpenApiToMcpConverter.convert({
      spec: sampleOpenApi,
      language: "typescript",
    });

    assert.strictEqual(conversion.tools.length, 2);

    const listPets = conversion.tools.find((t) => t.name === "list_pets");
    assert.ok(listPets);
    assert.strictEqual(listPets.parameters.length, 2);
    assert.strictEqual(listPets.parameters[0].name, "limit");
    assert.strictEqual(listPets.parameters[0].type, "number");

    const createPet = conversion.tools.find((t) => t.name === "create_pet");
    assert.ok(createPet);
    assert.strictEqual(createPet.parameters.length, 3);
    assert.ok(conversion.generatedCode.includes("listPetsToolDefinition"));
    assert.ok(conversion.generatedCode.includes("createPetToolDefinition"));
    assert.ok(conversion.generatedCode.includes("fetch(url.toString()"));
    assert.ok(conversion.generatedCode.includes("new URL(fullUrl)"));
    assert.ok(conversion.generatedCode.includes("response.ok"));
  });

  test("converts OpenAPI specification into executable Python tools", () => {
    const sampleOpenApi = {
      openapi: "3.0.0",
      info: { title: "Pet Store API", version: "1.0.0" },
      paths: {
        "/pets/{petId}": {
          get: {
            operationId: "get_pet_by_id",
            summary: "Get pet by ID",
            parameters: [{ name: "petId", in: "path", schema: { type: "string" }, required: true }],
          },
        },
      },
    };

    const conversion = OpenApiToMcpConverter.convert({
      spec: sampleOpenApi,
      language: "python",
      baseUrl: "https://api.petstore.example.com/v1",
    });

    assert.strictEqual(conversion.tools.length, 1);
    assert.ok(conversion.generatedCode.includes("urllib.request.urlopen"));
    assert.ok(conversion.generatedCode.includes('endpoint_path.replace("{petId}"'));
    assert.ok(conversion.generatedCode.includes("https://api.petstore.example.com/v1"));
  });
});
