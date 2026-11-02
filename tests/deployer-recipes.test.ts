import assert from "node:assert";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { McpServerDeployer } from "../src/deployer.js";

describe("One-Click Cloud Deployment Recipes Suite", () => {
  const tmpBase = join(process.cwd(), "tmp-test-deployer-recipes");

  it("generates production Docker container and Compose manifests", () => {
    const testDir = join(tmpBase, "docker-test");
    try {
      const result = McpServerDeployer.generateDeployment({
        target: "docker",
        outputDir: testDir,
        projectName: "ritual-docker-mcp",
        port: 9000,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.target, "docker");
      assert.ok(result.filesCreated.includes("Dockerfile"));
      assert.ok(result.filesCreated.includes(".dockerignore"));
      assert.ok(result.filesCreated.includes("docker-compose.yml"));
      assert.ok(existsSync(join(testDir, "Dockerfile")));
      assert.ok(existsSync(join(testDir, "docker-compose.yml")));
      assert.ok(result.deployInstructions.some((i) => i.includes("docker build")));
    } finally {
      if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("generates AWS Lambda handler and Serverless Framework manifests", () => {
    const testDir = join(tmpBase, "lambda-test");
    try {
      const result = McpServerDeployer.generateDeployment({
        target: "aws-lambda",
        outputDir: testDir,
        projectName: "ritual-lambda-mcp",
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.target, "aws-lambda");
      assert.ok(result.filesCreated.includes("src/lambda.ts"));
      assert.ok(result.filesCreated.includes("serverless.yml"));
      assert.ok(existsSync(join(testDir, "src/lambda.ts")));
      assert.ok(existsSync(join(testDir, "serverless.yml")));
      assert.ok(result.deployInstructions.some((i) => i.includes("serverless deploy")));
    } finally {
      if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("generates Fly.io micro-VM manifests (fly.toml and Dockerfile.fly)", () => {
    const testDir = join(tmpBase, "fly-test");
    try {
      const result = McpServerDeployer.generateDeployment({
        target: "flyio",
        outputDir: testDir,
        projectName: "ritual-fly-mcp",
        port: 8080,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.target, "flyio");
      assert.ok(result.filesCreated.includes("fly.toml"));
      assert.ok(result.filesCreated.includes("Dockerfile.fly"));
      assert.ok(existsSync(join(testDir, "fly.toml")));
      assert.ok(existsSync(join(testDir, "Dockerfile.fly")));
      assert.ok(result.deployInstructions.some((i) => i.includes("fly deploy")));
    } finally {
      if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("generates Railway cloud deployment manifests (railway.json and Procfile)", () => {
    const testDir = join(tmpBase, "railway-test");
    try {
      const result = McpServerDeployer.generateDeployment({
        target: "railway",
        outputDir: testDir,
        projectName: "ritual-railway-mcp",
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.target, "railway");
      assert.ok(result.filesCreated.includes("railway.json"));
      assert.ok(result.filesCreated.includes("Procfile"));
      assert.ok(existsSync(join(testDir, "railway.json")));
      assert.ok(existsSync(join(testDir, "Procfile")));
      assert.ok(result.deployInstructions.some((i) => i.includes("railway up")));
    } finally {
      if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("throws clear error for unsupported deployment target", () => {
    assert.throws(
      () => {
        McpServerDeployer.generateDeployment({
          target: "unknown-platform" as unknown as import("../src/deployer.js").DeployTarget,
          outputDir: tmpBase,
        });
      },
      {
        message: /Unsupported deployment target/,
      },
    );
  });
});
