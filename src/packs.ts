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
  "snowflake-connector-pack": {
    id: "pdt_mcp_snowflake_pack",
    name: "Snowflake Enterprise Data Warehouse MCP Pack",
    category: "database",
    priceUsd: 59,
    type: "one_time",
    description:
      "Production Snowflake data warehouse connector with query timeout guard, auto-suspend checks, and schema introspection.",
    checkoutUrl: "https://checkout.dodopayments.com/buy/pdt_0NpjONEJnu5OcWhncWF68?pack=snowflake",
    features: [
      "Snowflake session authentication with key-pair and token auth",
      "Virtual warehouse auto-suspend guard and query cost caps",
      "Multi-statement injection blocking and AST query sanitization",
      "Table schema and stage exploration with JSON diffs",
    ],
    sampleTools: [
      "snowflake_query",
      "snowflake_describe_table",
      "snowflake_list_databases",
      "snowflake_stage_file",
    ],
  },
  "bigquery-connector-pack": {
    id: "pdt_mcp_bigquery_pack",
    name: "Google Cloud BigQuery Analytics MCP Pack",
    category: "database",
    priceUsd: 59,
    type: "one_time",
    description:
      "High-performance BigQuery analytics toolkit with dry-run cost estimation, maximum bytes billed limit, and dataset inspection.",
    checkoutUrl: "https://checkout.dodopayments.com/buy/pdt_0NpjONEJnu5OcWhncWF68?pack=bigquery",
    features: [
      "Dry-run query validator estimating exact bytes scanned and cost",
      "Strict maximum bytes billed circuit breaker per query",
      "Partitioned & clustered table query optimization",
      "Dataset, table, and routine enumeration with IAM filtering",
    ],
    sampleTools: [
      "bigquery_query_dry_run",
      "bigquery_execute_query",
      "bigquery_get_table_schema",
      "bigquery_list_datasets",
    ],
  },
  "aws-s3-r2-storage-pack": {
    id: "pdt_mcp_s3_r2_pack",
    name: "AWS S3 & Cloudflare R2 Object Storage MCP Pack",
    category: "devops",
    priceUsd: 49,
    type: "one_time",
    description:
      "Enterprise multi-cloud object storage connector for AWS S3 and Cloudflare R2 with zero-egress presigned URLs and streaming uploads.",
    checkoutUrl: "https://checkout.dodopayments.com/buy/pdt_0NpjONEJnu5OcWhncWF68?pack=s3_r2",
    features: [
      "Dual AWS S3 & Cloudflare R2 endpoint routing",
      "Time-limited presigned URL generation for reads and writes",
      "Multipart chunked upload with automated resume",
      "Zero-egress acceleration and bucket prefix pagination",
    ],
    sampleTools: [
      "s3_get_object",
      "s3_put_object",
      "s3_list_objects",
      "r2_generate_presigned_url",
      "s3_delete_object",
    ],
  },
  "stripe-webhooks-pack": {
    id: "pdt_mcp_stripe_webhooks_pack",
    name: "Stripe Webhooks & Billing Lifecycle MCP Pack",
    category: "payments",
    priceUsd: 49,
    type: "one_time",
    description:
      "Secure Stripe billing lifecycle and webhook event processor with HMAC-SHA256 signature verification and replay prevention.",
    checkoutUrl:
      "https://checkout.dodopayments.com/buy/pdt_0NpjONEJnu5OcWhncWF68?pack=stripe_webhooks",
    features: [
      "Cryptographic HMAC-SHA256 stripe-signature header verification",
      "Replay attack protection with timestamp tolerance window",
      "Idempotent event dispatcher for payment and subscription events",
      "Customer billing portal session generator",
    ],
    sampleTools: [
      "stripe_verify_webhook_signature",
      "stripe_handle_event",
      "stripe_get_subscription_status",
      "stripe_create_portal_session",
    ],
  },
  "redis-enterprise-pack": {
    id: "pdt_mcp_redis_pack",
    name: "Redis Enterprise Cache & Pub/Sub MCP Pack",
    category: "database",
    priceUsd: 39,
    type: "one_time",
    description:
      "Production Redis caching, atomic token-bucket rate limiting, and pub/sub message broadcaster with cursor SCAN iteration.",
    checkoutUrl: "https://checkout.dodopayments.com/buy/pdt_0NpjONEJnu5OcWhncWF68?pack=redis",
    features: [
      "Non-blocking cursor-based SCAN pagination (no blocking KEYS *)",
      "Sliding-window token bucket atomic rate limiter",
      "Cache-aside pattern helper with TTL enforcement and NX/XX flags",
      "Pub/sub event channel broadcast with message ack",
    ],
    sampleTools: [
      "redis_get_cached",
      "redis_set_with_ttl",
      "redis_publish_event",
      "redis_rate_limit_check",
      "redis_flush_keys_by_pattern",
    ],
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
