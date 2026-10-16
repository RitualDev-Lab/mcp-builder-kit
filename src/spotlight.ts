import type { DevShelfSpotlightTier } from "./types.js";

/**
 * DevShelf Featured MCP Directory Spotlight Tiers ($49 – $149 / month)
 * Monitized via self-serve Dodo Payments checkout
 */
export const DEVSHELF_MCP_SPOTLIGHT_TIERS: Record<string, DevShelfSpotlightTier> = {
  "mcp-featured-monthly": {
    id: "pdt_devshelf_mcp_featured_monthly",
    name: "DevShelf Featured MCP Spotlight (Monthly)",
    priceUsd: 49,
    billingPeriod: "monthly",
    description:
      "Top sticky placement in the DevShelf MCP Directory, verified sponsor badge, and monthly newsletter highlight.",
    checkoutUrl:
      "https://checkout.dodopayments.com/buy/pdt_0NpjONGugY5QkrFDUaPva?placement=featured_monthly",
    features: [
      "Top sticky spotlight placement in DevShelf MCP Directory",
      "Official 'Featured on DevShelf' badge for repository",
      "Dedicated Social Media shoutout on X & LinkedIn via RitualDev Lab",
      "Guaranteed high-authority dofollow backlink to GitHub repo",
      "Inclusion in weekly AI Agent Tools digest",
    ],
  },
  "mcp-category-takeover": {
    id: "pdt_0NpjONGugY5QkrFDUaPva",
    name: "DevShelf MCP Category Exclusive Sponsor",
    priceUsd: 149,
    billingPeriod: "monthly",
    description:
      "Exclusive top banner banner takeover in your MCP category (Databases, DevOps, Search, or RAG) with direct user routing.",
    checkoutUrl:
      "https://checkout.dodopayments.com/buy/pdt_0NpjONGugY5QkrFDUaPva?placement=category_takeover",
    features: [
      "Exclusive #1 header banner takeover in your specific category",
      "Everything in Featured Monthly tier included",
      "Featured tool of the week in DevShelf newsletter (10,000+ developers)",
      "AgentShield Zero-Leak verification audit & verified SVG badge included",
      "Priority inclusion in Antigravity & Agentic AI assistant suggestions",
    ],
  },
};

/**
 * DevShelf Directory Spotlight Service
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Directory utility class
export class DevShelfSpotlightService {
  public static getTiers(): DevShelfSpotlightTier[] {
    return Object.values(DEVSHELF_MCP_SPOTLIGHT_TIERS);
  }

  public static getTier(tierId: string): DevShelfSpotlightTier | undefined {
    return DEVSHELF_MCP_SPOTLIGHT_TIERS[tierId];
  }

  /**
   * Generates custom DevShelf submission metadata and instant Dodo Payments checkout link
   */
  public static generateSpotlightSubmission(
    serverName: string,
    tierId = "mcp-featured-monthly",
  ): {
    tier: DevShelfSpotlightTier;
    serverName: string;
    checkoutUrl: string;
    featuredBadgeMarkdown: string;
    directorySubmitUrl: string;
  } {
    const tier =
      DEVSHELF_MCP_SPOTLIGHT_TIERS[tierId] || DEVSHELF_MCP_SPOTLIGHT_TIERS["mcp-featured-monthly"];
    const slug = encodeURIComponent(serverName.toLowerCase().replace(/\s+/g, "-"));
    const checkoutUrl = `${tier.checkoutUrl}&tool=${slug}`;
    const featuredBadgeMarkdown = `[![Featured on DevShelf](https://img.shields.io/badge/Featured%20on-DevShelf-7928CA?style=for-the-badge&logo=googlechrome&logoColor=white)](https://devshelf.ritualdev.in/mcp/${slug})`;
    const directorySubmitUrl =
      "https://github.com/RitualDev-Lab/DevShelf/issues/new?template=02_add_tool.yml";

    return {
      tier,
      serverName,
      checkoutUrl,
      featuredBadgeMarkdown,
      directorySubmitUrl,
    };
  }
}
