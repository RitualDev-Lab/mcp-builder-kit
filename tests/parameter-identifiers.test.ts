import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test, { describe } from "node:test";
import {
  McpCodeGenerator,
  buildPythonParameterMap,
  formatPropertyKey,
  toSafePythonIdentifier,
} from "../src/generator.js";
import { OpenApiToMcpConverter } from "../src/openapi.js";
import type { ToolDefinition } from "../src/types.js";
import { getPythonCommand } from "./helpers/python.js";

describe("Phase 1: Safe Parameter Identifier Mapping & Syntax Quoting (M1)", () => {
  describe("TypeScript formatPropertyKey", () => {
    test("preserves valid JavaScript identifiers unquoted", () => {
      assert.strictEqual(formatPropertyKey("subtotal"), "subtotal");
      assert.strictEqual(formatPropertyKey("state_code"), "state_code");
      assert.strictEqual(formatPropertyKey("$schema"), "$schema");
      assert.strictEqual(formatPropertyKey("taxRate1"), "taxRate1");
    });

    test("quotes hyphenated and dotted property names", () => {
      assert.strictEqual(formatPropertyKey("api-key"), '"api-key"');
      assert.strictEqual(formatPropertyKey("user-id"), '"user-id"');
      assert.strictEqual(formatPropertyKey("user.name"), '"user.name"');
      assert.strictEqual(formatPropertyKey("x-amz-date"), '"x-amz-date"');
    });

    test("quotes JavaScript reserved keywords", () => {
      assert.strictEqual(formatPropertyKey("class"), '"class"');
      assert.strictEqual(formatPropertyKey("import"), '"import"');
      assert.strictEqual(formatPropertyKey("default"), '"default"');
      assert.strictEqual(formatPropertyKey("delete"), '"delete"');
      assert.strictEqual(formatPropertyKey("return"), '"return"');
    });
  });

  describe("Python toSafePythonIdentifier", () => {
    test("converts standard names and camelCase to snake_case", () => {
      assert.strictEqual(toSafePythonIdentifier("subtotal"), "subtotal");
      assert.strictEqual(toSafePythonIdentifier("apiKey"), "api_key");
      assert.strictEqual(toSafePythonIdentifier("calculateTax"), "calculate_tax");
    });

    test("converts hyphens, dots, and special characters to underscores", () => {
      assert.strictEqual(toSafePythonIdentifier("api-key"), "api_key");
      assert.strictEqual(toSafePythonIdentifier("user.id"), "user_id");
      assert.strictEqual(toSafePythonIdentifier("x-amz-date"), "x_amz_date");
    });

    test("prefixes leading numbers with arg_", () => {
      assert.strictEqual(toSafePythonIdentifier("2fa_token"), "arg_2fa_token");
      assert.strictEqual(toSafePythonIdentifier("123"), "arg_123");
    });

    test("appends underscore to Python reserved keywords and shadowed builtins", () => {
      assert.strictEqual(toSafePythonIdentifier("class"), "class_");
      assert.strictEqual(toSafePythonIdentifier("from"), "from_");
      assert.strictEqual(toSafePythonIdentifier("import"), "import_");
      assert.strictEqual(toSafePythonIdentifier("def"), "def_");
      assert.strictEqual(toSafePythonIdentifier("return"), "return_");
      assert.strictEqual(toSafePythonIdentifier("type"), "type_");
    });

    test("falls back to default identifier when string is empty or symbols only", () => {
      assert.strictEqual(toSafePythonIdentifier("---"), "param");
      assert.strictEqual(toSafePythonIdentifier(""), "param");
    });
  });

  describe("Python Parameter Map & Collision Disambiguation", () => {
    test("detects collisions between distinct wire parameters that normalize identically", () => {
      const parameters = [
        { name: "user-id", type: "string" as const },
        { name: "user_id", type: "string" as const },
        { name: "userId", type: "string" as const },
      ];

      const mapping = buildPythonParameterMap(parameters);
      assert.strictEqual(mapping.get("user-id"), "user_id");
      assert.strictEqual(mapping.get("user_id"), "user_id_2");
      assert.strictEqual(mapping.get("userId"), "user_id_3");
    });

    test("handles collisions with reserved words cleanly", () => {
      const parameters = [
        { name: "class", type: "string" as const },
        { name: "class-", type: "string" as const },
      ];

      const mapping = buildPythonParameterMap(parameters);
      assert.strictEqual(mapping.get("class"), "class_");
      assert.strictEqual(mapping.get("class-"), "class_2");
    });
  });

  describe("TypeScript Generator Safety (M1 Integration)", () => {
    const complexTool: ToolDefinition = {
      name: "update_item",
      description: "Updates an item with hyphenated and reserved parameters",
      parameters: [
        { name: "item-id", type: "string", required: true },
        { name: "api-key", type: "string", required: true },
        { name: "class", type: "string", required: false },
        { name: "user.role", type: "string", required: false },
      ],
      apiEndpoint: {
        path: "/items/{item-id}",
        method: "PUT",
        pathParams: ["item-id"],
        queryParams: ["api-key", "class"],
        hasBody: true,
      },
    };

    test("generates safe bracket access and quotes invalid keys in TypeScript", () => {
      const tsCode = McpCodeGenerator.generateTypeScriptTool(complexTool);

      // Zod schema property quoting
      assert.ok(tsCode.includes('"item-id": z.string()'));
      assert.ok(tsCode.includes('"api-key": z.string()'));
      assert.ok(tsCode.includes('"class": z.string()'));
      assert.ok(tsCode.includes('"user.role": z.string()'));

      // Safe bracket access in handler
      assert.ok(tsCode.includes('args["item-id"]'));
      assert.ok(tsCode.includes('args["api-key"]'));
      assert.ok(tsCode.includes('args["class"]'));

      // Path parameter replacement with wire name
      assert.ok(
        tsCode.includes(
          '.replaceAll("{item-id}", encodeURIComponent(String(args["item-id"] ?? "")))',
        ),
      );

      // Payload exclusions use bracket access
      assert.ok(tsCode.includes('delete (bodyPayload as any)["item-id"]'));
      assert.ok(tsCode.includes('delete (bodyPayload as any)["api-key"]'));
      assert.ok(tsCode.includes('delete (bodyPayload as any)["class"]'));
    });
  });

  describe("Python Generator Safety & AST Syntax Conformance (M1 Integration)", () => {
    const complexTool: ToolDefinition = {
      name: "fetch_catalog",
      description: "Fetches catalog items using hyphenated and reserved parameter names",
      parameters: [
        { name: "catalog-id", type: "string", required: true },
        { name: "api-key", type: "string", required: true },
        { name: "class", type: "string", required: false },
        { name: "import", type: "string", required: false },
        { name: "user-id", type: "string", required: false },
        { name: "user_id", type: "string", required: false },
      ],
      apiEndpoint: {
        path: "/catalogs/{catalog-id}",
        method: "GET",
        pathParams: ["catalog-id"],
        queryParams: ["api-key", "class", "import", "user-id", "user_id"],
        hasBody: false,
      },
    };

    test("generates valid Python signature and maps wire keys to safe variables", () => {
      const pyCode = McpCodeGenerator.generatePythonTool(complexTool);

      // Check function signature uses safe identifiers
      assert.ok(pyCode.includes("catalog_id: str"));
      assert.ok(pyCode.includes("api_key: str"));
      assert.ok(pyCode.includes("class_: str = None"));
      assert.ok(pyCode.includes("import_: str = None"));
      assert.ok(pyCode.includes("user_id: str = None"));
      assert.ok(pyCode.includes("user_id_2: str = None"));

      // Check path replacement preserves wire token and uses safe variable
      assert.ok(
        pyCode.includes('endpoint_path.replace("{catalog-id}", urllib.parse.quote(str(catalog_id)'),
      );

      // Check query params dictionary maps wire name to safe variable
      assert.ok(pyCode.includes('"api-key": api_key'));
      assert.ok(pyCode.includes('"class": class_'));
      assert.ok(pyCode.includes('"import": import_'));
      assert.ok(pyCode.includes('"user-id": user_id'));
      assert.ok(pyCode.includes('"user_id": user_id_2'));
    });

    test("compiles generated Python code without syntax errors using Python AST", () => {
      const pyCode = McpCodeGenerator.generatePythonTool(complexTool);

      const harness = `
class MockMcp:
    def tool(self):
        def decorator(f):
            return f
        return decorator

mcp = MockMcp()
BASE_URL = "https://api.example.com"

${pyCode}
`;

      const pythonCmd = getPythonCommand();
      if (!pythonCmd) return;

      const result = execFileSync(
        pythonCmd,
        ["-c", "import ast, sys; ast.parse(sys.stdin.read()); print('SYNTAX_OK')"],
        { input: harness, encoding: "utf-8" },
      ).trim();

      assert.strictEqual(result, "SYNTAX_OK");
    });
  });

  describe("OpenAPI Converter with Non-Identifier Parameters", () => {
    test("converts OpenAPI endpoints with hyphenated and reserved parameters cleanly", () => {
      const openapiSpec = {
        openapi: "3.0.0",
        info: { title: "Secure Gateway API", version: "1.0.0" },
        paths: {
          "/gateways/{gateway-id}": {
            get: {
              operationId: "get_gateway_status",
              summary: "Retrieve gateway status",
              parameters: [
                { name: "gateway-id", in: "path", required: true, schema: { type: "string" } },
                { name: "x-api-key", in: "query", required: true, schema: { type: "string" } },
                { name: "type", in: "query", required: false, schema: { type: "string" } },
              ],
            },
          },
        },
      };

      const tsConversion = OpenApiToMcpConverter.convert({
        spec: openapiSpec,
        language: "typescript",
        baseUrl: "https://gateway.example.com",
      });

      assert.strictEqual(tsConversion.tools.length, 1);
      assert.ok(tsConversion.generatedCode.includes('"gateway-id": z.string()'));
      assert.ok(tsConversion.generatedCode.includes('"x-api-key": z.string()'));
      assert.ok(tsConversion.generatedCode.includes('args["gateway-id"]'));
      assert.ok(tsConversion.generatedCode.includes('args["x-api-key"]'));

      const pyConversion = OpenApiToMcpConverter.convert({
        spec: openapiSpec,
        language: "python",
        baseUrl: "https://gateway.example.com",
      });

      assert.strictEqual(pyConversion.tools.length, 1);
      assert.ok(pyConversion.generatedCode.includes("gateway_id: str"));
      assert.ok(pyConversion.generatedCode.includes("x_api_key: str"));
      assert.ok(pyConversion.generatedCode.includes("type_: str = None"));
      assert.ok(pyConversion.generatedCode.includes('"x-api-key": x_api_key'));
      assert.ok(pyConversion.generatedCode.includes('"type": type_'));
    });
  });
});
