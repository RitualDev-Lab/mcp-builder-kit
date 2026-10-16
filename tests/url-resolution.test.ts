import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import http from "node:http";
import test, { describe } from "node:test";
import { McpCodeGenerator } from "../src/generator.js";
import { OpenApiToMcpConverter } from "../src/openapi.js";
import type { ToolDefinition } from "../src/types.js";
import { getPythonCommand } from "./helpers/python.js";

describe("Phase 3: Uniform Base URL Path Resolution & Path Parameter Encoding Suite (M3)", () => {
  describe("TypeScript Base Path Preservation (No /v1 Dropping)", () => {
    const sampleTool: ToolDefinition = {
      name: "get_pet",
      description: "Gets pet by id",
      parameters: [
        { name: "pet_id", type: "string", required: true },
        { name: "filter", type: "string", required: false },
      ],
      apiEndpoint: {
        path: "/pets/{pet_id}",
        method: "GET",
        pathParams: ["pet_id"],
        queryParams: ["filter"],
        hasBody: false,
      },
    };

    test("generates safe URL resolution preserving base URL path prefixes and trailing slashes", () => {
      const tsCode = McpCodeGenerator.generateTypeScriptTool(sampleTool);

      // Verify the generated code constructs URL using cleanBasePath and cleanRequestPath
      assert.ok(tsCode.includes('const cleanBasePath = BASE_URL.replace(/\\/+$/, "");'));
      assert.ok(tsCode.includes('const cleanRequestPath = requestPath.replace(/^\\/+/, "");'));
      assert.ok(
        tsCode.includes(
          "const fullUrl = cleanRequestPath ? `${cleanBasePath}/${cleanRequestPath}` : cleanBasePath;",
        ),
      );
      assert.ok(tsCode.includes("const url = new URL(fullUrl);"));
      assert.ok(
        tsCode.includes(
          'requestPath.replaceAll("{pet_id}", encodeURIComponent(String(args["pet_id"] ?? "")))',
        ),
      );
    });

    test("evaluates URL resolution accurately for multiple base URL variations", () => {
      const resolveUrl = (baseUrl: string, requestPath: string): string => {
        const cleanBasePath = baseUrl.replace(/\/+$/, "");
        const cleanRequestPath = requestPath.replace(/^\/+/, "");
        const fullUrl = cleanRequestPath ? `${cleanBasePath}/${cleanRequestPath}` : cleanBasePath;
        return new URL(fullUrl).toString();
      };

      // 1. Base URL with subpath prefix and leading slash operation path
      assert.strictEqual(
        resolveUrl("https://api.example.com/v1", "/pets"),
        "https://api.example.com/v1/pets",
      );

      // 2. Base URL with subpath prefix and trailing slash
      assert.strictEqual(
        resolveUrl("https://api.example.com/v1/", "/pets"),
        "https://api.example.com/v1/pets",
      );

      // 3. Multi-segment subpath prefix
      assert.strictEqual(
        resolveUrl("https://api.example.com/api/v2.1/", "/users/profile"),
        "https://api.example.com/api/v2.1/users/profile",
      );

      // 4. Root base URL with trailing slash
      assert.strictEqual(
        resolveUrl("https://api.example.com/", "/pets"),
        "https://api.example.com/pets",
      );

      // 5. Root base URL without trailing slash
      assert.strictEqual(
        resolveUrl("https://api.example.com", "/pets"),
        "https://api.example.com/pets",
      );

      // 6. Request path without leading slash
      assert.strictEqual(
        resolveUrl("https://api.example.com/v1", "pets"),
        "https://api.example.com/v1/pets",
      );
    });
  });

  describe("Python Base Path Parity & safe='' Path Encoding", () => {
    const sampleTool: ToolDefinition = {
      name: "get_category_item",
      description: "Gets category item by category and item name",
      parameters: [
        { name: "category", type: "string", required: true },
        { name: "item_id", type: "string", required: true },
      ],
      apiEndpoint: {
        path: "/categories/{category}/items/{item_id}",
        method: "GET",
        pathParams: ["category", "item_id"],
        hasBody: false,
      },
    };

    test("generates uniform clean_base and clean_path with safe='' encoding in Python", () => {
      const pyCode = McpCodeGenerator.generatePythonTool(sampleTool);

      assert.ok(pyCode.includes('clean_base = BASE_URL.rstrip("/")'));
      assert.ok(pyCode.includes('clean_path = endpoint_path.lstrip("/")'));
      assert.ok(
        pyCode.includes('full_url = f"{clean_base}/{clean_path}" if clean_path else clean_base'),
      );
      assert.ok(
        pyCode.includes(
          'endpoint_path = endpoint_path.replace("{category}", urllib.parse.quote(str(category) if category is not None else "", safe=""))',
        ),
      );
      assert.ok(
        pyCode.includes(
          'endpoint_path = endpoint_path.replace("{item_id}", urllib.parse.quote(str(item_id) if item_id is not None else "", safe=""))',
        ),
      );
    });

    test("compiles generated Python tool with uniform URL handling cleanly via AST", () => {
      const pyCode = McpCodeGenerator.generatePythonTool(sampleTool);

      const harness = `
class MockMcp:
    def tool(self):
        def decorator(f):
            return f
        return decorator

mcp = MockMcp()
BASE_URL = "https://api.example.com/v1"

${pyCode}
`;

      const pythonCmd = getPythonCommand();
      if (!pythonCmd) return;

      const result = execFileSync(
        pythonCmd,
        ["-c", "import ast, sys; ast.parse(sys.stdin.read()); print('URL_PARITY_AST_OK')"],
        { input: harness, encoding: "utf-8" },
      ).trim();

      assert.strictEqual(result, "URL_PARITY_AST_OK");
    });
  });

  describe("Live Local HTTP Service Parity Verification", () => {
    test("HTTP service receives requests with subpath prefix and encoded path segments intact", async () => {
      let requestedUrl = "";

      const server = http.createServer((req, res) => {
        requestedUrl = req.url || "";
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
      });

      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
      const address = server.address() as { port: number };
      const localBaseUrl = `http://127.0.0.1:${address.port}/v1`;

      try {
        const testTool: ToolDefinition = {
          name: "get_tagged_resource",
          description: "Gets tagged resource",
          parameters: [
            { name: "tag_name", type: "string", required: true },
            { name: "limit", type: "number", required: false },
          ],
          apiEndpoint: {
            path: "/tags/{tag_name}/resources",
            method: "GET",
            pathParams: ["tag_name"],
            queryParams: ["limit"],
            hasBody: false,
          },
        };

        // Simulate generated client execution with subpath BASE_URL
        const BASE_URL = localBaseUrl;
        let requestPath = testTool.apiEndpoint?.path || "";
        const args = {
          tag_name: "release/v1.0",
          limit: 25,
        };

        requestPath = requestPath.replaceAll(
          "{tag_name}",
          encodeURIComponent(String(args.tag_name ?? "")),
        );

        const cleanBasePath = BASE_URL.replace(/\/+$/, "");
        const cleanRequestPath = requestPath.replace(/^\/+/, "");
        const fullUrl = cleanRequestPath ? `${cleanBasePath}/${cleanRequestPath}` : cleanBasePath;
        const url = new URL(fullUrl);

        if (args.limit !== undefined) {
          url.searchParams.set("limit", String(args.limit));
        }

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        assert.strictEqual(response.status, 200);
        // CRITICAL CHECK: /v1 was NOT dropped, and 'release/v1.0' was encoded as 'release%2Fv1.0'
        assert.strictEqual(requestedUrl, "/v1/tags/release%2Fv1.0/resources?limit=25");
      } finally {
        server.close();
      }
    });
  });
});
