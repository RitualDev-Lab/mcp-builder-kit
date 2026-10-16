import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import test, { describe, after } from "node:test";
import { McpCodeGenerator, escapePythonDocstring, toPascalCase } from "../src/generator.js";
import { OpenApiToMcpConverter } from "../src/openapi.js";
import { McpProjectScaffolder } from "../src/scaffolder.js";
import { toSafePythonPackageName } from "../src/templates/python.js";
import { toSafeClassName } from "../src/templates/typescript.js";
import type { ToolDefinition } from "../src/types.js";
import { getPythonCommand } from "./helpers/python.js";

describe("Phase 2: Code Generator Hardening & Identifier Sanitization Suite", () => {
  const testOutputDir = join(process.cwd(), ".tmp_phase2_test_output");

  after(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe("Python Docstring Escaping & Quotation Hardening", () => {
    test("escapePythonDocstring escapes triple quotes and trailing quotes", () => {
      assert.strictEqual(
        escapePythonDocstring('Finds items matching """query"""'),
        'Finds items matching \\"\\"\\"query\\"\\"\\"',
      );
      assert.strictEqual(escapePythonDocstring('Ends with quote "'), 'Ends with quote \\"');
      assert.strictEqual(escapePythonDocstring("Normal description"), "Normal description");
    });

    test("compiles Python tool with hostile triple-quoted description cleanly via AST", () => {
      const hostileTool: ToolDefinition = {
        name: "hostile_search",
        description: 'Searches catalog using """hostile quotes""" and trailing quote "',
        parameters: [
          {
            name: "query",
            type: "string",
            description:
              'The search query containing """nested triple quotes""" and\nmultiline breaks',
            required: true,
          },
        ],
      };

      const pyCode = McpCodeGenerator.generatePythonTool(hostileTool);

      // Verify escaping in generated docstring
      assert.ok(pyCode.includes('\\"\\"\\"hostile quotes\\"\\"\\"'));
      assert.ok(!pyCode.includes('"""hostile quotes"""'));

      const pythonCmd = getPythonCommand();
      if (!pythonCmd) return;

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

      const result = execFileSync(
        pythonCmd,
        ["-c", "import ast, sys; ast.parse(sys.stdin.read()); print('SYNTAX_OK')"],
        { input: harness, encoding: "utf-8" },
      ).trim();

      assert.strictEqual(result, "SYNTAX_OK");
    });
  });

  describe("Class Identifier Normalization for Numeric & Illegal Starts", () => {
    test("toSafeClassName prefixes numeric starts for TypeScript classes", () => {
      assert.strictEqual(toSafeClassName("123"), "Mcp123Server");
      assert.strictEqual(toSafeClassName("456-service"), "Mcp456ServiceServer");
      assert.strictEqual(toSafeClassName("sample-mcp"), "SampleMcpServer");
      assert.strictEqual(toSafeClassName(""), "McpServer");
    });

    test("toPascalCase prefixes numeric starts", () => {
      assert.strictEqual(toPascalCase("123"), "Mcp123");
      assert.strictEqual(toPascalCase("456_tool"), "Mcp456Tool");
      assert.strictEqual(toPascalCase("get_users"), "GetUsers");
    });

    test("toSafePythonPackageName normalizes numeric starts for Python packages", () => {
      assert.strictEqual(toSafePythonPackageName("123"), "mcp_123");
      assert.strictEqual(toSafePythonPackageName("99-bottles"), "mcp_99_bottles");
      assert.strictEqual(toSafePythonPackageName("my-app"), "my_app");
      assert.strictEqual(toSafePythonPackageName(""), "mcp_server");
    });

    test("scaffolds valid TypeScript project when projectName is purely numeric '123'", () => {
      const targetDir = join(testOutputDir, "numeric-ts-123");
      const result = McpProjectScaffolder.scaffold({
        projectName: "123",
        targetDir,
        language: "typescript",
      });

      assert.strictEqual(result.success, true);
      const indexContent = result.filesCreated.find((f) => f === "src/index.ts")
        ? readFileSync(join(targetDir, "src/index.ts"), "utf8")
        : "";

      assert.ok(indexContent.includes("export class Mcp123Server"));
      assert.ok(indexContent.includes("new Mcp123Server()"));
      assert.ok(!indexContent.includes("export class 123Server"));
    });

    test("scaffolds valid Python project when projectName is purely numeric '123'", () => {
      const targetDir = join(testOutputDir, "numeric-py-123");
      const result = McpProjectScaffolder.scaffold({
        projectName: "123",
        targetDir,
        language: "python",
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.filesCreated.includes("mcp_123/server.py"));
      assert.ok(result.filesCreated.includes("tests/test_server.py"));

      const testContent = readFileSync(join(targetDir, "tests/test_server.py"), "utf8");
      assert.ok(testContent.includes("from mcp_123.server import echo"));
      assert.ok(!testContent.includes("from 123.server"));
    });
  });

  describe("OpenAPI Content-Type & Methods Compatibility", () => {
    test("converts multipart/form-data and application/x-www-form-urlencoded request bodies", () => {
      const spec = {
        openapi: "3.0.0",
        info: { title: "Upload & Form API", version: "1.0.0" },
        paths: {
          "/upload": {
            post: {
              operationId: "uploadFile",
              summary: "Uploads a multipart form",
              requestBody: {
                content: {
                  "multipart/form-data": {
                    schema: {
                      type: "object",
                      required: ["fileName"],
                      properties: {
                        fileName: { type: "string", description: "Target file name" },
                        fileData: { type: "string", description: "Base64 payload" },
                      },
                    },
                  },
                },
              },
            },
          },
          "/auth/token": {
            post: {
              operationId: "loginToken",
              summary: "Form-urlencoded OAuth login",
              requestBody: {
                content: {
                  "application/x-www-form-urlencoded": {
                    schema: {
                      type: "object",
                      required: ["username", "password"],
                      properties: {
                        username: { type: "string" },
                        password: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const result = OpenApiToMcpConverter.convert({ spec, language: "typescript" });
      assert.strictEqual(result.tools.length, 2);

      const uploadTool = result.tools.find((t) => t.name === "uploadfile");
      assert.ok(uploadTool);
      assert.strictEqual(uploadTool.parameters.length, 2);
      assert.ok(uploadTool.parameters.some((p) => p.name === "fileName" && p.required));

      const authTool = result.tools.find((t) => t.name === "logintoken");
      assert.ok(authTool);
      assert.strictEqual(authTool.parameters.length, 2);
    });

    test("emits structured warnings for unsupported requestBody MIME types and unsupported methods", () => {
      const spec = {
        openapi: "3.0.0",
        info: { title: "Unsupported MIME and Method API", version: "1.0.0" },
        paths: {
          "/xml-feed": {
            post: {
              operationId: "postXml",
              requestBody: {
                content: {
                  "application/xml": {
                    schema: { type: "string" },
                  },
                },
              },
            },
            custom_http_verb: {
              operationId: "customOp",
            },
          },
        },
      };

      const result = OpenApiToMcpConverter.convert({ spec, language: "typescript" });
      assert.ok(result.warnings && result.warnings.length > 0);
      assert.ok(
        result.warnings.some((w) =>
          w.includes("unsupported requestBody content-type(s): application/xml"),
        ),
        "Must warn about unsupported application/xml MIME type",
      );
      assert.ok(
        result.warnings.some((w) =>
          w.includes("Skipped unsupported HTTP method 'CUSTOM_HTTP_VERB'"),
        ),
        "Must warn about skipped unsupported HTTP method",
      );
    });
  });
});
