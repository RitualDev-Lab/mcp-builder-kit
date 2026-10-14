<p align="center">
  <img src="https://img.shields.io/badge/MCP-Model%20Context%20Protocol-8b5cf6?style=for-the-badge&logo=anthropic&logoColor=white" alt="MCP" />
  <img src="https://img.shields.io/badge/TypeScript-Ready-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Python-FastMCP-3776ab?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/License-Apache--2.0-blue?style=for-the-badge" alt="License" />
</p>

<h1 align="center">🛠️ mcp-builder-kit</h1>

<p align="center">
  <b>Production Toolkit & Scaffolding Engine for Model Context Protocol (MCP) Servers.</b><br/>
  Scaffold typed TypeScript & FastMCP Python servers, generate tools from OpenAPI, run headless inspectors, and deploy to Claude Desktop, Antigravity, and Cursor in seconds.
</p>

<p align="center">
  <a href="https://mcp.ritualdev.in"><b>🌐 Website & Docs</b></a> •
  <a href="https://github.com/RitualDev-Lab/mcp-builder-kit/wiki"><b>📚 Developer Wiki</b></a> •
  <a href="https://github.com/RitualDev-Lab/mcp-builder-kit/discussions"><b>💬 Discussions</b></a> •
  <a href="https://github.com/sponsors/RitualDev-Lab"><b>💜 Sponsor</b></a> •
  <a href="https://polar.sh/RitualDev-Lab/mcp-builder-kit"><b>⚡ Bounties</b></a>
</p>

---

## 🚀 Features

- ⚡ **1-Command Scaffolding**: Run `npx @ritualdev_lab/mcp-builder-kit init <name>` to generate a complete, battle-tested MCP server.
- 🌐 **Dual Language Support**:
  - **TypeScript**: `@modelcontextprotocol/sdk` + Zod schemas + `tsup` bundler + Biome linter.
  - **Python**: `mcp[cli]` + FastMCP + Pydantic v2.
- 🔌 **Dual Transports**: Ready-to-go `stdio` (Desktop/Agents) and `sse` (Remote/Docker).
- 🧩 **Built-in Primitives**: Fully wired Tool listings, Tool callers, Resources, and Metadata endpoints.
- 🛡️ **Antigravity Skill Native**: Includes a first-class [`SKILL.md`](SKILL.md) for autonomous agent execution.

---

## ⚡ Quick Start

### 1. Scaffold a TypeScript MCP Server
```bash
npx @ritualdev_lab/mcp-builder-kit init my-tools-server
```

### 2. Scaffold a Python FastMCP Server
```bash
npx @ritualdev_lab/mcp-builder-kit init my-tools-server --lang python
```

### 3. Add a New Typed Tool to Your MCP Server
```bash
npx @ritualdev_lab/mcp-builder-kit add-tool search_knowledge \
  --desc "Search vector store for relevant documentation" \
  --params "query:string,limit:number,filter:object"
```

### 4. Convert OpenAPI / Swagger Spec into MCP Tools
```bash
npx @ritualdev_lab/mcp-builder-kit from-openapi ./petstore.json --lang typescript
```

### 7. 1-Click Packaging & Containerization
```bash
# Generate Dockerfile, Claude Desktop config, Cursor config, and mcp.json registry manifest
npx @ritualdev_lab/mcp-builder-kit package ./my-server --lang typescript --port 8080 --env "OPENAI_API_KEY,DB_HOST"
```

---

## 💻 CLI Commands & Options

```text
Commands:
  init <name>              Scaffolds a new MCP server project
  add-tool <name>          Generates typed MCP tool code and JSON schema snippet
  from-openapi <path>      Converts an OpenAPI / Swagger spec into production MCP tools
  inspect <command>        Connects headless inspector to verify MCP JSON-RPC protocol conformance
  audit [dir]              Runs AgentShield Zero-Leak security audit on MCP server source code
  package [dir]            Generates Dockerfile, client configs (Claude/Cursor) & registry manifest
```

---

## 🧩 Programmatic SDK

```typescript
import {
  McpProjectScaffolder,
  McpCodeGenerator,
  OpenApiToMcpConverter,
  McpServerInspector,
  AgentShieldMcpAuditor,
  McpServerPackager,
} from "@ritualdev_lab/mcp-builder-kit";

// 1. Scaffold a project
const result = McpProjectScaffolder.scaffold({
  projectName: "sqlite-explorer",
  targetDir: "./servers/sqlite-explorer",
  language: "typescript",
  transport: "stdio",
  description: "SQLite database explorer MCP server",
});

// 2. Generate tool code dynamically
const toolCode = McpCodeGenerator.generateTypeScriptTool({
  name: "execute_query",
  description: "Runs a read-only SQL query on the database",
  parameters: [{ name: "sql", type: "string", required: true, description: "SQL query statement" }],
});

// 3. Convert an OpenAPI spec
const mcpTools = OpenApiToMcpConverter.convert({
  spec: mySwaggerJson,
  language: "typescript",
});

// 4. Headless Conformance Inspector
const inspector = new McpServerInspector({
  command: "node",
  args: ["./dist/index.js"],
});
const report = await inspector.inspect();
console.log(`Discovered ${report.discoveredTools.length} tools, latency: ${report.latencyMs}ms`);

// 5. AgentShield Pre-Flight Security Audit
const audit = AgentShieldMcpAuditor.auditDirectory("./src");
console.log(`Security Score: ${audit.score}/100, isSecure: ${audit.isSecure}`);

// 6. 1-Click Packaging & Dockerization
const pkg = McpServerPackager.package({
  serverName: "sqlite-explorer",
  targetDir: "./servers/sqlite-explorer",
  language: "typescript",
  port: 8080,
});
console.log(`Generated artifacts: ${pkg.writtenFiles.join(", ")}`);
```

---

## 💎 Enterprise MCP Connector Packs (Self-Serve via Dodo Payments)

Accelerate production deployments with battle-tested, pre-built enterprise connectors featuring connection pooling, PII redaction, and IAM least-privilege scoping:

| Pack | Focus | Highlights | Price | Checkout |
| :--- | :--- | :--- | :---: | :---: |
| **Enterprise Database Pack** | Postgres, MongoDB, ClickHouse, Redis | Connection pooling, AST read-only safety gate, sensitive column redaction | **$49** | [**Instant Checkout →**](https://checkout.dodopayments.com/buy/pdt_mcp_database_pack?quantity=1) |
| **Cloud & DevOps Pack** | AWS, GCP, Docker, Kubernetes, GitHub | Pod log inspection, S3 presigned URLs, CI/CD dispatch, container lifecycle | **$49** | [**Instant Checkout →**](https://checkout.dodopayments.com/buy/pdt_mcp_devops_pack?quantity=1) |
| **Fintech & SaaS Pack** | Stripe, Dodo Payments, Slack, HubSpot | Payment intents, webhook verification, CRM search, incident broadcast | **$39** | [**Instant Checkout →**](https://checkout.dodopayments.com/buy/pdt_mcp_fintech_pack?quantity=1) |
| **All-Access Bundle** | All current & future packs | Lifetime updates, 25+ connectors, priority Discord engineering support | **$99** | [**Instant Checkout →**](https://checkout.dodopayments.com/buy/pdt_mcp_all_access?quantity=1) |

```bash
# Browse all packs in terminal
npx @ritualdev_lab/mcp-builder-kit packs list

# Install preview stubs or unlock with your enterprise license
npx @ritualdev_lab/mcp-builder-kit packs install enterprise-database-pack
```

---

## 🛡️ "Verified Secure MCP Server" Certification & Badges ($29 – $79)

Display an official cryptographic security audit badge on your MCP server's `README.md` to prove zero-leak compliance to users and enterprise clients:

[![Verified Secure MCP Server](https://img.shields.io/badge/Verified%20MCP%20Server-AgentShield%20Zero--Leak-8b5cf6?logo=shield&logoColor=white&style=flat-square)](https://agentshield.ritualdev.in/verify/sample)
[![Verified MCP Sponsor](https://img.shields.io/badge/Verified%20MCP%20Server-AgentShield%20%E2%98%85%20Sponsor-ec4899?logo=shield&logoColor=white&style=flat-square)](https://agentshield.ritualdev.in/verify/sample)

| Certification Tier | Price | Verification Includes | Self-Serve Checkout |
| :--- | :---: | :--- | :---: |
| **Verified Zero-Leak Badge** | **$29** (one-time) | Cryptographic HMAC audit record, dynamic SVG badge, Zero-Leak pass certification | [**Claim Verified Badge ($29) →**](https://checkout.dodopayments.com/buy/pdt_agentshield_verified_badge?tier=verified&price=29) |
| **Sponsor ★ Top Placement** | **$79** (one-time) | Verified Zero-Leak audit, pink Sponsor ★ badge, featured spotlight listing on DevShelf | [**Claim Sponsor Badge ($79) →**](https://checkout.dodopayments.com/buy/pdt_agentshield_verified_badge?tier=sponsor&price=79) |

```bash
# Generate verified badge markdown snippet and checkout link
npx @ritualdev_lab/mcp-builder-kit badge my-server-name --tier verified
```

---

## 🌟 DevShelf Featured MCP Directory Spotlight ($49 – $149 / month)

Get maximum reach, traffic, and client discovery for your custom MCP server across 15,000+ AI developers and agentic engineers on [**DevShelf MCP Directory**](https://devshelf.ritualdev.in):

[![Featured on DevShelf](https://img.shields.io/badge/Featured%20on-DevShelf%20MCP%20Directory-6366f1?logo=sparkles&logoColor=white&style=flat-square)](https://devshelf.ritualdev.in/mcp/featured)

| Spotlight Tier | Price | Placement & Perks | Self-Serve Checkout |
| :--- | :---: | :--- | :---: |
| **Featured Monthly** | **$49 / mo** | Top 10 directory carousel placement, "Featured on DevShelf" badge, monthly traffic digest | [**Get Featured Monthly ($49/mo) →**](https://checkout.dodopayments.com/buy/pdt_devshelf_mcp_featured_monthly?tier=mcp-featured-monthly&price=49) |
| **Category Exclusive Takeover** | **$149 / mo** | #1 sticky placement across category, Hero banner highlight, weekly email blast spotlight | [**Get Category Takeover ($149/mo) →**](https://checkout.dodopayments.com/buy/pdt_devshelf_mcp_category_takeover?tier=mcp-category-takeover&price=149) |

```bash
# View spotlight tiers and generate direct checkout submission
npx @ritualdev_lab/mcp-builder-kit spotlight my-server-name --tier mcp-featured-monthly
```

---

## 🛠️ Stream 4: B2B "Turnkey MCP Server" Custom Development ($500 – $3,500)

Need a bespoke, production-ready MCP server custom-built for internal microservices, private VPCs, legacy databases, or proprietary enterprise SaaS? RitualDev Lab engineers build, test, certify, and containerize your complete MCP server turnkey.

| Package | Investment | Delivery SLA | Key Deliverables & Warranty | Self-Serve Milestone Deposit |
| :--- | :---: | :---: | :--- | :---: |
| **Starter Turnkey** | **$500** | 48 - 72 Hours | 1-3 typed tools/resources, mock inspector test suite, AgentShield Zero-Leak certification, Docker configs, 7-day warranty | [**Reserve Starter ($250 Deposit) →**](https://checkout.dodopayments.com/buy/pdt_turnkey_starter_deposit?tier=starter&deposit=250) |
| **Professional Multi-API** | **$1,500** | 5 - 7 Days | Up to 10 tools, OAuth2/credential rotation, dynamic resource streaming, Kubernetes manifests, 14-day dedicated support | [**Reserve Pro ($750 Deposit) →**](https://checkout.dodopayments.com/buy/pdt_turnkey_pro_deposit?tier=pro&deposit=750) |
| **Enterprise Custom Architecture** | **$3,500** | 10 - 14 Days | Unlimited tools/prompts, private VPC/air-gapped deployment, strict RBAC, SLSA L3 provenance, DevShelf 3mo spotlight, 30-day Slack SLA | [**Reserve Enterprise ($1,750 Deposit) →**](https://checkout.dodopayments.com/buy/pdt_turnkey_enterprise_deposit?tier=enterprise&deposit=1750) |

```bash
# Generate tailored project brief and direct booking deposit links
npx @ritualdev_lab/mcp-builder-kit turnkey starter --client "Acme AI" --company "Acme Corp"
npx @ritualdev_lab/mcp-builder-kit turnkey pro --overview "Salesforce and BigQuery MCP server"
```

---

## 🏛️ Stream 5: Foundation Grants & Open-Source Bounties ($1,000 – $25,000+)

`mcp-builder-kit` operates with dual-engine sustainability: commercial enterprise tooling paired with open-source foundation grants, ecosystem rounds, and funded contributor bounties.

### Active Ecosystem Grant Targets

| Program | Organization | Target Range | Focus & Eligibility | Grant Portal |
| :--- | :--- | :---: | :--- | :---: |
| **Anthropic MCP Ecosystem Fund** | Anthropic / Claude Builder Collective | **$5,000 – $25,000** | Open-standard protocol developer tooling, AgentShield zero-leak sandbox security | [**Apply via Anthropic →**](https://www.anthropic.com/programs) |
| **Gitcoin AI Infrastructure** | Gitcoin / Open Civics | **$2,500 – $15,000** | Decentralized agent building blocks, verifiable commits, multi-language tooling | [**View on Gitcoin →**](https://grants.gitcoin.co) |
| **GitHub Open Source AI Grants** | GitHub / Microsoft for Startups | **$5,000 – $20,000** | Native IDE integrations (Cursor/Copilot), SLSA Level 3 supply-chain security | [**View GitHub Accelerator →**](https://accelerator.github.com) |

### Active Contributor Bounties (Earn $650 – $1,500 via Polar.sh)

| Bounty Task | Reward | Difficulty | Claim Link |
| :--- | :---: | :---: | :---: |
| **Rust rmcp / FastMCP Native Server Generator** | **$1,200** | Advanced | [**Claim on Polar.sh #1 →**](https://polar.sh/RitualDev-Lab/mcp-builder-kit/issues/1) |
| **Wasm Micro-Sandbox for Untrusted Tools (AgentShield)** | **$1,500** | Advanced | [**Claim on Polar.sh #2 →**](https://polar.sh/RitualDev-Lab/mcp-builder-kit/issues/2) |
| **GraphQL Schema to MCP Tools & Resources Auto-Mapper** | **$800** | Intermediate | [**Claim on Polar.sh #3 →**](https://polar.sh/RitualDev-Lab/mcp-builder-kit/issues/3) |
| **Interactive Web UI for Mock Inspector (SSE & stdio)** | **$650** | Intermediate | [**Claim on Polar.sh #4 →**](https://polar.sh/RitualDev-Lab/mcp-builder-kit/issues/4) |

```bash
# Browse active grant programs or generate tailored grant pitch
npx @ritualdev_lab/mcp-builder-kit grants
npx @ritualdev_lab/mcp-builder-kit grants anthropic-alignment-ecosystem

# Browse funded open-source bounties
npx @ritualdev_lab/mcp-builder-kit bounties
```

---

## 🗺️ Roadmap & Phases

- [x] **Phase 1: Architecture, Core Engine & Scaffolding CLI (`mcp-init`)**
- [x] **Phase 2: Intelligent Tool, Resource & OpenAPI Generators (`mcp-builder add-tool`)**
- [x] **Phase 3: Headless Mock Inspector & Conformance Test Suite (`mcp-builder inspect`)**
- [x] **Phase 4: AgentShield Security Audit & Zero-Leak Isolation (`mcp-builder audit`)**
- [x] **Phase 5: 1-Click Packaging, Dockerization & Directory Publishing (`mcp-builder package`)**
- [x] **Phase 6: Enterprise Tool Starters & Self-Serve Dodo Payments Monetization (`mcp-builder packs`)**
- [x] **Phase 7: Verified Secure Server Badges & DevShelf Directory Spotlight (`mcp-builder badge`, `mcp-builder spotlight`)**
- [x] **Phase 8: B2B Turnkey Custom MCP Server Development & Inquiries (`mcp-builder turnkey`)**
- [x] **Phase 9: Foundation Ecosystem Grants & Polar.sh Contributor Bounties (`mcp-builder grants`, `mcp-builder bounties`)**

---

## 👥 Maintainers & Contributors

Initiated and maintained with 💜 by [**RitualDev Lab**](https://github.com/RitualDev-Lab).

```text
Apache-2.0 License © 2026 RitualDev Lab
```
