import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FOUNDATION_GRANTS,
  GrantsAndBountiesService,
  OPEN_SOURCE_BOUNTIES,
} from "../src/grants.js";

describe("Monetization: Foundation Grants & Open-Source Bounties Suite", () => {
  it("retrieves available ecosystem grant programs with requirements and portals", () => {
    const grants = GrantsAndBountiesService.getGrants();
    assert.ok(grants.length >= 3);

    const anthropic = grants.find((g) => g.id === "anthropic-alignment-ecosystem");
    assert.ok(anthropic);
    assert.ok(anthropic.grantRangeUsd.includes("25,000"));
    assert.ok(anthropic.requirements.some((r) => r.includes("AgentShield")));

    const gitcoin = grants.find((g) => g.id === "gitcoin-grants-ai-oss");
    assert.ok(gitcoin);
    assert.ok(gitcoin.applicationUrl.includes("gitcoin.co"));
  });

  it("retrieves open-source bounty catalog with rewards and claim URLs", () => {
    const catalog = GrantsAndBountiesService.getCatalog();
    assert.ok(catalog.bounties.length >= 4);
    assert.ok(catalog.githubSponsorsUrl.includes("github.com/sponsors/RitualDev-Lab"));
    assert.ok(catalog.polarBountiesUrl.includes("polar.sh/RitualDev-Lab/mcp-builder-kit"));

    const rustBounty = catalog.bounties.find((b) => b.id === "bounty-rust-fastmcp-generator");
    assert.ok(rustBounty);
    assert.equal(rustBounty.rewardUsd, 1200);
    assert.equal(rustBounty.difficulty, "advanced");
  });

  it("generates targeted application narrative pitch with proof of conformance metrics", () => {
    const pitch = GrantsAndBountiesService.generatePitchSummary("anthropic-alignment-ecosystem");
    assert.ok(pitch.includes("Anthropic Model Context Protocol Ecosystem Fund"));
    assert.ok(pitch.includes("AgentShield"));
    assert.ok(pitch.includes("100% Protocol Conformance"));
    assert.ok(pitch.includes("https://www.anthropic.com/programs"));
  });

  it("falls back to default grant pitch when an unknown ID is provided", () => {
    const fallback = GrantsAndBountiesService.generatePitchSummary("unknown-grant-id");
    assert.ok(fallback.includes(FOUNDATION_GRANTS[0].name));
  });
});
