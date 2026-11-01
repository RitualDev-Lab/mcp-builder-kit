import assert from "node:assert";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { DevShelfExporter } from "../src/devshelf-export.js";

describe("Direct DevShelf Catalog Export Suite", () => {
  const tmpBase = join(process.cwd(), "tmp-test-devshelf-export");

  it("creates a compliant DevShelf catalog entry conforming to schema", () => {
    const item = DevShelfExporter.createCatalogItem({
      serverName: "ritual-snowflake-mcp",
      description: "Enterprise Snowflake MCP connector for autonomous SQL analytics",
      category: "Databases & Data Warehouses",
      language: "TypeScript / Node.js",
      tags: ["Snowflake", "Data Warehouse", "SQL"],
    });

    assert.strictEqual(item.name, "ritual-snowflake-mcp");
    assert.strictEqual(item.category, "Databases & Data Warehouses");
    assert.strictEqual(item.repo, "https://github.com/RitualDev-Lab/ritual-snowflake-mcp");
    assert.strictEqual(item.license, "Apache-2.0");
    assert.ok(item.statusTags.includes("MCP Server"));
    assert.ok(item.statusTags.includes("Snowflake"));
  });

  it("formats GitHub issue submission markdown for DevShelf auto-add-submission action", () => {
    const item = DevShelfExporter.createCatalogItem({
      serverName: "ritual-s3-mcp",
      category: "Cloud & Storage",
    });

    const md = DevShelfExporter.formatSubmissionMarkdown(item, {
      freeTier: "100% Free & Open Source Apache-2.0",
    });

    assert.ok(md.includes("### Resource Name\nritual-s3-mcp"));
    assert.ok(md.includes("### Category\nCloud & Storage"));
    assert.ok(md.includes("100% Free & Open Source Apache-2.0"));
    assert.ok(md.includes("https://github.com/RitualDev-Lab/mcp-builder-kit"));
  });

  it("generates a prefilled 1-click GitHub submission issue URL", () => {
    const item = DevShelfExporter.createCatalogItem({
      serverName: "ritual-redis-mcp",
    });

    const url = DevShelfExporter.generateDevShelfSubmissionUrl(item);
    assert.ok(url.startsWith("https://github.com/RitualDev-Lab/DevShelf/issues/new?"));
    assert.ok(url.includes("%5BResource+Submission%5D%3A+ritual-redis-mcp"));
  });

  it("exports catalog JSON and markdown submission files to disk", () => {
    try {
      const result = DevShelfExporter.exportToFiles(
        {
          serverName: "ritual-stripe-mcp",
          outputDir: tmpBase,
        },
        tmpBase,
      );

      assert.ok(existsSync(result.filePath));
      const submissionMdPath = join(tmpBase, ".devshelf-submission.md");
      assert.ok(existsSync(submissionMdPath));

      const parsed = JSON.parse(readFileSync(result.filePath, "utf8"));
      assert.strictEqual(parsed.name, "ritual-stripe-mcp");
    } finally {
      if (existsSync(tmpBase)) rmSync(tmpBase, { recursive: true, force: true });
    }
  });
});
