import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import test, { describe, after } from "node:test";
import { EnterprisePackManager, PREMIUM_MCP_PACKS } from "../src/packs.js";

describe("Monetization: Enterprise Tool Starters & Self-Serve Dodo Checkout Suite", () => {
  const tmpInstallDir = join(process.cwd(), ".tmp_test_packs_install");

  after(() => {
    if (existsSync(tmpInstallDir)) {
      rmSync(tmpInstallDir, { recursive: true, force: true });
    }
  });

  test("retrieves enterprise packs with active self-serve Dodo Payments checkout links", () => {
    const packs = EnterprisePackManager.getAvailablePacks();
    assert.ok(packs.length >= 4);

    const dbPack = EnterprisePackManager.getPack("enterprise-database-pack");
    assert.ok(dbPack);
    assert.strictEqual(dbPack.priceUsd, 49);
    assert.ok(dbPack.checkoutUrl.includes("checkout.dodopayments.com"));
    assert.ok(dbPack.sampleTools.includes("postgres_read_query"));

    const allAccess = EnterprisePackManager.getPack("all-access-bundle");
    assert.ok(allAccess);
    assert.strictEqual(allAccess.priceUsd, 99);
  });

  test("installs preview connector stubs with direct Dodo Payments unlock CTA", () => {
    const result = EnterprisePackManager.installPack("enterprise-database-pack", tmpInstallDir);

    assert.ok(result.success);
    assert.ok(result.checkoutUrl);
    assert.ok(result.filesCreated.length > 0);

    const stubFile = result.filesCreated[0];
    assert.ok(existsSync(stubFile));

    const content = readFileSync(stubFile, "utf8");
    assert.ok(content.includes("Enterprise Database & Warehouse MCP Pack"));
    assert.ok(content.includes("postgres_read_queryDefinition"));
  });

  test("activates licensed enterprise connector stubs when licenseKey provided", () => {
    const result = EnterprisePackManager.installPack(
      "cloud-devops-pack",
      tmpInstallDir,
      "lic_dodo_enterprise_valid_token_2026",
    );

    assert.ok(result.success);
    assert.ok(result.message.includes("Successfully activated"));

    const stubFile = result.filesCreated[0];
    const content = readFileSync(stubFile, "utf8");
    assert.ok(content.includes("ENTERPRISE-LICENSED"));
  });
});
