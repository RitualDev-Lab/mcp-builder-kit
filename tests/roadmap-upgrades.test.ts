import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import test, { describe, after } from "node:test";
import { McpCodeGenerator } from "../src/generator.js";
import { OpenApiToMcpConverter } from "../src/openapi.js";
import { McpVisualInspectorServer } from "../src/dashboard.js";
import { EnterprisePackManager, PREMIUM_MCP_PACKS } from "../src/packs.js";
import { AgentShieldMcpAuditor } from "../src/security.js";
import { McpServerPackager } from "../src/packager.js";
import type { ToolDefinition } from "../src/types.js";

describe("Roadmap Upgrades Suite: OpenAPI 3.1, Runtime Auth, Testing Studio UI, Enterprise Packs & Security Pre-Flight", () => {
  const tmpDir = join(process.cwd(), ".tmp_test_roadmap_upgrades");

  after(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe("1. OpenAPI 3.1 & Complex Schema Generator", () => {
    test("handles OpenAPI 3.1 anyOf, oneOf, and array types (e.g. ['string', 'null'])", () => {
      const openApi31Spec = {
        openapi: "3.1.0",
        info: { title: "OpenAPI 3.1 Advanced API", version: "1.0.0" },
        paths: {
          "/search": {
            post: {
              operationId: "searchEntity",
              summary: "Complex search with anyOf and nullable fields",
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["query"],
                      properties: {
                        query: {
                          type: ["string", "null"],
                          description: "Search keyword",
                        },
                        filter: {
                          oneOf: [
                            { type: "string", description: "Filter by tag string" },
                            { type: "number", description: "Filter by numeric id" },
                          ],
                        },
                        options: {
                          anyOf: [
                            {
                              type: "object",
                              properties: {
                                caseSensitive: { type: "boolean" },
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const result = OpenApiToMcpConverter.convert({
        spec: openApi31Spec,
        language: "typescript",
      });

      assert.strictEqual(result.tools.length, 1);
      const tool = result.tools[0];
      assert.strictEqual(tool.name, "searchentity");

      // Verify parameters
      const queryParam = tool.parameters.find((p) => p.name === "query");
      assert.ok(queryParam);
      assert.strictEqual(queryParam.type, "string");

      const filterParam = tool.parameters.find((p) => p.name === "filter");
      assert.ok(filterParam);
      assert.ok(filterParam.oneOf && filterParam.oneOf.length === 2);

      // Verify generated TypeScript Zod schema
      assert.ok(result.generatedCode.includes("z.union"));
      assert.ok(result.generatedCode.includes("handleSearchentity"));
    });

    test("breaks recursive circular reference cycles safely without crashing", () => {
      const cyclicSpec = {
        openapi: "3.1.0",
        info: { title: "Cyclic Tree API", version: "1.0.0" },
        paths: {
          "/tree": {
            post: {
              operationId: "createTree",
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/TreeNode",
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            TreeNode: {
              type: "object",
              properties: {
                val: { type: "string" },
                children: {
                  type: "array",
                  items: { $ref: "#/components/schemas/TreeNode" },
                },
                parent: { $ref: "#/components/schemas/TreeNode" },
              },
            },
          },
        },
      };

      const result = OpenApiToMcpConverter.convert({
        spec: cyclicSpec,
        language: "typescript",
      });

      assert.strictEqual(result.tools.length, 1);
      assert.strictEqual(result.tools[0].name, "createtree");
      assert.ok(result.tools[0].parameters.some((p) => p.name === "val"));
    });

    test("handles multipart/form-data upload parameters and generates FormData handling", () => {
      const uploadSpec = {
        openapi: "3.1.0",
        info: { title: "Binary Upload API", version: "1.0.0" },
        paths: {
          "/documents/upload": {
            post: {
              operationId: "uploadDocument",
              summary: "Uploads binary document with metadata",
              requestBody: {
                content: {
                  "multipart/form-data": {
                    schema: {
                      type: "object",
                      required: ["documentFile", "category"],
                      properties: {
                        documentFile: {
                          type: "string",
                          format: "binary",
                          description: "Binary document buffer or file",
                        },
                        category: {
                          type: "string",
                          description: "Document taxonomy category",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const tsResult = OpenApiToMcpConverter.convert({
        spec: uploadSpec,
        language: "typescript",
      });

      const tool = tsResult.tools[0];
      assert.strictEqual(tool.name, "uploaddocument");
      assert.ok(tool.apiEndpoint?.isMultipart);
      assert.strictEqual(tool.apiEndpoint?.contentType, "multipart/form-data");

      const fileParam = tool.parameters.find((p) => p.name === "documentFile");
      assert.ok(fileParam?.isFileUpload);

      // Verify TypeScript generated code uses new FormData()
      assert.ok(tsResult.generatedCode.includes("const formData = new FormData()"));
      assert.ok(tsResult.generatedCode.includes("formData.append"));

      // Verify Python generated code builds multipart payload
      const pyResult = OpenApiToMcpConverter.convert({
        spec: uploadSpec,
        language: "python",
      });
      assert.ok(pyResult.generatedCode.includes("multipart/form-data; boundary="));
    });
  });

  describe("2. Runtime Authentication & Header Propagation", () => {
    test("generated tool code propagates dynamic per-user Bearer token / API key at runtime", () => {
      const authTool: ToolDefinition = {
        name: "get_user_profile",
        description: "Fetches user profile with runtime Bearer token",
        parameters: [{ name: "user_id", type: "string", required: true }],
        apiEndpoint: {
          path: "/users/{user_id}",
          method: "GET",
          pathParams: ["user_id"],
          authHeader: { name: "Authorization", prefix: "Bearer " },
        },
      };

      const tsCode = McpCodeGenerator.generateTypeScriptTool(authTool);

      // Verify dynamic auth extraction in TypeScript
      assert.ok(tsCode.includes("dynamicAuth"));
      assert.ok(tsCode.includes("_meta?.headers"));
      assert.ok(tsCode.includes('headers["Authorization"] ='));

      // Verify Python dynamic auth pass-through
      const pyCode = McpCodeGenerator.generatePythonTool(authTool);
      assert.ok(pyCode.includes("dynamic_token"));
      assert.ok(pyCode.includes('headers["Authorization"] ='));
    });
  });

  describe("3. Interactive Testing Studio Web UI (mcp-builder-kit ui)", () => {
    test("McpVisualInspectorServer provides schema validation debugger and latency benchmark endpoints", async () => {
      const server = new McpVisualInspectorServer({ port: 4192 });
      const instance = await server.start();

      try {
        // 1. GET /api/tools returns registered tools list
        const toolsRes = await fetch(`${instance.url}/api/tools`);
        assert.strictEqual(toolsRes.status, 200);
        const tools = await toolsRes.json();
        assert.ok(Array.isArray(tools));
        assert.ok(tools.length >= 3);
        assert.ok(tools.some((t: { name: string }) => t.name === "query_database"));

        // 2. POST /api/validate tests schema validation debugger
        // Invalid arguments (missing required 'sql')
        const invalidRes = await fetch(`${instance.url}/api/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: "query_database",
            arguments: { params: [] },
          }),
        });
        const invalidValidation = await invalidRes.json();
        assert.strictEqual(invalidValidation.valid, false);
        assert.ok(invalidValidation.errors.length > 0);
        assert.strictEqual(invalidValidation.errors[0].field, "sql");

        // Valid arguments
        const validRes = await fetch(`${instance.url}/api/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: "query_database",
            arguments: { sql: "SELECT 1", params: [] },
          }),
        });
        const validValidation = await validRes.json();
        assert.strictEqual(validValidation.valid, true);
        assert.strictEqual(validValidation.errors.length, 0);

        // 3. POST /api/benchmark tests multi-run latency benchmarker
        const benchRes = await fetch(`${instance.url}/api/benchmark`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: "query_database",
            arguments: { sql: "SELECT 1" },
            iterations: 5,
          }),
        });
        assert.strictEqual(benchRes.status, 200);
        const bench = await benchRes.json();
        assert.strictEqual(bench.iterations, 5);
        assert.ok(typeof bench.minMs === "number");
        assert.ok(typeof bench.avgMs === "number");
        assert.ok(typeof bench.maxMs === "number");
        assert.strictEqual(bench.runs.length, 5);

        // 4. POST /api/call attaches latencyMs and validation status
        const callRes = await fetch(`${instance.url}/api/call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: "query_database",
            arguments: { sql: "SELECT id FROM users" },
          }),
        });
        const callData = await callRes.json();
        assert.strictEqual(callData.jsonrpc, "2.0");
        assert.ok(typeof callData.latencyMs === "number");
        assert.ok(callData.validation.valid);
      } finally {
        instance.stop();
      }
    });
  });

  describe("4. New Enterprise Starter Packs (src/packs.ts)", () => {
    test("PREMIUM_MCP_PACKS contains Snowflake, BigQuery, AWS S3/R2, Stripe Webhooks, and Redis packs", () => {
      const requiredPackIds = [
        "snowflake-connector-pack",
        "bigquery-connector-pack",
        "aws-s3-r2-storage-pack",
        "stripe-webhooks-pack",
        "redis-enterprise-pack",
      ];

      for (const packId of requiredPackIds) {
        const pack = EnterprisePackManager.getPack(packId);
        assert.ok(pack, `Expected pack '${packId}' to exist`);
        assert.ok(pack.sampleTools.length >= 4);
        assert.ok(pack.checkoutUrl.includes("checkout.dodopayments.com"));
        assert.ok(pack.features.length >= 3);
      }

      // Verify installation of Snowflake pack stubs
      const packInstallDir = join(tmpDir, "packs");
      const installRes = EnterprisePackManager.installPack(
        "snowflake-connector-pack",
        packInstallDir,
      );
      assert.strictEqual(installRes.success, true);
      assert.ok(installRes.filesCreated.length > 0);
      const stubContent = readFileSync(installRes.filesCreated[0], "utf8");
      assert.ok(stubContent.includes("snowflake_queryDefinition"));
      assert.ok(stubContent.includes("snowflake_describe_tableDefinition"));
    });
  });

  describe("5. Built-in Security Pre-Flight (AgentShield integration)", () => {
    test("AgentShieldMcpAuditor audits in-memory source code and tool definitions", () => {
      const unsafeCode = `
import { execSync } from "child_process";
const token = "sk-ant-api03-abcdef1234567890abcdef1234567890";
export function runTool(userInput) {
  execSync(\`curl \${userInput}\`);
}
`;
      const findings = AgentShieldMcpAuditor.auditSourceCode(unsafeCode, "test-tool.ts");
      assert.ok(findings.length >= 2);
      assert.ok(findings.some((f) => f.type === "hardcoded_secret"));
      assert.ok(findings.some((f) => f.type === "command_injection"));

      // Clean tool definition audit
      const cleanTool: ToolDefinition = {
        name: "math_add",
        description: "Adds two numbers",
        parameters: [
          { name: "a", type: "number", required: true },
          { name: "b", type: "number", required: true },
        ],
      };
      const cleanReport = AgentShieldMcpAuditor.auditTool(cleanTool);
      assert.strictEqual(cleanReport.score, 100);
      assert.strictEqual(cleanReport.isSecure, true);
    });

    test("McpServerPackager runs security preflight check and blocks packaging on critical hazards", () => {
      const vulnerableDir = join(tmpDir, "vuln_mcp");
      mkdirSync(vulnerableDir, { recursive: true });
      writeFileSync(
        join(vulnerableDir, "vulnerable.ts"),
        `import { execSync } from "child_process";\nconst key = "sk-ant-abcdef12345678901234567890";\nexecSync(\`rm -rf \${arg}\`);\n`,
        "utf8",
      );

      // Should fail security preflight when critical vulnerabilities are found
      assert.throws(
        () => {
          McpServerPackager.package({
            serverName: "vulnerable-mcp",
            targetDir: vulnerableDir,
          });
        },
        (err: Error) => {
          return err.message.includes("AgentShield Security Pre-Flight Failed");
        },
      );

      // Should allow packaging when skipSecurityPreflight: true is explicitly passed
      const bypassed = McpServerPackager.package({
        serverName: "vulnerable-mcp",
        targetDir: vulnerableDir,
        skipSecurityPreflight: true,
      });
      assert.ok(bypassed);
      assert.ok(bypassed.writtenFiles.includes("Dockerfile"));
    });
  });
});
