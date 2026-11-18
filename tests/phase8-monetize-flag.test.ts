import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { runCli } from "../src/cli.js";
import { McpProjectScaffolder } from "../src/scaffolder.js";

test("Phase 8: init --monetize dodo --with-agentshield --transport streamable-http scaffolds paywall + redaction", async () => {
  const workDir = mkdtempSync(join(tmpdir(), "mcp-phase8-dodo-"));
  const targetDir = join(workDir, "paid-dodo-mcp");

  try {
    await runCli([
      "init",
      "paid-dodo-mcp",
      "--dir",
      targetDir,
      "--transport",
      "streamable-http",
      "--with-agentshield",
      "--monetize",
      "dodo",
    ]);

    const indexPath = join(targetDir, "src/index.ts");
    const monetizePath = join(targetDir, "src/monetize-middleware.ts");
    const shieldPath = join(targetDir, "src/agentshield-middleware.ts");
    const readmePath = join(targetDir, "README.md");

    assert.ok(existsSync(indexPath));
    assert.ok(existsSync(monetizePath));
    assert.ok(existsSync(shieldPath));

    const indexSrc = readFileSync(indexPath, "utf8");
    assert.match(indexSrc, /withMonetizePaywall\(withAgentShieldRedaction\(handleToolCall\)\)/);
    assert.match(indexSrc, /verifyHttpMonetization\(req\.headers\)/);
    assert.match(indexSrc, /res\.writeHead\(402/);

    const monetizeSrc = readFileSync(monetizePath, "utf8");
    assert.match(monetizeSrc, /provider: "dodo"/);
    assert.match(monetizeSrc, /checkout\.dodopayments\.com/);
    assert.match(monetizeSrc, /timingSafeEqual/);

    const readme = readFileSync(readmePath, "utf8");
    assert.match(readme, /Dodo Payments/);
    assert.match(readme, /DODO_PAYMENTS_API_KEY/);

    // Dynamically import generated TypeScript paywall middleware under tsx and verify runtime enforcement
    const mod = await import(pathToFileURL(monetizePath).href);
    mod.resetUsageCounters();

    const strictConfig = {
      provider: "dodo",
      enforce: true,
      freeQuota: 0,
      checkoutUrl: "https://checkout.dodopayments.com/buy/test_product",
      validKeys: ["lic_valid_dodo_123"],
    };

    const denied = mod.evaluateMonetization(undefined, strictConfig);
    assert.equal(denied.allowed, false);
    assert.equal(denied.statusCode, 402);
    assert.equal(denied.provider, "dodo");

    const allowed = mod.evaluateMonetization("lic_valid_dodo_123", strictConfig);
    assert.equal(allowed.allowed, true);
    assert.equal(allowed.statusCode, 200);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test("Phase 8: McpProjectScaffolder supports --monetize stripe for TypeScript and Python", () => {
  const workDir = mkdtempSync(join(tmpdir(), "mcp-phase8-stripe-"));
  const tsDir = join(workDir, "paid-stripe-ts");
  const pyDir = join(workDir, "paid-stripe-py");

  try {
    const tsRes = McpProjectScaffolder.scaffold({
      projectName: "paid-stripe-ts",
      targetDir: tsDir,
      language: "typescript",
      transport: "streamable-http",
      monetize: "stripe",
    });
    assert.ok(tsRes.filesCreated.includes("src/monetize-middleware.ts"));
    const tsMon = readFileSync(join(tsDir, "src/monetize-middleware.ts"), "utf8");
    assert.match(tsMon, /provider: "stripe"/);
    assert.match(tsMon, /buy\.stripe\.com/);

    const pyRes = McpProjectScaffolder.scaffold({
      projectName: "paid-stripe-py",
      targetDir: pyDir,
      language: "python",
      transport: "streamable-http",
      includeAgentShield: true,
      monetize: "stripe",
    });
    assert.ok(pyRes.filesCreated.includes("paid_stripe_py/monetize.py"));
    const pyMon = readFileSync(join(pyDir, "paid_stripe_py/monetize.py"), "utf8");
    assert.match(pyMon, /PROVIDER = "stripe"/);
    assert.match(pyMon, /hmac\.compare_digest/);
    const pyServer = readFileSync(join(pyDir, "paid_stripe_py/server.py"), "utf8");
    assert.match(pyServer, /from paid_stripe_py\.monetize import verify_license/);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});
