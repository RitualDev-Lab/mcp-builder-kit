import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import test, { describe } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { McpCodeGenerator } from "../src/generator.js";
import { OpenApiToMcpConverter } from "../src/openapi.js";
import { getPythonCommand } from "./helpers/python.js";

function verifyTypeScriptCompilation(code: string): { errors: string[] } {
  const dummyFileName = "virtual-mcp-tools.ts";
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  };

  const sourceFile = ts.createSourceFile(dummyFileName, code, ts.ScriptTarget.ES2022, true);
  const defaultHost = ts.createCompilerHost(options);

  const customHost: ts.CompilerHost = {
    ...defaultHost,
    getSourceFile: (fileName, languageVersion) => {
      if (fileName === dummyFileName) return sourceFile;
      return defaultHost.getSourceFile(fileName, languageVersion);
    },
    writeFile: () => {},
    fileExists: (fileName) => {
      if (fileName === dummyFileName) return true;
      return defaultHost.fileExists(fileName);
    },
  };

  const program = ts.createProgram([dummyFileName], options, customHost);
  const diagnostics = ts.getPreEmitDiagnostics(program, sourceFile);
  const errors = diagnostics.map((d) => {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    return `${d.file?.fileName || ""}: ${msg}`;
  });

  return { errors };
}

describe("Phase 5: End-to-End Compiler Verification & Release Standards Suite", () => {
  const richEnterpriseOpenApi = {
    openapi: "3.0.3",
    info: {
      title: "Enterprise Fleet & Sensor Mesh API",
      version: "2.4.0",
    },
    servers: [{ url: "https://mesh.enterprise.internal/api/v2" }],
    components: {
      securitySchemes: {
        ApiKeyHeaderAuth: {
          type: "apiKey",
          in: "header",
          name: "X-Fleet-Token",
        },
      },
      parameters: {
        TenantParam: {
          name: "tenant-id",
          in: "header",
          required: true,
          schema: { type: "string" },
          description: "Tenant isolation header",
        },
        PageLimit: {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", default: 50 },
        },
      },
      schemas: {
        GeoLocation: {
          type: "object",
          required: ["latitude", "longitude"],
          properties: {
            latitude: { type: "number" },
            longitude: { type: "number" },
          },
        },
        TelemetryPayload: {
          type: "object",
          required: ["device_name", "location", "sensor_tags"],
          properties: {
            device_name: { type: "string" },
            location: { $ref: "#/components/schemas/GeoLocation" },
            sensor_tags: {
              type: "array",
              items: { type: "string" },
            },
            is_active: { type: "boolean" },
          },
        },
      },
    },
    paths: {
      "/regions/{region-id}/telemetry": {
        parameters: [
          {
            name: "region-id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          { $ref: "#/components/parameters/TenantParam" },
        ],
        get: {
          operationId: "query_telemetry",
          summary: "Query fleet telemetry logs with filter criteria",
          parameters: [
            { $ref: "#/components/parameters/PageLimit" },
            {
              name: "tag-filter",
              in: "query",
              required: false,
              schema: { type: "array" },
            },
          ],
        },
        post: {
          operationId: "ingest_telemetry",
          summary: "Ingest batch device telemetry data",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/TelemetryPayload",
                },
              },
            },
          },
        },
      },
    },
  };

  describe("License & Release Standards", () => {
    test("repository contains the full canonical Apache 2.0 license text with copyright", () => {
      const licensePath = join(process.cwd(), "LICENSE");
      const content = readFileSync(licensePath, "utf8");

      assert.ok(content.includes("Apache License"));
      assert.ok(content.includes("Version 2.0, January 2004"));
      assert.ok(content.includes("http://www.apache.org/licenses/"));
      assert.ok(content.includes("TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION"));
      assert.ok(content.includes("1. Definitions."));
      assert.ok(content.includes("2. Grant of Copyright License."));
      assert.ok(content.includes("3. Grant of Patent License."));
      assert.ok(content.includes("4. Redistribution."));
      assert.ok(content.includes("5. Submission of Contributions."));
      assert.ok(content.includes("6. Trademarks."));
      assert.ok(content.includes("7. Disclaimer of Warranty."));
      assert.ok(content.includes("8. Limitation of Liability."));
      assert.ok(content.includes("9. Accepting Warranty or Additional Liability."));
      assert.ok(
        content.includes("Copyright 2026 RitualDev Lab (https://github.com/RitualDev-Lab)"),
      );
      assert.ok(content.lines ? content.lines().length > 150 : content.split("\n").length > 150);
    });
  });

  describe("Full End-to-End TypeScript Compilation Guarantee", () => {
    test("converts enterprise OpenAPI schema and compiles generated TypeScript code cleanly with 0 errors", () => {
      const conversion = OpenApiToMcpConverter.convert({
        spec: richEnterpriseOpenApi,
        language: "typescript",
      });

      assert.strictEqual(conversion.tools.length, 2);

      // Verify custom API Key authentication scheme resolution
      const queryTool = conversion.tools.find((t) => t.name === "query_telemetry");
      assert.ok(queryTool);
      assert.strictEqual(queryTool.apiEndpoint?.authHeader?.name, "X-Fleet-Token");
      assert.strictEqual(queryTool.apiEndpoint?.authHeader?.prefix, "");

      // Verify parameter $ref resolution
      assert.ok(queryTool.parameters.some((p) => p.name === "tenant-id"));
      assert.ok(queryTool.parameters.some((p) => p.name === "limit"));

      // Verify generated code structure
      assert.ok(conversion.generatedCode.includes('["X-Fleet-Token"]: process.env.API_KEY'));

      // In-memory TypeScript compiler verification: must compile with 0 diagnostics
      const { errors } = verifyTypeScriptCompilation(conversion.generatedCode);
      assert.deepStrictEqual(
        errors,
        [],
        `TypeScript compiler reported diagnostics: ${errors.join("; ")}`,
      );
    });
  });

  describe("Full End-to-End Python AST Compilation Guarantee", () => {
    test("converts enterprise OpenAPI schema and compiles generated Python code with valid AST", () => {
      const conversion = OpenApiToMcpConverter.convert({
        spec: richEnterpriseOpenApi,
        language: "python",
      });

      assert.strictEqual(conversion.tools.length, 2);

      // Verify Python parameter formatting and safe mappings
      const ingestTool = conversion.tools.find((t) => t.name === "ingest_telemetry");
      assert.ok(ingestTool);
      assert.ok(conversion.generatedCode.includes("def ingest_telemetry("));
      assert.ok(
        conversion.generatedCode.includes("urllib.parse.urlencode(query_params, doseq=True)"),
      );
      assert.ok(conversion.generatedCode.includes('headers["X-Fleet-Token"] = str(api_key)'));

      const pythonCmd = getPythonCommand();
      if (!pythonCmd) {
        return; // Skip AST check if Python is not installed in the environment
      }

      const harness = `
class MockMcp:
    def tool(self):
        def decorator(f):
            return f
        return decorator

mcp = MockMcp()

${conversion.generatedCode}
`;

      const result = execFileSync(
        pythonCmd,
        ["-c", "import ast, sys; ast.parse(sys.stdin.read()); print('AST_PARSE_SUCCESS')"],
        { input: harness, encoding: "utf-8" },
      ).trim();

      assert.strictEqual(result, "AST_PARSE_SUCCESS");
    });
  });

  describe("Live End-to-End Tool Invocation with Mock API Parity", () => {
    let server: Server;
    let serverPort: number;
    let receivedRequest: {
      method?: string;
      url?: string;
      headers?: Record<string, string | string[] | undefined>;
      body?: string;
    } = {};

    test("executes generated tool against local HTTP server with path, query, headers and body intact", async () => {
      // Setup mock HTTP server
      await new Promise<void>((resolve) => {
        server = createServer((req, res) => {
          let reqData = "";
          req.on("data", (chunk) => {
            reqData += chunk;
          });
          req.on("end", () => {
            receivedRequest = {
              method: req.method,
              url: req.url,
              headers: req.headers,
              body: reqData,
            };
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "acknowledged", timestamp: 1729000000 }));
          });
        });

        server.listen(0, "127.0.0.1", () => {
          serverPort = (server.address() as AddressInfo).port;
          resolve();
        });
      });

      try {
        const specWithLocalServer = {
          ...richEnterpriseOpenApi,
          servers: [{ url: `http://127.0.0.1:${serverPort}/api/v2` }],
        };

        const conversion = OpenApiToMcpConverter.convert({
          spec: specWithLocalServer,
          language: "typescript",
        });

        // Test ingest_telemetry tool
        const ingestTool = conversion.tools.find((t) => t.name === "ingest_telemetry");
        assert.ok(ingestTool);

        const tmpDir = join(process.cwd(), ".tmp_test_e2e");
        if (!existsSync(tmpDir)) {
          mkdirSync(tmpDir, { recursive: true });
        }
        const tmpFile = join(tmpDir, `telemetry-${Date.now()}.mjs`);
        const transpiled = ts.transpileModule(conversion.generatedCode, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
          },
        }).outputText;
        writeFileSync(tmpFile, transpiled, "utf8");

        const originalApiKey = process.env.API_KEY;
        const originalBaseUrl = process.env.API_BASE_URL;
        process.env.API_BASE_URL = `http://127.0.0.1:${serverPort}/api/v2`;
        process.env.API_KEY = "secret-token-xyz-987";

        const testArgs = {
          "region-id": "us-east-1",
          "tenant-id": "tenant-acme-corp",
          device_name: "sensor-node-42",
          location: { latitude: 37.7749, longitude: -122.4194 },
          sensor_tags: ["vibration", "temperature"],
          is_active: true,
        };

        let result:
          | { content: Array<{ type: string; text: string }>; isError?: boolean }
          | undefined;
        try {
          const mod = await import(pathToFileURL(tmpFile).href);
          result = await mod.handleIngestTelemetry(testArgs);
        } finally {
          process.env.API_KEY = originalApiKey;
          process.env.API_BASE_URL = originalBaseUrl;
          if (existsSync(tmpDir)) {
            rmSync(tmpDir, { recursive: true, force: true });
          }
        }

        // Verify MCP tool execution response
        assert.strictEqual(result.isError, undefined);
        assert.ok(result.content[0].text.includes('"status": "acknowledged"'));

        // Verify live HTTP server received exact parameters, headers and body
        assert.strictEqual(receivedRequest.method, "POST");
        assert.strictEqual(receivedRequest.url, "/api/v2/regions/us-east-1/telemetry");
        assert.strictEqual(receivedRequest.headers?.["x-fleet-token"], "secret-token-xyz-987");
        assert.strictEqual(receivedRequest.headers?.["tenant-id"], "tenant-acme-corp");

        const receivedBody = JSON.parse(receivedRequest.body || "{}");
        assert.strictEqual(receivedBody.device_name, "sensor-node-42");
        assert.strictEqual(receivedBody.is_active, true);
        assert.deepStrictEqual(receivedBody.sensor_tags, ["vibration", "temperature"]);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });
});
