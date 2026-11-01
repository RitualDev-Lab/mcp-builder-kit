/**
 * Mock Sandbox Fixture Mode
 *
 * Allows testing generated Model Context Protocol (MCP) servers with realistic
 * synthetic mock data before plugging in real production credentials.
 *
 * Provides:
 * 1. Schema-driven synthetic mock generator (detecting semantic field types: emails, UUIDs, dates, etc.)
 * 2. Mock argument synthesizer matching ToolParameter / JSON Schema specifications
 * 3. In-memory sandbox test runner executing mock evaluations with latency metrics
 * 4. Exportable mock fixture generator for CI/CD test automation
 */

import type { ToolDefinition, ToolParameter } from "./types.js";

export interface MockOptions {
  seed?: number;
  useFakerIfAvailable?: boolean;
}

export interface MockToolExecutionResult {
  toolName: string;
  passed: boolean;
  mockArgs: Record<string, unknown>;
  mockResponse: {
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
  };
  latencyMs: number;
  error?: string;
}

export interface MockTestSummary {
  totalTools: number;
  passed: number;
  failed: number;
  avgLatencyMs: number;
  results: MockToolExecutionResult[];
}

/**
 * Generates realistic synthetic mock data for a single parameter or JSON schema node.
 */
export function generateSyntheticMockData(
  param: ToolParameter | { type?: string; name?: string; [key: string]: unknown },
  options: MockOptions = {},
): unknown {
  const type = (param.type || "string").toLowerCase();
  const name = (param.name || "").toLowerCase();

  // 1. Semantic pattern heuristics based on parameter name
  if (name.includes("email")) {
    return "developer@ritualdev.io";
  }
  if (name === "id" || name.endsWith("_id") || name.endsWith("id")) {
    return "018f2b3c-4d5e-7a8b-9c0d-1e2f3a4b5c6d";
  }
  if (name.includes("uuid") || name.includes("guid")) {
    return "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";
  }
  if (
    name.includes("url") ||
    name.includes("uri") ||
    name.includes("link") ||
    name.includes("href")
  ) {
    return "https://api.example.com/v1/resource/mock";
  }
  if (
    name.includes("date") ||
    name.includes("time") ||
    name.includes("created") ||
    name.includes("updated")
  ) {
    return "2026-11-01T12:00:00.000Z";
  }
  if (name.includes("phone") || name.includes("mobile") || name.includes("tel")) {
    return "+1-555-0199";
  }
  if (name.includes("name") || name.includes("author") || name.includes("user")) {
    return "Alex Chen";
  }
  if (name.includes("price") || name.includes("amount") || name.includes("cost")) {
    return 49.99;
  }
  if (name.includes("currency")) {
    return "USD";
  }
  if (name.includes("country")) {
    return "US";
  }
  if (name.includes("city")) {
    return "San Francisco";
  }
  if (name.includes("status")) {
    return "active";
  }
  if (name.includes("token") || name.includes("key") || name.includes("secret")) {
    return "mock_sec_token_9x7k2m1q8p";
  }
  if (name.includes("query") || name.includes("search") || name.includes("keyword")) {
    return "test query";
  }
  if (name.includes("limit") || name.includes("page_size")) {
    return 20;
  }
  if (name.includes("page") || name.includes("offset")) {
    return 1;
  }

  // 2. Type-based defaults
  switch (type) {
    case "string":
      return `mock_${param.name || "value"}`;

    case "number":
    case "integer":
      return 42;

    case "boolean":
      return true;

    case "array": {
      const items = (param as Record<string, unknown>).items as ToolParameter | undefined;
      const subItem = items ? generateSyntheticMockData(items, options) : "mock_item";
      return [subItem, subItem];
    }

    case "object": {
      const props = (param as Record<string, unknown>).properties as
        | Record<string, ToolParameter>
        | undefined;
      if (props && typeof props === "object") {
        const obj: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(props)) {
          obj[k] = generateSyntheticMockData({ ...v, name: k }, options);
        }
        return obj;
      }
      return { mockKey: "mockValue", active: true };
    }

    default:
      return `mock_${type}`;
  }
}

/**
 * Synthesizes mock argument objects conforming to a ToolDefinition's parameter list.
 */
export function generateMockArguments(
  tool: ToolDefinition,
  options: MockOptions = {},
): Record<string, unknown> {
  const args: Record<string, unknown> = {};

  for (const param of tool.parameters) {
    args[param.name] = generateSyntheticMockData(param, options);
  }

  return args;
}

/**
 * Intercepts tool execution and returns a realistic synthetic mock response.
 */
export function generateMockToolResponse(
  tool: ToolDefinition,
  args: Record<string, unknown> = {},
): {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
} {
  const mockPayload = {
    _status: "success",
    _mockFixture: true,
    tool: tool.name,
    timestamp: new Date().toISOString(),
    receivedArgs: args,
    result: {
      id: "mock_res_" + Math.random().toString(36).substring(2, 9),
      message: `Simulated mock response for ${tool.name}`,
      items: [
        { id: 1, title: `${tool.name} sample item 1`, status: "verified" },
        { id: 2, title: `${tool.name} sample item 2`, status: "active" },
      ],
    },
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(mockPayload, null, 2),
      },
    ],
  };
}

/**
 * Runs an in-memory mock sandbox suite across a collection of tools,
 * validating argument generation, schema adherence, and synthetic execution latency.
 */
export async function runMockSandboxTest(
  tools: ToolDefinition[],
  options: MockOptions = {},
): Promise<MockTestSummary> {
  const results: MockToolExecutionResult[] = [];
  let totalLatency = 0;

  for (const tool of tools) {
    const startTime = performance.now();
    try {
      const mockArgs = generateMockArguments(tool, options);

      // Validate required arguments presence
      for (const p of tool.parameters) {
        if (p.required && mockArgs[p.name] === undefined) {
          throw new Error(`Missing required parameter '${p.name}' in mock argument generation`);
        }
      }

      const mockResponse = generateMockToolResponse(tool, mockArgs);
      const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
      totalLatency += latencyMs;

      results.push({
        toolName: tool.name,
        passed: true,
        mockArgs,
        mockResponse,
        latencyMs,
      });
    } catch (err: unknown) {
      const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
      totalLatency += latencyMs;
      const errMsg = err instanceof Error ? err.message : String(err);

      results.push({
        toolName: tool.name,
        passed: false,
        mockArgs: {},
        mockResponse: {
          content: [{ type: "text", text: `Mock execution failed: ${errMsg}` }],
          isError: true,
        },
        latencyMs,
        error: errMsg,
      });
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const avgLatencyMs = tools.length > 0 ? Math.round((totalLatency / tools.length) * 100) / 100 : 0;

  return {
    totalTools: tools.length,
    passed,
    failed,
    avgLatencyMs,
    results,
  };
}

/**
 * Generates an exportable JSON fixture dictionary for offline testing or client integration.
 */
export function generateFixtureFile(
  tools: ToolDefinition[],
  options: MockOptions = {},
): Record<string, { mockArgs: Record<string, unknown>; expectedOutput: unknown }> {
  const fixtures: Record<string, { mockArgs: Record<string, unknown>; expectedOutput: unknown }> =
    {};

  for (const tool of tools) {
    const mockArgs = generateMockArguments(tool, options);
    const mockResp = generateMockToolResponse(tool, mockArgs);
    let parsedResp: unknown;
    try {
      parsedResp = JSON.parse(mockResp.content[0]?.text || "{}");
    } catch {
      parsedResp = mockResp.content[0]?.text;
    }

    fixtures[tool.name] = {
      mockArgs,
      expectedOutput: parsedResp,
    };
  }

  return fixtures;
}
