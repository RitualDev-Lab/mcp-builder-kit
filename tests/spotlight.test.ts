import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { DEVSHELF_MCP_SPOTLIGHT_TIERS, DevShelfSpotlightService } from "../src/spotlight.js";

describe("Monetization: DevShelf Featured MCP Directory Spotlight Suite", () => {
  const serverName = "superfile-mcp";

  test("retrieves available DevShelf directory spotlight tiers with active Dodo Payments links", () => {
    const tiers = DevShelfSpotlightService.getTiers();
    assert.strictEqual(tiers.length, 2);

    const monthly = DevShelfSpotlightService.getTier("mcp-featured-monthly");
    assert.ok(monthly);
    assert.strictEqual(monthly.priceUsd, 49);
    assert.strictEqual(monthly.billingPeriod, "monthly");
    assert.ok(monthly.checkoutUrl.includes("checkout.dodopayments.com"));

    const takeover = DevShelfSpotlightService.getTier("mcp-category-takeover");
    assert.ok(takeover);
    assert.strictEqual(takeover.priceUsd, 149);
  });

  test("generates DevShelf submission metadata and direct Dodo Payments checkout link", () => {
    const spotlight = DevShelfSpotlightService.generateSpotlightSubmission(
      serverName,
      "mcp-featured-monthly",
    );

    assert.ok(spotlight);
    assert.strictEqual(spotlight.serverName, serverName);
    assert.ok(spotlight.checkoutUrl.includes("tool=superfile-mcp"));
    assert.ok(spotlight.featuredBadgeMarkdown.includes("Featured%20on-DevShelf"));
    assert.ok(
      spotlight.featuredBadgeMarkdown.includes("https://devshelf.ritualdev.in/mcp/superfile-mcp"),
    );
    assert.ok(spotlight.directorySubmitUrl.includes("github.com/RitualDev-Lab/DevShelf"));
  });
});
