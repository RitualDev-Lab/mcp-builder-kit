import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe, after } from "node:test";
import { McpServerInspector } from "../src/inspector.js";

describe("Phase 3: Headless Mock Inspector & Protocol Conformance Suite", () => {
  const tmpDir = join(process.cwd(), ".tmp_test_inspector");

  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }

  // Create a minimal mock MCP server script over stdio
  const mockServerScript = join(tmpDir, "mock-mcp-server.js");
  const serverCode = `
import readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", (line) => {
  if (!line.trim()) return;
  try {
    const req = JSON.parse(line);
    const { id, method, params } = req;

    if (method === "initialize") {
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "mock-inspector-target", version: "1.0.0" },
          capabilities: { tools: {}, resources: {} },
        },
      }) + "\\n");
      return;
    }

    if (method === "tools/list") {
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "query_database",
              description: "Executes mock SQL queries",
              inputSchema: { type: "object", properties: { query: { type: "string" } } },
            },
          ],
        },
      }) + "\\n");
      return;
    }

    if (method === "resources/list") {
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0",
        id,
        result: {
          resources: [
            { uri: "mock://logs", name: "System Logs", mimeType: "text/plain" },
          ],
        },
      }) + "\\n");
      return;
    }

    if (method === "tools/call") {
      if (params.name === "__non_existent_tool_probe__") {
        process.stdout.write(JSON.stringify({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: "Method or tool not found" },
        }) + "\\n");
        return;
      }
    }

    process.stdout.write(JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code: -32600, message: "Invalid Request" },
    }) + "\\n");
  } catch (err) {
    // ignore
  }
});
`;

  writeFileSync(mockServerScript, serverCode, "utf8");

  after(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("connects to MCP server, negotiates handshake, and discovers tools and resources", async () => {
    const inspector = new McpServerInspector({
      command: "node",
      args: [mockServerScript],
      timeoutMs: 3000,
    });

    const report = await inspector.inspect();

    assert.ok(report);
    assert.strictEqual(report.protocolVersion, "2024-11-05");
    assert.strictEqual(report.serverInfo?.name, "mock-inspector-target");
    assert.strictEqual(report.serverInfo?.version, "1.0.0");
    assert.strictEqual(report.capabilities.tools, true);
    assert.strictEqual(report.capabilities.resources, true);

    // Verify tools discovered
    assert.strictEqual(report.discoveredTools.length, 1);
    assert.strictEqual(report.discoveredTools[0].name, "query_database");

    // Verify resources discovered
    assert.strictEqual(report.discoveredResources.length, 1);
    assert.strictEqual(report.discoveredResources[0].uri, "mock://logs");

    // Verify conformance checks
    const handshake = report.conformanceChecks.find((c) => c.name.includes("Handshake"));
    assert.ok(handshake?.passed, "Protocol Handshake check should pass");

    const toolDiscovery = report.conformanceChecks.find((c) => c.name.includes("Tool Discovery"));
    assert.ok(toolDiscovery?.passed, "Tool Discovery check should pass");

    const negTest = report.conformanceChecks.find((c) => c.name.includes("Negative Test"));
    assert.ok(negTest?.passed, "Negative Test check should pass");
  });
});
