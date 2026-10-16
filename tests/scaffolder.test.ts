import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import test, { describe, after } from "node:test";
import { McpProjectScaffolder } from "../src/scaffolder.js";

describe("Phase 1: MCP Server Scaffolder & Starter Blueprints Suite", () => {
  const testOutputDir = join(process.cwd(), ".tmp_test_output");

  after(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  test("scaffolds a complete TypeScript MCP server project", () => {
    const targetDir = join(testOutputDir, "sample-ts-mcp");
    const result = McpProjectScaffolder.scaffold({
      projectName: "sample-ts-mcp",
      targetDir,
      language: "typescript",
      transport: "stdio",
      description: "Sample TypeScript MCP server",
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.language, "typescript");
    assert.ok(result.filesCreated.includes("package.json"));
    assert.ok(result.filesCreated.includes("src/index.ts"));
    assert.ok(result.filesCreated.includes("tests/index.test.ts"));
    assert.ok(result.filesCreated.includes("README.md"));

    assert.ok(existsSync(join(targetDir, "package.json")));
    assert.ok(existsSync(join(targetDir, "src/index.ts")));
  });

  test("scaffolds a complete Python FastMCP server project", () => {
    const targetDir = join(testOutputDir, "sample-py-mcp");
    const result = McpProjectScaffolder.scaffold({
      projectName: "sample-py-mcp",
      targetDir,
      language: "python",
      transport: "stdio",
      description: "Sample Python FastMCP server",
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.language, "python");
    assert.ok(result.filesCreated.includes("pyproject.toml"));
    assert.ok(result.filesCreated.includes("sample_py_mcp/server.py"));
    assert.ok(result.filesCreated.includes("tests/test_server.py"));

    assert.ok(existsSync(join(targetDir, "pyproject.toml")));
    assert.ok(existsSync(join(targetDir, "sample_py_mcp/server.py")));
  });

  test("refuses to overwrite existing files without force flag", () => {
    const targetDir = join(testOutputDir, "sample-ts-mcp");
    // Already scaffolded from earlier test

    assert.throws(() => {
      McpProjectScaffolder.scaffold({
        projectName: "sample-ts-mcp",
        targetDir,
        language: "typescript",
        transport: "stdio",
      });
    }, /Scaffolding aborted: target directory .* already contains existing files/);
  });

  test("successfully overwrites when force flag is set to true", () => {
    const targetDir = join(testOutputDir, "sample-ts-mcp");

    const result = McpProjectScaffolder.scaffold({
      projectName: "sample-ts-mcp",
      targetDir,
      language: "typescript",
      transport: "stdio",
      force: true,
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.filesCreated.length > 0);
  });
});
