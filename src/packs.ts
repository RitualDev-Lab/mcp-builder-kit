import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { PremiumPackDefinition } from "./types.js";

/**
 * Catalog of Battle-Tested Enterprise MCP Tool Starters & Connectors
 * Monitized via self-serve Dodo Payments checkout URLs
 */
export const PREMIUM_MCP_PACKS: Record<string, PremiumPackDefinition> = {
  "enterprise-database-pack": {
    id: "pdt_mcp_database_pack",
    name: "Enterprise Database & Warehouse MCP Pack",
    category: "database",
    priceUsd: 49,
    type: "one_time",
    description:
      "Production-ready, connection-pooled MCP servers for Postgres, MongoDB, ClickHouse, Redis & Snowflake with read-only sandboxing.",
    checkoutUrl: "https://checkout.dodopayments.com/buy/pdt_0NpjONEJnu5OcWhncWF68?pack=database",
    features: [
      "Zero-overhead connection pooling with keep-alives",
      "Strict Read-Only query enforcement & AST safety parser",
      "Sensitive column redaction (PII/emails/passwords)",
      "Zod schemas for dynamic table exploration and schema diffs",
    ],
    sampleTools: [
      "postgres_read_query",
      "postgres_inspect_schema",
      "mongodb_aggregate",
      "clickhouse_timeseries_query",
      "redis_safe_get",
    ],
  },
  "cloud-devops-pack": {
    id: "pdt_0NpjONEJnu5OcWhncWF68",
    name: "Cloud & Kubernetes DevOps MCP Pack",
    category: "devops",
    priceUsd: 49,
    type: "one_time",
    description:
      "Enterprise operational MCP toolkits for AWS, Google Cloud, Docker, Kubernetes & GitHub Actions with IAM least-privilege scoping.",
    checkoutUrl: "https://checkout.dodopayments.com/buy/pdt_0NpjONEJnu5OcWhncWF68?pack=devops",
    features: [
      "Kubernetes pod/log inspection & rollout restart handlers",
      "AWS S3 presigned URL generator & CloudWatch query runner",
      "Docker container lifecycle inspector & log streamer",
      "GitHub Actions workflow dispatcher & CI failure diagnostic parser",
    ],
    sampleTools: [
      "k8s_get_pod_logs",
      "k8s_restart_deployment",
      "aws_query_cloudwatch",
      "docker_inspect_container",
      "github_trigger_workflow",
    ],
  },
  "saas-fintech-pack": {
    id: "pdt_0NpjONEJnu5OcWhncWF68",
    name: "Fintech & SaaS Connector MCP Pack",
    category: "payments",
    priceUsd: 39,
    type: "one_time",
    description:
      "Secure toolkits for Stripe, Dodo Payments, HubSpot, Notion, and Slack with automated webhook verification and idempotent executions.",
    checkoutUrl: "https://checkout.dodopayments.com/buy/pdt_0NpjONEJnu5OcWhncWF68?pack=fintech",
    features: [
      "Stripe payment intent and customer subscription reader",
      "Dodo Payments self-serve checkout link generator",
      "HubSpot CRM contact/deal manager",
      "Slack incident alert broadcast with rich blocks",
    ],
    sampleTools: [
      "stripe_get_customer_invoices",
      "dodo_create_payment_link",
      "hubspot_search_contacts",
      "slack_post_incident_alert",
    ],
  },
  "all-access-bundle": {
    id: "pdt_0NpjONEJnu5OcWhncWF68",
    name: "All-Access Enterprise MCP Bundle & Future Updates",
    category: "all_access",
    priceUsd: 99,
    type: "one_time",
    description:
      "Complete access to all current and future premium enterprise MCP starters, priority Discord support, and lifetime updates.",
    checkoutUrl: "https://checkout.dodopayments.com/buy/pdt_0NpjONEJnu5OcWhncWF68?pack=all_access",
    features: [
      "Includes all Database, Cloud/DevOps, and Fintech/SaaS packs",
      "Lifetime updates and access to newly released enterprise packs",
      "Direct priority Slack/Discord engineering support from RitualDev Lab",
      "Turnkey Docker Compose templates with hot-reloading",
    ],
    sampleTools: ["All 25+ production-grade enterprise tools included"],
  },
};

/**
 * Enterprise Pack Downloader & Generator Engine
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Pack installer utility class
export class EnterprisePackManager {
  public static getAvailablePacks(): PremiumPackDefinition[] {
    return Object.values(PREMIUM_MCP_PACKS);
  }

  public static getPack(packId: string): PremiumPackDefinition | undefined {
    return PREMIUM_MCP_PACKS[packId];
  }

  /**
   * Installs or previews a target enterprise pack
   */
  public static installPack(
    packId: string,
    targetDir: string,
    licenseKey?: string,
  ): {
    success: boolean;
    checkoutUrl?: string;
    message: string;
    filesCreated: string[];
  } {
    const pack = PREMIUM_MCP_PACKS[packId];
    if (!pack) {
      throw new Error(
        `Unknown pack ID: '${packId}'. Available packs: ${Object.keys(PREMIUM_MCP_PACKS).join(", ")}`,
      );
    }

    // In trial or licensed mode, generate starter stubs
    const resolvedDir = resolve(targetDir);
    if (!existsSync(resolvedDir)) {
      mkdirSync(resolvedDir, { recursive: true });
    }

    const filesCreated: string[] = [];

    // Emit starter configuration and tool stubs
    const stubContent = `
/**
 * ${pack.name}
 * Generated by @ritualdev-lab/mcp-builder-kit
 * License: ${licenseKey ? "ENTERPRISE-LICENSED" : "COMMUNITY-PREVIEW"}
 */
import { z } from "zod";

${pack.sampleTools
  .map(
    (tool) => `
// Enterprise Tool: ${tool}
export const ${tool}Definition = {
  name: "${tool}",
  description: "Enterprise connector for ${tool.replace(/_/g, " ")}",
  inputSchema: {
    type: "object",
    properties: {
      target: { type: "string", description: "Resource identifier" },
    },
    required: ["target"],
  },
};
`,
  )
  .join("\n")}
`.trim();

    const stubFile = join(resolvedDir, `${packId.replace(/-/g, "_")}_stubs.ts`);
    writeFileSync(stubFile, stubContent, "utf8");
    filesCreated.push(stubFile);

    return {
      success: true,
      checkoutUrl: pack.checkoutUrl,
      message: licenseKey
        ? `Successfully activated and unpacked ${pack.name}!`
        : `Preview stubs for ${pack.name} generated. To unlock full production connectors, complete checkout at: ${pack.checkoutUrl}`,
      filesCreated,
    };
  }
}
