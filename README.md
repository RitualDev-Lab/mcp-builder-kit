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

### 5. Automated Protocol Conformance Inspection (CI/CD)
```bash
npx @ritualdev_lab/mcp-builder-kit inspect "node dist/index.js"
```

### 6. Pre-Flight Security & Injection Audit
```bash
npx @ritualdev_lab/mcp-builder-kit audit ./src
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

## 💎 Enterprise Connectors & Ecosystem Services

`mcp-builder-kit` is open-source under Apache-2.0, with enterprise extensions, verified security certifications, and custom development available for production teams:

- **Enterprise Connector Starters ($39 – $99)**: Pre-built connectors for Postgres, Kubernetes, Stripe, and AWS with connection pooling and PII redaction (`mcp-builder packs`).
- **Verified Server Certification ($29 – $79)**: Cryptographic AgentShield zero-leak audit badges verified against repository commits (`mcp-builder badge`).
- **DevShelf Directory Spotlight ($49 – $149/mo)**: Promoted directory placement and developer showcase across 15,000+ AI builders (`mcp-builder spotlight`).
- **Turnkey B2B Engineering ($500 – $3,500)**: Bespoke production MCP server engineering, private VPC networking, and SLA guarantees (`mcp-builder turnkey`).
- **Foundation Grants & Polar Bounties**: Open-source ecosystem grant alignment and funded developer bounties (`mcp-builder grants`, `mcp-builder bounties`).

👉 **Explore full feature matrices and self-serve checkout at [mcp.ritualdev.in](https://mcp.ritualdev.in)**

---

## 🗺️ Roadmap & Architecture

- [x] **Architecture, Core Engine & Scaffolding CLI (`mcp-init`)**
- [x] **Intelligent Tool, Resource & OpenAPI Generators (`mcp-builder add-tool`, `from-openapi`)**
- [x] **Headless Mock Inspector & Conformance Test Suite (`mcp-builder inspect`)**
- [x] **AgentShield Security Audit, Entropy Detection & Zero-Leak Isolation (`mcp-builder audit`)**
- [x] **1-Click Packaging, Dockerization & Directory Publishing (`mcp-builder package`)**
- [x] **Enterprise Connectors & DevShelf Directory Spotlight (`mcp-builder packs`, `spotlight`)**
- [x] **Foundation Ecosystem Grants & Polar.sh Contributor Bounties (`mcp-builder grants`, `bounties`)**

---

## 👥 Maintainers & Contributors

Initiated and maintained with 💜 by [**RitualDev Lab**](https://github.com/RitualDev-Lab).

```text
Apache-2.0 License © 2026 RitualDev Lab
```
