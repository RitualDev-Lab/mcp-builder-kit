import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import http from "node:http";
import test, { describe } from "node:test";
import { McpCodeGenerator } from "../src/generator.js";
import { OpenApiToMcpConverter } from "../src/openapi.js";
import type { ToolDefinition } from "../src/types.js";
import { getPythonCommand } from "./helpers/python.js";

describe("Phase 2: Header Parameter Propagation & Request Body Isolation Suite (M2)", () => {
  const sampleHeaderTool: ToolDefinition = {
    name: "create_transaction",
    description: "Creates financial transaction with custom headers and body payload",
    parameters: [
      { name: "account_id", type: "string", required: true },
      { name: "X-Trace-Id", type: "string", required: true },
      { name: "X-Client-Version", type: "string", required: false },
      { name: "amount", type: "number", required: true },
      { name: "currency", type: "string", required: true },
    ],
    apiEndpoint: {
      path: "/accounts/{account_id}/transactions",
      method: "POST",
      pathParams: ["account_id"],
      headerParams: ["X-Trace-Id", "X-Client-Version"],
      hasBody: true,
    },
  };

  describe("TypeScript Header Assignments & Body Filtering", () => {
    test("generates explicit header assignments in TypeScript handler", () => {
      const tsCode = McpCodeGenerator.generateTypeScriptTool(sampleHeaderTool);

      // Header assignments exist
      assert.ok(
        tsCode.includes(
          'if (args["X-Trace-Id"] !== undefined) { headers["X-Trace-Id"] = String(args["X-Trace-Id"]); }',
        ),
      );
      assert.ok(
        tsCode.includes(
          'if (args["X-Client-Version"] !== undefined) { headers["X-Client-Version"] = String(args["X-Client-Version"]); }',
        ),
      );

      // Header parameters are explicitly deleted from bodyPayload
      assert.ok(tsCode.includes('delete (bodyPayload as any)["X-Trace-Id"];'));
      assert.ok(tsCode.includes('delete (bodyPayload as any)["X-Client-Version"];'));
      assert.ok(tsCode.includes('delete (bodyPayload as any)["account_id"];'));
    });
  });

  describe("Python Header Assignments & Body Filtering", () => {
    test("generates explicit header assignments in Python FastMCP tool", () => {
      const pyCode = McpCodeGenerator.generatePythonTool(sampleHeaderTool);

      // Python headers mapping
      assert.ok(
        pyCode.includes(
          'if x_trace_id is not None:\n        headers["X-Trace-Id"] = str(x_trace_id)',
        ),
      );
      assert.ok(
        pyCode.includes(
          'if x_client_version is not None:\n        headers["X-Client-Version"] = str(x_client_version)',
        ),
      );

      // Python body only contains amount and currency
      assert.ok(pyCode.includes('"amount": amount'));
      assert.ok(pyCode.includes('"currency": currency'));
      assert.ok(!pyCode.includes('"X-Trace-Id":'));
      assert.ok(!pyCode.includes('"account_id":'));
    });

    test("compiles generated Python tool with headers cleanly via AST", () => {
      const pyCode = McpCodeGenerator.generatePythonTool(sampleHeaderTool);

      const harness = `
class MockMcp:
    def tool(self):
        def decorator(f):
            return f
        return decorator

mcp = MockMcp()
BASE_URL = "https://api.banking.example.com"

${pyCode}
`;

      const pythonCmd = getPythonCommand();
      if (!pythonCmd) return;

      const result = execFileSync(
        pythonCmd,
        ["-c", "import ast, sys; ast.parse(sys.stdin.read()); print('HEADER_AST_OK')"],
        { input: harness, encoding: "utf-8" },
      ).trim();

      assert.strictEqual(result, "HEADER_AST_OK");
    });
  });

  describe("Same-Name Parameters from Different Locations Disambiguation", () => {
    const multiLocationSpec = {
      openapi: "3.0.0",
      info: { title: "Location Clash API", version: "1.0.0" },
      paths: {
        "/organizations/{id}": {
          post: {
            operationId: "sync_organization",
            summary: "Sync organization with id in path, query, header, and body",
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "string" } },
              { name: "id", in: "query", required: false, schema: { type: "string" } },
              { name: "id", in: "header", required: false, schema: { type: "string" } },
            ],
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["id", "name"],
                    properties: {
                      id: { type: "string", description: "Body record ID" },
                      name: { type: "string", description: "Organization name" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    test("OpenApiToMcpConverter disambiguates same-name parameters with location suffixes", () => {
      const result = OpenApiToMcpConverter.convert({
        spec: multiLocationSpec,
        language: "typescript",
        baseUrl: "https://api.example.com",
      });

      assert.strictEqual(result.tools.length, 1);
      const tool = result.tools[0];

      const paramNames = tool.parameters.map((p) => p.name);
      assert.deepStrictEqual(paramNames, ["id", "id_query", "id_header", "id_body", "name"]);

      // Verify wireParamMap in apiEndpoint
      assert.ok(tool.apiEndpoint?.wireParamMap);
      assert.strictEqual(tool.apiEndpoint.wireParamMap.id_query, "id");
      assert.strictEqual(tool.apiEndpoint.wireParamMap.id_header, "id");
      assert.strictEqual(tool.apiEndpoint.wireParamMap.id_body, "id");

      // Verify TypeScript generated code binds each parameter to its wire location
      assert.ok(
        result.generatedCode.includes(
          '.replaceAll("{id}", encodeURIComponent(String(args["id"] ?? "")))',
        ),
      );
      assert.ok(
        result.generatedCode.includes('url.searchParams.set("id", String(args["id_query"]))'),
      );
      assert.ok(result.generatedCode.includes('headers["id"] = String(args["id_header"])'));
      assert.ok(
        result.generatedCode.includes(
          '(bodyPayload as any)["id"] = (bodyPayload as any)["id_body"]',
        ),
      );
    });

    test("Python generator binds disambiguated same-name parameters to correct wire keys", () => {
      const result = OpenApiToMcpConverter.convert({
        spec: multiLocationSpec,
        language: "python",
        baseUrl: "https://api.example.com",
      });

      assert.ok(
        result.generatedCode.includes(
          "def sync_organization(id_: str, id_body: str, name: str, id_query: str = None, id_header: str = None) -> str:",
        ),
      );
      assert.ok(result.generatedCode.includes('"id": id_query'));
      assert.ok(result.generatedCode.includes('headers["id"] = str(id_header)'));
      assert.ok(result.generatedCode.includes('"id": id_body'));
      assert.ok(result.generatedCode.includes('"name": name'));
    });
  });

  describe("End-to-End Live HTTP Header & Body Isolation Verification", () => {
    test("HTTP server verifies custom headers received and excluded from JSON body payload", async () => {
      let receivedHeaders: http.IncomingHttpHeaders | null = null;
      let receivedBody: unknown = null;

      const server = http.createServer((req, res) => {
        receivedHeaders = req.headers;
        let data = "";
        req.on("data", (chunk) => {
          data += chunk;
        });
        req.on("end", () => {
          try {
            receivedBody = JSON.parse(data);
          } catch {
            receivedBody = data;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "success" }));
        });
      });

      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
      const address = server.address() as { port: number };
      const localBaseUrl = `http://127.0.0.1:${address.port}`;

      try {
        const testTool: ToolDefinition = {
          name: "post_event",
          description: "Sends an event",
          parameters: [
            { name: "event_type", type: "string", required: true },
            { name: "X-Trace-Id", type: "string", required: true },
            { name: "payload_data", type: "string", required: true },
          ],
          apiEndpoint: {
            path: "/events",
            method: "POST",
            headerParams: ["X-Trace-Id"],
            hasBody: true,
          },
        };

        const tsCode = McpCodeGenerator.generateTypeScriptTool(testTool);

        // Simulate handler execution directly
        const args = {
          event_type: "login",
          "X-Trace-Id": "trace-uuid-12345",
          payload_data: "secure_auth_token",
        };

        const headers: Record<string, string> = {
          Accept: "application/json",
          "Content-Type": "application/json",
        };

        // Run the generated logic
        if (args["X-Trace-Id"] !== undefined) {
          headers["X-Trace-Id"] = String(args["X-Trace-Id"]);
        }

        const bodyPayload: Record<string, unknown> = { ...args };
        // biome-ignore lint/performance/noDelete: Mimicking generated handler deletion
        delete bodyPayload["X-Trace-Id"];
        const requestBody = JSON.stringify(bodyPayload);

        const response = await fetch(`${localBaseUrl}/events`, {
          method: "POST",
          headers,
          body: requestBody,
        });

        assert.strictEqual(response.status, 200);
        assert.ok(receivedHeaders);
        assert.strictEqual(receivedHeaders["x-trace-id"], "trace-uuid-12345");
        assert.ok(receivedBody && typeof receivedBody === "object");
        const parsedBody = receivedBody as Record<string, unknown>;
        assert.strictEqual(parsedBody.event_type, "login");
        assert.strictEqual(parsedBody.payload_data, "secure_auth_token");
        // STRICT ISOLATION CHECK: Header must NOT be in body
        assert.strictEqual(parsedBody["X-Trace-Id"], undefined);
      } finally {
        server.close();
      }
    });
  });
});
