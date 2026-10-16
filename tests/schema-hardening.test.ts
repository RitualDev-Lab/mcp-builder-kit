import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test, { describe } from "node:test";
import { McpCodeGenerator } from "../src/generator.js";
import { OpenApiToMcpConverter } from "../src/openapi.js";
import type { ToolDefinition } from "../src/types.js";
import { getPythonCommand } from "./helpers/python.js";

describe("Phase 4: Python Argument Ordering & Schema Hardening Suite (M4)", () => {
  describe("Python Argument Ordering Guarantee (M4)", () => {
    const alternatingTool: ToolDefinition = {
      name: "process_order",
      description: "Processes an order with alternating optional and required parameters",
      parameters: [
        { name: "coupon_code", type: "string", required: false },
        { name: "order_id", type: "string", required: true },
        { name: "delivery_notes", type: "string", required: false },
        { name: "customer_id", type: "string", required: true },
        { name: "gift_wrap", type: "boolean", required: false },
        { name: "item_count", type: "number", required: true },
      ],
      apiEndpoint: {
        path: "/orders/{order_id}",
        method: "POST",
        pathParams: ["order_id"],
        queryParams: ["coupon_code", "gift_wrap"],
        hasBody: true,
      },
    };

    test("orders all required arguments before optional arguments in Python function signature", () => {
      const pyCode = McpCodeGenerator.generatePythonTool(alternatingTool);

      // Verify function definition signature
      assert.ok(
        pyCode.includes(
          "def process_order(order_id: str, customer_id: str, item_count: float, coupon_code: str = None, delivery_notes: str = None, gift_wrap: bool = None) -> str:",
        ),
      );
    });

    test("compiles alternating parameter Python signature without syntax errors via AST", () => {
      const pyCode = McpCodeGenerator.generatePythonTool(alternatingTool);

      const harness = `
class MockMcp:
    def tool(self):
        def decorator(f):
            return f
        return decorator

mcp = MockMcp()
BASE_URL = "https://api.store.example.com"

${pyCode}
`;

      const pythonCmd = getPythonCommand();
      if (!pythonCmd) return;

      const result = execFileSync(
        pythonCmd,
        ["-c", "import ast, sys; ast.parse(sys.stdin.read()); print('M4_SYNTAX_PERFECT')"],
        { input: harness, encoding: "utf-8" },
      ).trim();

      assert.strictEqual(result, "M4_SYNTAX_PERFECT");
    });
  });

  describe("Schema Hardening: $ref Circular Cycle Detection", () => {
    test("detects and breaks self-referential $ref cycles cleanly without stack overflow", () => {
      const selfReferentialSpec: Record<string, unknown> = {
        components: {
          schemas: {
            TreeNode: {
              type: "object",
              properties: {
                value: { type: "string" },
                parent: { $ref: "#/components/schemas/TreeNode" },
              },
            },
          },
        },
      };

      const resolved = OpenApiToMcpConverter.resolveSchema(
        { $ref: "#/components/schemas/TreeNode" },
        selfReferentialSpec,
      );

      assert.strictEqual(resolved.type, "object");
      assert.ok(resolved.properties);
      const props = resolved.properties as Record<string, unknown>;
      assert.ok(props.value);
    });

    test("detects and breaks mutual circular reference loops (A -> B -> A)", () => {
      const mutualCircularSpec: Record<string, unknown> = {
        components: {
          schemas: {
            User: {
              type: "object",
              properties: {
                id: { type: "string" },
                profile: { $ref: "#/components/schemas/Profile" },
              },
            },
            Profile: {
              type: "object",
              properties: {
                bio: { type: "string" },
                owner: { $ref: "#/components/schemas/User" },
              },
            },
          },
        },
      };

      const resolvedUser = OpenApiToMcpConverter.resolveSchema(
        { $ref: "#/components/schemas/User" },
        mutualCircularSpec,
      );

      assert.strictEqual(resolvedUser.type, "object");
      assert.ok(resolvedUser.properties);
    });
  });

  describe("Schema Hardening: allOf Composition Support", () => {
    test("merges allOf subschemas, combining properties and required fields", () => {
      const rootSpec: Record<string, unknown> = {
        components: {
          schemas: {
            BaseEntity: {
              type: "object",
              required: ["id", "created_at"],
              properties: {
                id: { type: "string" },
                created_at: { type: "string" },
              },
            },
          },
        },
      };

      const composedSchema = {
        allOf: [
          { $ref: "#/components/schemas/BaseEntity" },
          {
            type: "object",
            required: ["title"],
            properties: {
              title: { type: "string" },
              description: { type: "string" },
            },
          },
        ],
      };

      const resolved = OpenApiToMcpConverter.resolveSchema(composedSchema, rootSpec);
      assert.strictEqual(resolved.type, "object");

      const props = resolved.properties as Record<string, unknown>;
      assert.ok(props.id);
      assert.ok(props.created_at);
      assert.ok(props.title);
      assert.ok(props.description);

      const requiredList = resolved.required as string[];
      assert.ok(requiredList.includes("id"));
      assert.ok(requiredList.includes("created_at"));
      assert.ok(requiredList.includes("title"));
    });
  });

  describe("Path-Item Level Parameter Inheritance", () => {
    test("inherits common parameters defined at path-item level into all sub-operations", () => {
      const spec = {
        openapi: "3.0.0",
        info: { title: "Projects API", version: "1.0.0" },
        paths: {
          "/projects/{projectId}/tasks": {
            parameters: [
              {
                name: "projectId",
                in: "path",
                required: true,
                description: "Unique project identifier",
                schema: { type: "string" },
              },
            ],
            get: {
              operationId: "list_tasks",
              summary: "List all tasks in project",
              parameters: [
                { name: "status", in: "query", schema: { type: "string" }, required: false },
              ],
            },
            post: {
              operationId: "create_task",
              summary: "Create a new task in project",
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["title"],
                      properties: {
                        title: { type: "string" },
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
        spec,
        language: "typescript",
        baseUrl: "https://api.pm.example.com/v1",
      });

      assert.strictEqual(conversion.tools.length, 2);

      const listTasks = conversion.tools.find((t) => t.name === "list_tasks");
      assert.ok(listTasks);
      // Confirms projectId was inherited from path item level
      const listParams = listTasks.parameters.map((p) => p.name);
      assert.ok(listParams.includes("projectId"));
      assert.ok(listParams.includes("status"));
      assert.ok(listTasks.apiEndpoint?.pathParams?.includes("projectId"));

      const createTask = conversion.tools.find((t) => t.name === "create_task");
      assert.ok(createTask);
      // Confirms projectId was inherited in POST operation as well
      const createParams = createTask.parameters.map((p) => p.name);
      assert.ok(createParams.includes("projectId"));
      assert.ok(createParams.includes("title"));
      assert.ok(createTask.apiEndpoint?.pathParams?.includes("projectId"));

      // Verify generated TypeScript handler properly replaces the inherited path param
      assert.ok(
        conversion.generatedCode.includes(
          '.replaceAll("{projectId}", encodeURIComponent(String(args["projectId"] ?? "")))',
        ),
      );
    });

    test("allows operation-level parameter to override path-level parameter with same name", () => {
      const spec = {
        openapi: "3.0.0",
        info: { title: "Override API", version: "1.0.0" },
        paths: {
          "/items/{itemId}": {
            parameters: [
              {
                name: "itemId",
                in: "path",
                required: true,
                description: "Path-level description",
                schema: { type: "string" },
              },
            ],
            get: {
              operationId: "get_item",
              parameters: [
                {
                  name: "itemId",
                  in: "path",
                  required: true,
                  description: "Operation-level description override",
                  schema: { type: "string" },
                },
              ],
            },
          },
        },
      };

      const conversion = OpenApiToMcpConverter.convert({
        spec,
        language: "typescript",
      });

      const tool = conversion.tools[0];
      const param = tool.parameters.find((p) => p.name === "itemId");
      assert.ok(param);
      assert.strictEqual(param.description, "Operation-level description override");
    });
  });
});
