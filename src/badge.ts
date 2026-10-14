import { createHmac } from "node:crypto";
import type { McpBadgeSnippetResult, McpBadgeTier } from "./types.js";

/**
 * AgentShield Verified MCP Server Audit Badge Generator
 * Provides cryptographically verifiable badges & self-serve checkout URLs via Dodo Payments
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Badge utility class
export class VerifiedMcpBadgeService {
  private static readonly BADGE_SECRET =
    process.env.AGENTSHIELD_BADGE_SECRET || "agentshield_verified_salt_2026";
  private static readonly CANONICAL_DOMAIN = "https://agentshield.ritualdev.in";

  /**
   * Generates a tamper-proof HMAC-SHA256 signature for an audited MCP server
   */
  public static signAuditRecord(
    serverName: string,
    tier: McpBadgeTier = "verified",
    auditMetadata: { commitSha?: string; auditScore?: number; timestamp?: number } = {},
  ): string {
    const secret = process.env.AGENTSHIELD_BADGE_SECRET;
    if (!secret && process.env.NODE_ENV === "production") {
      throw new Error("AGENTSHIELD_BADGE_SECRET must be configured in environment for production badge signing");
    }
    const signingKey = secret || "agentshield_development_audit_key";
    const sha = auditMetadata.commitSha || "head";
    const score = auditMetadata.auditScore ?? 100;
    const ts = auditMetadata.timestamp || 1760443200; // normalized epoch reference
    const payload = `mcp|${serverName.toLowerCase().trim()}|${tier}|${sha}|${score}|${ts}`;
    return createHmac("sha256", signingKey)
      .update(payload)
      .digest("hex")
      .slice(0, 16);
  }

  /**
   * Verifies an MCP audit badge signature
   */
  public static verifyAuditRecord(
    serverName: string,
    tier: McpBadgeTier,
    hash: string,
    auditMetadata?: { commitSha?: string; auditScore?: number; timestamp?: number },
  ): boolean {
    const expected = VerifiedMcpBadgeService.signAuditRecord(serverName, tier, auditMetadata);
    return expected.toLowerCase() === hash.toLowerCase();
  }

  /**
   * Returns complete badge snippets (Markdown, HTML, SVG) and Dodo Payments checkout links
   */
  public static getBadgeSnippet(
    serverName: string,
    tier: McpBadgeTier = "verified",
  ): McpBadgeSnippetResult {
    const cleanSlug = encodeURIComponent(serverName.toLowerCase().replace(/\s+/g, "-"));
    const hash = VerifiedMcpBadgeService.signAuditRecord(serverName, tier);
    const domain = VerifiedMcpBadgeService.CANONICAL_DOMAIN;

    const svgBadgeUrl = `${domain}/badges/${cleanSlug}.svg?tier=${tier}&hash=${hash}`;
    const verifyUrl = `${domain}/verify/${cleanSlug}?hash=${hash}&tier=${tier}`;

    // Pricing & Checkout via Dodo Payments
    const checkoutUrl =
      tier === "sponsor"
        ? `https://checkout.dodopayments.com/buy/pdt_agentshield_verified_badge?tool=${cleanSlug}&tier=sponsor&price=79`
        : `https://checkout.dodopayments.com/buy/pdt_agentshield_verified_badge?tool=${cleanSlug}&tier=verified&price=29`;

    const label = "Verified MCP Server";
    const status = tier === "sponsor" ? "AgentShield ★ Sponsor" : "AgentShield Zero--Leak";
    const color = tier === "sponsor" ? "ec4899" : "8b5cf6";
    const shieldsIoUrl = `https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(status)}-${color}?logo=shield&logoColor=white&style=flat-square`;

    const markdown = `[![Verified Secure MCP Server](${shieldsIoUrl})](${verifyUrl})`;
    const html = `<a href="${verifyUrl}" target="_blank" rel="noopener noreferrer"><img src="${shieldsIoUrl}" alt="Verified Secure MCP Server" /></a>`;

    return {
      markdown,
      html,
      svgBadgeUrl,
      verifyUrl,
      checkoutUrl,
      tier,
    };
  }

  /**
   * Generates a high-resolution, self-contained SVG badge
   */
  public static generateSvgBadge(serverName: string, tier: McpBadgeTier = "verified"): string {
    const leftText = "VERIFIED MCP SERVER";
    const rightText = tier === "sponsor" ? "AgentShield ★ Sponsor" : "AgentShield Zero-Leak";
    const accentColor = tier === "sponsor" ? "#ec4899" : "#8b5cf6";

    const leftWidth = 145;
    const rightWidth = 150;
    const totalWidth = leftWidth + rightWidth;
    const height = 24;

    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}" role="img" aria-label="${leftText}: ${rightText}">
  <title>${leftText}: ${rightText}</title>
  <clipPath id="mcp-badge-round">
    <rect width="${totalWidth}" height="${height}" rx="5" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#mcp-badge-round)">
    <rect width="${leftWidth}" height="${height}" fill="#111827"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="${height}" fill="${accentColor}"/>
    <rect width="${totalWidth}" height="${height}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" letter-spacing="0.3">
    <text x="${leftWidth / 2}" y="16.5" fill="#9ca3af">${leftText}</text>
    <text x="${leftWidth + rightWidth / 2}" y="16.5" fill="#ffffff">${rightText}</text>
  </g>
</svg>`.trim();
  }
}
