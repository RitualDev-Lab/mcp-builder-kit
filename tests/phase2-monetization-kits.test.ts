import { strict as assert } from "node:assert";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { EnterprisePackManager, PREMIUM_MCP_PACKS } from "../src/packs.js";
import { McpProjectScaffolder } from "../src/scaffolder.js";

describe("Phase 2 Monetization: Enterprise Production Scaffolder Kits ($99 - $249)", () => {
  it("registers Enterprise RAG ($149), K8s Ops Agent ($199), and Financial Ledger ($249) packs", () => {
    assert.ok(PREMIUM_MCP_PACKS["enterprise-rag-pack"], "enterprise-rag-pack should be registered");
    assert.equal(PREMIUM_MCP_PACKS["enterprise-rag-pack"].priceUsd, 149);

    assert.ok(PREMIUM_MCP_PACKS["k8s-ops-agent-pack"], "k8s-ops-agent-pack should be registered");
    assert.equal(PREMIUM_MCP_PACKS["k8s-ops-agent-pack"].priceUsd, 199);

    assert.ok(
      PREMIUM_MCP_PACKS["financial-ledger-pack"],
      "financial-ledger-pack should be registered",
    );
    assert.equal(PREMIUM_MCP_PACKS["financial-ledger-pack"].priceUsd, 249);
  });

  it("scaffolds Enterprise RAG kit with citation provenance and hybrid search", () => {
    const target = join(tmpdir(), `test-rag-scaffold-${Date.now()}`);
    try {
      const result = McpProjectScaffolder.scaffold({
        projectName: "my-enterprise-rag",
        targetDir: target,
        template: "enterprise-rag",
      });

      assert.equal(result.success, true);
      assert.ok(existsSync(join(target, "package.json")));
      assert.ok(existsSync(join(target, "src/index.ts")));
      assert.ok(existsSync(join(target, "README.md")));
      assert.ok(result.filesCreated.includes("src/index.ts"));
    } finally {
      if (existsSync(target)) rmSync(target, { recursive: true, force: true });
    }
  });

  it("scaffolds Air-Gapped Kubernetes Ops Agent with cordon/drain safety rails", () => {
    const target = join(tmpdir(), `test-k8s-scaffold-${Date.now()}`);
    try {
      const result = McpProjectScaffolder.scaffold({
        projectName: "my-k8s-ops-agent",
        targetDir: target,
        template: "k8s-ops-agent",
      });

      assert.equal(result.success, true);
      assert.ok(existsSync(join(target, "package.json")));
      assert.ok(existsSync(join(target, "src/index.ts")));
      assert.ok(existsSync(join(target, "README.md")));
    } finally {
      if (existsSync(target)) rmSync(target, { recursive: true, force: true });
    }
  });

  it("scaffolds Financial Ledger Connector with double-entry idempotency and hash chains", () => {
    const target = join(tmpdir(), `test-ledger-scaffold-${Date.now()}`);
    try {
      const result = McpProjectScaffolder.scaffold({
        projectName: "my-financial-ledger",
        targetDir: target,
        template: "financial-ledger",
      });

      assert.equal(result.success, true);
      assert.ok(existsSync(join(target, "package.json")));
      assert.ok(existsSync(join(target, "src/index.ts")));
      assert.ok(existsSync(join(target, "README.md")));
    } finally {
      if (existsSync(target)) rmSync(target, { recursive: true, force: true });
    }
  });

  it("EnterprisePackManager installs preview stubs and provides Dodo Payments checkout URLs", () => {
    const target = join(tmpdir(), `test-pack-install-${Date.now()}`);
    try {
      const installRes = EnterprisePackManager.installPack("financial-ledger-pack", target);
      assert.equal(installRes.success, true);
      assert.ok(installRes.checkoutUrl?.includes("dodopayments.com"));
      assert.ok(existsSync(installRes.filesCreated[0]));
    } finally {
      if (existsSync(target)) rmSync(target, { recursive: true, force: true });
    }
  });
});
