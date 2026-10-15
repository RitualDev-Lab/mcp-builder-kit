import type {
  TurnkeyInquiryOptions,
  TurnkeyInquiryResult,
  TurnkeyPackageTier,
  TurnkeyPackageTierId,
} from "./types.js";

export const TURNKEY_MCP_TIERS: TurnkeyPackageTier[] = [
  {
    id: "starter",
    name: "Starter Turnkey Server",
    priceUsd: 500,
    turnaroundDays: "48 - 72 Hours",
    description:
      "Ideal for startups or internal teams needing 1-3 REST/OpenAPI tools or custom database integrations packaged into a production MCP server.",
    depositCheckoutUrl:
      "https://checkout.dodopayments.com/buy/pdt_0NpjOJVkkh7Mryrzm6ro9?tier=starter&deposit=250",
    consultationUrl: "https://cal.com/ritualdev/mcp-turnkey-starter",
    deliverables: [
      "1-3 Production Tools & Resources with Zod validation",
      "Headless Mock Inspector test suite with 100% protocol conformance",
      "AgentShield Zero-Leak security audit certification",
      "Dockerized container & Claude / Cursor / Antigravity integration configs",
      "Full source code ownership & handover with README",
    ],
    sla: "Standard 7-day post-launch warranty and bug fixes",
  },
  {
    id: "pro",
    name: "Professional Multi-API Server",
    priceUsd: 1500,
    turnaroundDays: "5 - 7 Business Days",
    description:
      "Engineered for complex workflows: multiple third-party APIs, OAuth2/AuthN handling, dynamic resource streaming, and custom LLM sanitization.",
    depositCheckoutUrl:
      "https://checkout.dodopayments.com/buy/pdt_0NpjOJVkkh7Mryrzm6ro9?tier=pro&deposit=750",
    consultationUrl: "https://cal.com/ritualdev/mcp-turnkey-pro",
    deliverables: [
      "Up to 10 Production Tools, Prompts & Live Streaming Resources",
      "Secure OAuth2/API Key credential management & token rotation",
      "AgentShield Enterprise security audit & Zero-Leak runtime middleware",
      "E2E automated JSON-RPC conformance test suite",
      "Docker Compose & Kubernetes manifests for high-availability hosting",
      "14 days dedicated post-launch support and integration assistance",
    ],
    sla: "Priority 24h response SLA with 14-day warranty",
  },
  {
    id: "enterprise",
    name: "Enterprise Custom Architecture",
    priceUsd: 3500,
    turnaroundDays: "10 - 14 Business Days",
    description:
      "Full-scale bespoke enterprise server: proprietary internal microservices, private VPC networking, RBAC, air-gapped on-prem isolation, and SLA guarantee.",
    depositCheckoutUrl:
      "https://checkout.dodopayments.com/buy/pdt_0NpjOJVkkh7Mryrzm6ro9?tier=enterprise&deposit=1750",
    consultationUrl: "https://cal.com/ritualdev/mcp-turnkey-enterprise",
    deliverables: [
      "Unlimited Tools, Resources, Prompts, and Dynamic Subscriptions",
      "Private VPC / On-Prem / Air-gapped deployment architecture",
      "Strict RBAC, audit logging, and SIEM event streaming",
      "Complete SLSA Level 3 supply-chain verification and SBOM",
      "Official Verified Secure MCP Server badge certification",
      "DevShelf Featured Directory placement included for 3 months",
      "30 days dedicated white-glove engineering support and warranty",
    ],
    sla: "Dedicated Slack channel, 4h response time SLA, 30-day warranty",
  },
];

// biome-ignore lint/complexity/noStaticOnlyClass: Turnkey utility class
export class TurnkeyMcpService {
  /**
   * Retrieves all available turnkey tiers
   */
  public static getTiers(): TurnkeyPackageTier[] {
    return TURNKEY_MCP_TIERS;
  }

  /**
   * Retrieves a specific turnkey tier by ID
   */
  public static getTier(tierId: TurnkeyPackageTierId): TurnkeyPackageTier | undefined {
    return TURNKEY_MCP_TIERS.find((t) => t.id === tierId);
  }

  /**
   * Generates a client project intake summary and direct self-serve deposit / discovery link
   */
  public static generateInquiry(options: TurnkeyInquiryOptions = {}): TurnkeyInquiryResult {
    const tierId = options.tierId ?? "starter";
    const tier = TurnkeyMcpService.getTier(tierId) ?? TURNKEY_MCP_TIERS[0];
    const clientName = options.clientName ?? "Prospective Client";
    const companyName = options.companyName ?? "Independent Developer / Enterprise";
    const systems =
      options.targetSystems && options.targetSystems.length > 0
        ? options.targetSystems.join(", ")
        : "Internal REST API / Database / SaaS Integrations";
    const overview =
      options.projectOverview ?? "Turnkey production MCP server tailored for agentic AI tooling.";

    const inquiryId = `mcp-turnkey-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    const intakeSummaryMarkdown = [
      "# 🛠️ Turnkey MCP Server Custom Development Project Brief",
      "",
      `**Inquiry Reference:** \`${inquiryId}\``,
      `**Client / Organization:** ${clientName} (${companyName})`,
      `**Selected Package:** ${tier.name} ($${tier.priceUsd.toLocaleString()})`,
      `**Target Systems:** ${systems}`,
      `**Estimated Turnaround:** ${tier.turnaroundDays}`,
      `**SLA & Support:** ${tier.sla}`,
      "",
      "### Project Scope Overview:",
      `> ${overview}`,
      "",
      "### Package Deliverables:",
      ...tier.deliverables.map((d) => `- [x] ${d}`),
      "",
      "### 🚀 Next Steps to Kickoff:",
      "1. **Reserve Project Slot & 50% Milestone Deposit:**",
      `   👉 [Pay Milestone Deposit via Dodo Payments](${tier.depositCheckoutUrl})`,
      "2. **Schedule 20-Min Architecture Discovery Call:**",
      `   👉 [Book Architecture Call via Cal.com](${tier.consultationUrl})`,
      "3. **Direct Inquiry Email:**",
      `   Contact \`team@ritualdev.in\` referencing **\`${inquiryId}\`**`,
    ].join("\n");

    return {
      inquiryId,
      tier,
      clientName,
      companyName,
      depositCheckoutUrl: tier.depositCheckoutUrl,
      consultationUrl: tier.consultationUrl,
      intakeSummaryMarkdown,
    };
  }
}
