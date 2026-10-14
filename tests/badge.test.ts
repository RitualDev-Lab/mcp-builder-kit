import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { VerifiedMcpBadgeService } from "../src/badge.js";

describe("Monetization: Verified Secure MCP Server Badge & Dodo Payments Suite", () => {
  const serverName = "postgres-mcp-server";
  process.env.AGENTSHIELD_BADGE_SECRET = "test_canonical_audit_secret_key_2026";

  test("generates cryptographic HMAC-SHA256 signature and verifies authentic tokens", () => {
    const verifiedHash = VerifiedMcpBadgeService.signAuditRecord(serverName, "verified");
    assert.ok(verifiedHash);
    assert.strictEqual(verifiedHash.length, 16);

    const isValid = VerifiedMcpBadgeService.verifyAuditRecord(serverName, "verified", verifiedHash);
    assert.strictEqual(isValid, true, "Authentic HMAC signature should verify successfully");

    const isTampered = VerifiedMcpBadgeService.verifyAuditRecord(
      serverName,
      "verified",
      "invalid_hash_1234",
    );
    assert.strictEqual(isTampered, false, "Tampered signature should fail verification");
  });

  test("generates badge snippets with active Dodo Payments self-serve checkout URLs", () => {
    const snippet = VerifiedMcpBadgeService.getBadgeSnippet(serverName, "verified");

    assert.ok(snippet.markdown.startsWith("[![Verified Secure MCP Server]("));
    assert.ok(snippet.html.includes("<img src="));
    assert.ok(snippet.verifyUrl.includes("https://agentshield.ritualdev.in/verify/"));
    assert.ok(snippet.checkoutUrl.includes("checkout.dodopayments.com"));
    assert.ok(snippet.checkoutUrl.includes("price=29"));
  });

  test("generates sponsor tier badge snippet with elevated pricing ($79)", () => {
    const sponsorSnippet = VerifiedMcpBadgeService.getBadgeSnippet(serverName, "sponsor");

    assert.ok(sponsorSnippet.markdown.includes("AgentShield%20%E2%98%85%20Sponsor"));
    assert.ok(sponsorSnippet.checkoutUrl.includes("price=79"));
    assert.ok(sponsorSnippet.checkoutUrl.includes("tier=sponsor"));
  });

  test("generates standalone crisp SVG badge graphic", () => {
    const svg = VerifiedMcpBadgeService.generateSvgBadge(serverName, "verified");
    assert.ok(svg.includes("<svg"));
    assert.ok(svg.includes("VERIFIED MCP SERVER"));
    assert.ok(svg.includes("AgentShield Zero-Leak"));
    assert.ok(svg.includes("#8b5cf6"));
  });
});
