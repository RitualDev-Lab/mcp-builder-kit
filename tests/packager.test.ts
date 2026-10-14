import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import test, { describe, after } from "node:test";
import { McpServerPackager } from "../src/packager.js";

describe("Phase 5: 1-Click Packaging, Dockerization & Directory Publishing Suite", () => {
  const tmpPkgDir = join(process.cwd(), ".tmp_test_packaging");

  after(() => {
    if (existsSync(tmpPkgDir)) {
      rmSync(tmpPkgDir, { recursive: true, force: true });
    }
  });

  test("generates production Dockerfile, client configs, and registry manifest for TypeScript", () => {
    const result = McpServerPackager.package({
      serverName: "weather-mcp",
      targetDir: tmpPkgDir,
      language: "typescript",
      port: 9000,
      envVars: ["OPENWEATHER_API_KEY"],
    });

    assert.ok(result);
    assert.strictEqual(result.writtenFiles.length, 3);
    assert.ok(result.writtenFiles.includes("Dockerfile"));
    assert.ok(result.writtenFiles.includes("mcp.json"));
    assert.ok(result.writtenFiles.includes("claude_desktop_config.json"));

    // Verify Dockerfile contents
    const dockerfileContent = readFileSync(join(tmpPkgDir, "Dockerfile"), "utf8");
    assert.ok(dockerfileContent.includes("FROM node:22-alpine AS builder"));
    assert.ok(dockerfileContent.includes("EXPOSE 9000"));

    // Verify Claude Desktop config
    const claudeContent = JSON.parse(
      readFileSync(join(tmpPkgDir, "claude_desktop_config.json"), "utf8"),
    );
    assert.ok(claudeContent.mcpServers["weather-mcp"]);
    assert.strictEqual(claudeContent.mcpServers["weather-mcp"].command, "node");
    assert.ok(claudeContent.mcpServers["weather-mcp"].env.OPENWEATHER_API_KEY);

    // Verify MCP registry manifest
    const manifestContent = JSON.parse(readFileSync(join(tmpPkgDir, "mcp.json"), "utf8"));
    assert.strictEqual(manifestContent.name, "weather-mcp");
    assert.strictEqual(manifestContent.publisher, "RitualDev-Lab");
  });

  test("generates production Dockerfile and FastMCP config for Python", () => {
    const pyDir = join(tmpPkgDir, "py_server");
    const result = McpServerPackager.package({
      serverName: "python-rag-mcp",
      targetDir: pyDir,
      language: "python",
      port: 8080,
    });

    assert.ok(result);
    assert.ok(result.dockerfile.includes("FROM python:3.11-slim"));
    assert.ok(result.dockerfile.includes('CMD ["python", "-m", "python_rag_mcp.server"]'));

    const claude = result.claudeDesktopConfig as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    assert.strictEqual(claude.mcpServers["python-rag-mcp"].command, "python");
    assert.ok(claude.mcpServers["python-rag-mcp"].args.includes("python_rag_mcp.server"));
  });
});
