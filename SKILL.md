---
name: mcp-builder-kit
description: Production Toolkit & Scaffolding Engine for Model Context Protocol (MCP) Servers
version: 0.1.0
author: RitualDev Lab
license: Apache-2.0
---

# `mcp-builder-kit` Skill

Use this skill when you or an AI agent needs to build, scaffold, inspect, test, or containerize Model Context Protocol (MCP) servers for Claude Desktop, Antigravity, Cursor, Continue.dev, or enterprise backend services.

---

## ⚡ Scaffolding an MCP Server

Run the `mcp-builder` CLI or import the TypeScript engine directly:

### 1. TypeScript MCP Server
```bash
npx @ritualdev-lab/mcp-builder-kit init <server-name> --lang typescript --transport stdio
```

This scaffolds:
- `@modelcontextprotocol/sdk` + Zod schema validation
- Pre-configured `echo` and `system_info` tool handlers
- Dynamic MCP resource endpoints (`server://metadata`)
- Dual-target compilation via `tsup`
- Ready-to-run tests with Node.js test runner (`tsx --test`)
- Formatted configuration snippet for `claude_desktop_config.json` and Antigravity

### 2. Python FastMCP Server
```bash
npx @ritualdev-lab/mcp-builder-kit init <server-name> --lang python
```

This scaffolds:
- `mcp[cli]` + `FastMCP` decorator engine + Pydantic v2
- Tool functions with automatic docstring and typing inference
- Pre-configured Pytest test suite

---

## 📦 Programmatic Usage

```typescript
import { McpProjectScaffolder } from "@ritualdev-lab/mcp-builder-kit";

const result = McpProjectScaffolder.scaffold({
  projectName: "postgres-mcp",
  targetDir: "./servers/postgres-mcp",
  language: "typescript",
  transport: "stdio",
  description: "Postgres query and schema inspection MCP server",
});

console.log("Scaffolded files:", result.filesCreated);
```
