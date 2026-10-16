import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import test, { describe, after } from "node:test";
import { McpVisualInspectorServer } from "../src/dashboard.js";
import { McpServerDeployer } from "../src/deployer.js";

describe("Serverless Deployer & Visual Inspector Suite", () => {
  const tmpDeployDir = join(process.cwd(), ".tmp_test_deployer");

  after(() => {
    if (existsSync(tmpDeployDir)) {
      rmSync(tmpDeployDir, { recursive: true, force: true });
    }
  });

  test("generates Cloudflare Workers serverless deployment manifests", () => {
    const result = McpServerDeployer.generateDeployment({
      target: "cloudflare-workers",
      serverName: "test-mcp-worker",
      outputDir: tmpDeployDir,
    });

    assert.ok(result);
    assert.strictEqual(result.target, "cloudflare-workers");
    assert.ok(result.filesCreated.includes("wrangler.toml"));
    assert.ok(result.filesCreated.includes("src/worker.ts"));

    const wranglerPath = join(tmpDeployDir, "wrangler.toml");
    const workerPath = join(tmpDeployDir, "src", "worker.ts");

    assert.ok(existsSync(wranglerPath));
    assert.ok(existsSync(workerPath));

    const wranglerContent = readFileSync(wranglerPath, "utf8");
    assert.ok(wranglerContent.includes('name = "test-mcp-worker"'));
    assert.ok(wranglerContent.includes('main = "src/worker.ts"'));

    const workerContent = readFileSync(workerPath, "utf8");
    assert.ok(workerContent.includes("/sse"));
    assert.ok(workerContent.includes("tools/list"));
    assert.ok(workerContent.includes("tools/call"));
  });

  test("generates Google Cloud Run container deployment manifests", () => {
    const runDir = join(tmpDeployDir, "cloudrun");
    const result = McpServerDeployer.generateDeployment({
      target: "cloud-run",
      serverName: "test-mcp-cloudrun",
      outputDir: runDir,
      port: 8080,
    });

    assert.ok(result);
    assert.strictEqual(result.target, "cloud-run");
    assert.ok(result.filesCreated.includes("Dockerfile.cloudrun"));
    assert.ok(result.filesCreated.includes("cloudrun-service.yaml"));

    const dockerfilePath = join(runDir, "Dockerfile.cloudrun");
    const yamlPath = join(runDir, "cloudrun-service.yaml");

    assert.ok(existsSync(dockerfilePath));
    assert.ok(existsSync(yamlPath));

    const yamlContent = readFileSync(yamlPath, "utf8");
    assert.ok(yamlContent.includes("test-mcp-cloudrun"));
    assert.ok(yamlContent.includes("containerPort: 8080"));
  });

  test("starts and responds on McpVisualInspectorServer web dashboard", async () => {
    const inspectorServer = new McpVisualInspectorServer({ port: 4188 });
    const instance = await inspectorServer.start();

    try {
      assert.strictEqual(instance.port, 4188);
      assert.ok(instance.url.includes("4188"));

      // Test GET /
      const getRes = await fetch(instance.url);
      assert.strictEqual(getRes.status, 200);
      const html = await getRes.text();
      assert.ok(html.includes("MCP Visual Inspector & Studio"));

      // Test POST /api/call
      const postRes = await fetch(`${instance.url}/api/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "echo_message",
          arguments: { text: "Hello MCP" },
        }),
      });

      assert.strictEqual(postRes.status, 200);
      const json = await postRes.json();
      assert.strictEqual(json.jsonrpc, "2.0");
      assert.ok(json.result.content[0].text.includes("echo_message"));
    } finally {
      instance.stop();
    }
  });
});
