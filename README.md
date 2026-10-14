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

---

## 💻 CLI Commands & Options

```text
Commands:
  init <name>              Scaffolds a new MCP server project
  add-tool <name>          Generates typed MCP tool code and JSON schema snippet
  from-openapi <path>      Converts an OpenAPI / Swagger spec into production MCP tools

Options for 'init':
  --lang, -l               Language: 'typescript' (default) or 'python'
  --transport, -t          Transport: 'stdio' (default), 'sse', or 'both'
  --dir, -d                Target directory (defaults to ./<project-name>)
  --desc                   Short project description
  --author                 Author or organization name

Options for 'add-tool':
  --lang, -l               Output language: 'typescript' (default) or 'python'
  --desc                   Tool description
  --params                 Comma-separated list of paramName:type (e.g. "query:string,limit:number")
```

---

## 🧩 Programmatic SDK

```typescript
import { McpProjectScaffolder, McpCodeGenerator, OpenApiToMcpConverter } from "@ritualdev_lab/mcp-builder-kit";

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
```

---

## 🗺️ Roadmap & Phases

- [x] **Phase 1: Architecture, Core Engine & Scaffolding CLI (`mcp-init`)**
- [x] **Phase 2: Intelligent Tool, Resource & OpenAPI Generators (`mcp-builder add-tool`)**
- [ ] **Phase 3: Headless Mock Inspector & Conformance Test Suite (`mcp-builder inspect`)**
- [ ] **Phase 4: AgentShield Security Audit & Zero-Leak Isolation**
- [ ] **Phase 5: 1-Click Packaging, Dockerization & Directory Publishing**

---

## 👥 Maintainers & Contributors

Initiated and maintained with 💜 by [**RitualDev Lab**](https://github.com/RitualDev-Lab).

```text
Apache-2.0 License © 2026 RitualDev Lab
```
