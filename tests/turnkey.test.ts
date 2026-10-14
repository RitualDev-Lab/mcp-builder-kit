import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TURNKEY_MCP_TIERS, TurnkeyMcpService } from "../src/turnkey.js";

describe("Monetization: B2B Turnkey Custom MCP Development Suite", () => {
  it("provides active Turnkey MCP tiers with defined deliverables and Dodo checkout links", () => {
    const tiers = TurnkeyMcpService.getTiers();
    assert.equal(tiers.length, 3);

    const starter = tiers.find((t) => t.id === "starter");
    assert.ok(starter);
    assert.equal(starter.priceUsd, 500);
    assert.ok(starter.depositCheckoutUrl.includes("checkout.dodopayments.com"));
    assert.ok(starter.consultationUrl.includes("cal.com"));

    const pro = tiers.find((t) => t.id === "pro");
    assert.ok(pro);
    assert.equal(pro.priceUsd, 1500);
    assert.ok(pro.deliverables.length >= 5);

    const enterprise = tiers.find((t) => t.id === "enterprise");
    assert.ok(enterprise);
    assert.equal(enterprise.priceUsd, 3500);
    assert.ok(enterprise.deliverables.some((d) => d.includes("SLSA Level 3")));
  });

  it("generates an architectural inquiry brief with tailored deliverables and milestone deposits", () => {
    const inquiry = TurnkeyMcpService.generateInquiry({
      clientName: "Acme Corp",
      companyName: "Acme Autonomous AI",
      tierId: "pro",
      projectOverview: "Connecting Salesforce and BigQuery to Claude Desktop",
      targetSystems: ["Salesforce CRM", "Google BigQuery"],
    });

    assert.ok(inquiry.inquiryId.startsWith("mcp-turnkey-"));
    assert.equal(inquiry.tier.id, "pro");
    assert.equal(inquiry.clientName, "Acme Corp");
    assert.equal(inquiry.companyName, "Acme Autonomous AI");
    assert.ok(inquiry.depositCheckoutUrl.includes("deposit=750"));
    assert.ok(inquiry.consultationUrl.includes("mcp-turnkey-pro"));

    assert.ok(inquiry.intakeSummaryMarkdown.includes("Acme Corp (Acme Autonomous AI)"));
    assert.ok(inquiry.intakeSummaryMarkdown.includes("Salesforce CRM, Google BigQuery"));
    assert.ok(inquiry.intakeSummaryMarkdown.includes("$1,500"));
    assert.ok(inquiry.intakeSummaryMarkdown.includes("Pay Milestone Deposit"));
  });

  it("gracefully falls back to starter tier when invalid or empty tier is supplied", () => {
    const defaultInquiry = TurnkeyMcpService.generateInquiry();
    assert.equal(defaultInquiry.tier.id, "starter");
    assert.equal(defaultInquiry.tier.priceUsd, 500);
    assert.ok(defaultInquiry.depositCheckoutUrl.includes("deposit=250"));
  });
});
