import type {
  FoundationGrantProgram,
  GrantsAndBountiesCatalog,
  OpenSourceBountyItem,
} from "./types.js";

export const FOUNDATION_GRANTS: FoundationGrantProgram[] = [
  {
    id: "anthropic-alignment-ecosystem",
    name: "Anthropic Model Context Protocol Ecosystem Fund",
    organization: "Anthropic / Claude Builder Collective",
    grantRangeUsd: "$5,000 – $25,000",
    focusArea:
      "Open protocol developer tooling, enterprise security benchmarks, and zero-leak isolation sandboxes for MCP clients.",
    applicationUrl: "https://www.anthropic.com/programs",
    requirements: [
      "Open-source Apache-2.0 or MIT licensed core",
      "Full JSON-RPC 2.0 MCP protocol conformance",
      "Comprehensive AgentShield security audit report",
    ],
    recommendedPitch:
      "mcp-builder-kit accelerates open standard agentic MCP adoption by providing zero-configuration scaffolding, security scanning, and automated verification suites for the next generation of Claude Desktop and IDE agent workflows.",
  },
  {
    id: "gitcoin-grants-ai-oss",
    name: "Gitcoin / Open Source AI Infrastructure Rounds",
    organization: "Gitcoin / Open Civics",
    grantRangeUsd: "$2,500 – $15,000",
    focusArea:
      "Decentralized, open-source AI developer tooling and interoperable agent protocol building blocks.",
    applicationUrl: "https://grants.gitcoin.co",
    requirements: [
      "Public GitHub repository with verifiable commit history",
      "Active developer traction and multi-language support (TS & Python)",
      "Zero vendor lock-in with standard stdio / SSE transports",
    ],
    recommendedPitch:
      "A public good toolchain lowering the barrier to building high-conformance, secure Model Context Protocol servers for independent developers and organizations worldwide.",
  },
  {
    id: "github-innovation-graph",
    name: "GitHub Accelerator & Open Source AI Grants",
    organization: "GitHub / Microsoft for Startups",
    grantRangeUsd: "$5,000 – $20,000",
    focusArea:
      "Developer productivity tools integrating natively with Cursor, Copilot, and agentic IDE extensions.",
    applicationUrl: "https://accelerator.github.com",
    requirements: [
      "SLSA Level 3 supply-chain security compliance",
      "One-click packaging for multi-IDE environments",
      "Demonstrated developer velocity and community contributors",
    ],
    recommendedPitch:
      "Empowering developers to spin up verifiable, type-safe MCP servers with built-in zero-leak security audits, ready to deploy directly to GitHub Packages and Docker Hub.",
  },
];

export const OPEN_SOURCE_BOUNTIES: OpenSourceBountyItem[] = [
  {
    id: "bounty-rust-fastmcp-generator",
    title: "Rust rmcp / FastMCP Native Server Generator",
    rewardUsd: 1200,
    difficulty: "advanced",
    category: "connector",
    description:
      "Implement high-performance Rust MCP code generator template supporting Tokio async runtime and serde_json schemas.",
    claimUrl: "https://polar.sh/RitualDev-Lab/mcp-builder-kit/issues/1",
    sponsor: "RitualDev Open Source Guild",
  },
  {
    id: "bounty-dynamic-wasm-sandbox",
    title: "WebAssembly (Wasm) Micro-Sandbox for Untrusted Tools",
    rewardUsd: 1500,
    difficulty: "advanced",
    category: "security",
    description:
      "Integrate Wasmtime/WasmEdge execution isolation layer inside AgentShield to run untrusted MCP dynamic tools with zero file-system leakage.",
    claimUrl: "https://polar.sh/RitualDev-Lab/mcp-builder-kit/issues/2",
    sponsor: "AgentShield Security Fund",
  },
  {
    id: "bounty-graphql-to-mcp",
    title: "GraphQL Schema to MCP Tools & Resources Auto-Mapper",
    rewardUsd: 800,
    difficulty: "intermediate",
    category: "connector",
    description:
      "Build an introspective GraphQL AST parser that compiles queries and mutations directly into strongly typed MCP tool declarations.",
    claimUrl: "https://polar.sh/RitualDev-Lab/mcp-builder-kit/issues/3",
    sponsor: "RitualDev Developer Ecosystem",
  },
  {
    id: "bounty-browser-sse-inspector-ui",
    title: "Interactive Web UI for Mock Inspector (SSE & stdio)",
    rewardUsd: 650,
    difficulty: "intermediate",
    category: "testing",
    description:
      "Create an interactive lightweight Vite/Preact local browser dashboard for visual tool execution, latency profiling, and protocol logging.",
    claimUrl: "https://polar.sh/RitualDev-Lab/mcp-builder-kit/issues/4",
    sponsor: "DevShelf Directory Spotlight",
  },
];

// biome-ignore lint/complexity/noStaticOnlyClass: Grants utility class
export class GrantsAndBountiesService {
  public static getGrants(): FoundationGrantProgram[] {
    return FOUNDATION_GRANTS;
  }

  public static getBounties(): OpenSourceBountyItem[] {
    return OPEN_SOURCE_BOUNTIES;
  }

  public static getCatalog(): GrantsAndBountiesCatalog {
    return {
      grants: FOUNDATION_GRANTS,
      bounties: OPEN_SOURCE_BOUNTIES,
      githubSponsorsUrl: "https://github.com/sponsors/RitualDev-Lab",
      polarBountiesUrl: "https://polar.sh/RitualDev-Lab/mcp-builder-kit",
    };
  }

  public static generatePitchSummary(grantId?: string): string {
    const targetGrant = FOUNDATION_GRANTS.find((g) => g.id === grantId) ?? FOUNDATION_GRANTS[0];
    return [
      `# 🏛️ Grant Application Pitch & Narrative: ${targetGrant.name}`,
      "",
      `**Organization:** ${targetGrant.organization}`,
      `**Target Funding Range:** ${targetGrant.grantRangeUsd}`,
      `**Focus Area:** ${targetGrant.focusArea}`,
      `**Application Portal:** ${targetGrant.applicationUrl}`,
      "",
      "### Core Value Proposition:",
      `> ${targetGrant.recommendedPitch}`,
      "",
      "### Grant Eligibility Checklist:",
      ...targetGrant.requirements.map((r) => `- [x] ${r}`),
      "",
      "### Impact Metrics to Highlight:",
      "- 100% Protocol Conformance verified via headless JSON-RPC test runner",
      "- Integrated AgentShield AST static analysis preventing supply-chain leaks",
      "- Zero-lockin multi-language generation (TypeScript ESM + Python FastMCP)",
      "- Open GitHub Sponsors & Polar.sh bounties rewarding independent OSS contributors",
    ].join("\n");
  }
}
