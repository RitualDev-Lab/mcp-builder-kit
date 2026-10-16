<p align="center">
  <img src="https://img.shields.io/badge/MCP-Model%20Context%20Protocol-8b5cf6?style=for-the-badge&logo=anthropic&logoColor=white" alt="MCP" />
  <img src="https://img.shields.io/badge/TypeScript-Ready-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Python-FastMCP-3776ab?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <a href="https://github.com/RitualDev-Lab/mcp-builder-kit/actions/workflows/test.yml"><img src="https://github.com/RitualDev-Lab/mcp-builder-kit/actions/workflows/test.yml/badge.svg" alt="CI Tests" /></a>
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

- ⚡ **1-Command Scaffolding**: Run `npx @ritualdev-lab/mcp-builder-kit init <name>` to generate a complete, battle-tested MCP server.
- 🌐 **Dual Language Support**:
  - **TypeScript**: `@modelcontextprotocol/sdk` + Zod schemas + `tsup` bundler + Biome linter.
  - **Python**: `mcp[cli]` + FastMCP + Pydantic v2.
- 🔌 **Universal Transports**: Production-ready `stdio` (Desktop/Agents), `sse` (Server-Sent Events), and modern **Streamable HTTP** endpoints for serverless & container fleets.
- 🧩 **Built-in Primitives**: Fully wired Tool listings, Tool callers, Resources, and Metadata endpoints.
- 🛡️ **Antigravity Skill Native**: Includes a first-class [`SKILL.md`](SKILL.md) for autonomous agent execution.

---

## ⚡ Quick Start

### 1. Scaffold a TypeScript MCP Server
```bash
npx @ritualdev-lab/mcp-builder-kit init my-tools-server
```

### 2. Scaffold a Python FastMCP Server
```bash
npx @ritualdev-lab/mcp-builder-kit init my-tools-server --lang python
```

### 3. Add a New Typed Tool to Your MCP Server
```bash
npx @ritualdev-lab/mcp-builder-kit add-tool search_knowledge \
  --desc "Search vector store for relevant documentation" \
  --params "query:string,limit:number,filter:object"
```

### 4. Convert OpenAPI / Swagger Spec into MCP Tools
```bash
npx @ritualdev-lab/mcp-builder-kit from-openapi ./petstore.json --lang typescript
```

### 5. Automated Protocol Conformance Inspection (CI/CD)
```bash
npx @ritualdev-lab/mcp-builder-kit inspect "node dist/index.js"
```

### 6. Pre-Flight Security & Injection Audit
```bash
npx @ritualdev-lab/mcp-builder-kit audit ./src
```

### 7. 1-Click Packaging & Containerization
```bash
# Generate Dockerfile, Claude Desktop config, Cursor config, and mcp.json registry manifest
npx @ritualdev-lab/mcp-builder-kit package ./my-server --lang typescript --port 8080 --env "OPENAI_API_KEY,DB_HOST"
```

---

## 💻 CLI Commands & Options

```text
Commands:
  init [name]              Scaffolds a new MCP server project (interactive wizard if omitted; use --force to overwrite)
  add-tool <name>          Generates typed MCP tool code and JSON schema snippet
  from-openapi <path>      Converts OpenAPI / Swagger specs into executable MCP tools with real HTTP client requests
  inspect <command>        Connects headless inspector to verify MCP JSON-RPC protocol conformance (--ci)
  deploy                   Generates serverless Cloudflare Workers or Cloud Run container deployment
  ui                       Launches lightweight local Visual Inspector Web UI & live testing studio
  audit [dir]              Runs AgentShield Zero-Leak security audit on MCP server source code
  package [dir]            Generates Dockerfile, client configs (Claude/Cursor) & registry manifest
  packs [list|install]     Browse or install enterprise connector packs (Postgres, K8s, Stripe)
  badge <server-name>      Generates cryptographically verified AgentShield badge & checkout URL
  spotlight <server-name>  Generates DevShelf Featured Spotlight placement and Dodo checkout link
  turnkey [tier]           Initiates B2B turnkey custom MCP server development inquiry & deposit link
  grants [id]              Browse foundation ecosystem grants ($1k-$25k) and generate grant pitch
  bounties                 Browse funded open-source bounties with Polar.sh rewards
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
} from "@ritualdev-lab/mcp-builder-kit";

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

- **Enterprise Tool Packs ($49/pack)**: Production-hardened tool templates for Postgres, Kubernetes, Snowflake, and AWS with connection pooling and parameter sanitization (`npx @ritualdev-lab/mcp-builder-kit packs`).
- **Verified Server Certification & Spotlight ($79/server)**: Cryptographic AgentShield zero-leak audit badge verified against repository commits, bundled with DevShelf directory showcase (`npx @ritualdev-lab/mcp-builder-kit badge <name>`).
- **Turnkey B2B Engineering (From $1,750/project)**: Bespoke production MCP server engineering, private VPC networking, and SLA guarantees (`npx @ritualdev-lab/mcp-builder-kit turnkey starter`).
- **Ecosystem Grants & Bounties**: Connect to open-source foundation grant programs you can apply to ($1k–$25k) and funded developer bounties (`npx @ritualdev-lab/mcp-builder-kit grants`, `npx @ritualdev-lab/mcp-builder-kit bounties`).

👉 **Explore full feature matrices and self-serve checkout at [mcp.ritualdev.in](https://mcp.ritualdev.in)**

---

## 👥 Team & Contributors

MCP Builder Kit is initiated and maintained by the team at [RitualDev Lab](https://github.com/RitualDev-Lab) and expanded by the open-source MCP community.

### 🛡️ Core Team & Direct Access Admins

<table align="center">
  <tr>
    <td align="center" width="180">
      <a href="https://github.com/divyanshujethi">
        <img src="https://github.com/divyanshujethi.png" width="80" style="border-radius: 50%;" alt="Divyanshu Jethi"/><br />
        <sub><b>Divyanshu Jethi</b></sub>
      </a><br />
      <sub>🚀 Founder &amp; Lead</sub><br />
      <sub>🔑 <b>Direct Access Admin</b></sub>
    </td>
    <td align="center" width="180">
      <a href="https://github.com/Sakshisharma1616">
        <img src="https://github.com/Sakshisharma1616.png" width="80" style="border-radius: 50%;" alt="Sakshi Sharma"/><br />
        <sub><b>Sakshi Sharma</b></sub>
      </a><br />
      <sub>🎨 Core Maintainer &amp; Product</sub><br />
      <sub>🔑 <b>Direct Access Admin</b></sub>
    </td>
    <td align="center" width="180">
      <a href="https://github.com/Ritual-Dev-Git">
        <img src="https://github.com/Ritual-Dev-Git.png" width="80" style="border-radius: 50%;" alt="RitualDev"/><br />
        <sub><b>RitualDev</b></sub>
      </a><br />
      <sub>⚙️ Core Maintainer &amp; Infra</sub><br />
      <sub>🔑 <b>Direct Access Admin</b></sub>
    </td>
    <td align="center" width="180">
      <a href="https://github.com/Divyanshu-hub-dotcom">
        <img src="https://github.com/Divyanshu-hub-dotcom.png" width="80" style="border-radius: 50%;" alt="Divyanshu-hub-dotcom"/><br />
        <sub><b>Divyanshu-hub-dotcom</b></sub>
      </a><br />
      <sub>🛠️ Core Member</sub>
    </td>
    <td align="center" width="180">
      <a href="https://github.com/ayushxx01">
        <img src="https://github.com/ayushxx01.png" width="80" style="border-radius: 50%;" alt="Ayush"/><br />
        <sub><b>Ayush</b></sub>
      </a><br />
      <sub>🛡️ Core Maintainer &amp; Triage</sub>
    </td>
  </tr>
</table>

### 🌟 Community Contributors & Builders

<p align="center">
  <a href="https://github.com/RitualDev-Lab/mcp-builder-kit/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=RitualDev-Lab/mcp-builder-kit" alt="MCP Builder Kit Contributors" />
  </a>
</p>

<p align="center">
  Huge thanks to all our open-source <a href="https://github.com/RitualDev-Lab/mcp-builder-kit/graphs/contributors">Contributors</a>! We warmly welcome issues, feedback, and pull requests.
</p>

```text
Apache-2.0 License © 2026 RitualDev Lab
```
