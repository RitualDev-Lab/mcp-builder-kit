# Developer Wiki: MCP Builder Kit Documentation Hub

Welcome to the **MCP Builder Kit Wiki**! This repository serves as the engineering reference and documentation for authoring, auditing, and distributing production-grade Model Context Protocol (MCP) servers.

---

## 📑 Wiki Navigation Table of Contents

1. [Architecture & Protocol Design](#1-architecture--protocol-design)
2. [CLI Reference & Commands](#2-cli-reference--commands)
3. [Building TypeScript MCP Servers](#3-building-typescript-mcp-servers)
4. [Building Python FastMCP Servers](#4-building-python-fastmcp-servers)
5. [OpenAPI to MCP Conversion Guide](#5-openapi-to-mcp-conversion-guide)
6. [AgentShield Zero-Leak Security Audit](#6-agentshield-zero-leak-security-audit)
7. [Automated CI/CD & Headless Mock Inspector](#7-automated-cicd--headless-mock-inspector)
8. [Dockerization & IDE Deployment (Claude, Cursor, Antigravity)](#8-dockerization--ide-deployment)
9. [Enterprise Monetization & Directory Spotlights](#9-enterprise-monetization--directory-spotlights)
10. [Community Sponsorship & Funded Bounties](#10-community-sponsorship--funded-bounties)

---

## 1. Architecture & Protocol Design

`mcp-builder-kit` implements the standard [Model Context Protocol (MCP)](https://modelcontextprotocol.io) specification over both `stdio` and `SSE` (Server-Sent Events) transports.

### Core Components
- **Scaffolder Engine (`src/scaffolder.ts`)**: Generates directory scaffolding with ESLint/Biome, TypeScript or Python runtimes.
- **Generator Engine (`src/generator.ts`)**: Compiles typed tool definitions into Zod schemas or Python Pydantic models.
- **Mock Inspector (`src/inspector.ts`)**: Headless JSON-RPC client verifying handshake, capabilities, tool calls, and error codes.
- **AgentShield Audit (`src/security.ts`)**: AST static analysis detecting command injections, hardcoded secrets, and directory traversals.
- **Multi-IDE Packager (`src/packager.ts`)**: Generates optimized Dockerfiles, Claude Desktop `claude_desktop_config.json`, Cursor configs, and registry manifests.

---

## 2. CLI Reference & Commands

```bash
# Initialize a new MCP server
npx @ritualdev-lab/mcp-builder-kit init <project-name> [--lang typescript|python] [--transport stdio|sse]

# Add a typed tool with validation
npx @ritualdev-lab/mcp-builder-kit add-tool <tool-name> --desc "Tool description" --params "query:string,limit:number"

# Compile OpenAPI / Swagger into tools
npx @ritualdev-lab/mcp-builder-kit from-openapi ./spec.json --lang typescript

# Run headless protocol inspector in CI
npx @ritualdev-lab/mcp-builder-kit inspect "node dist/index.js"

# Run security audit on source directory
npx @ritualdev-lab/mcp-builder-kit audit ./src

# Generate Dockerfile and client IDE configs
npx @ritualdev-lab/mcp-builder-kit package .

# Certified security badges & DevShelf directory spotlight
npx @ritualdev-lab/mcp-builder-kit badge my-server --tier verified
npx @ritualdev-lab/mcp-builder-kit spotlight my-server --tier mcp-featured-monthly

# Turnkey B2B custom development inquiry
npx @ritualdev-lab/mcp-builder-kit turnkey starter --client "Acme Corp"

# Foundation ecosystem grants and developer bounties
npx @ritualdev-lab/mcp-builder-kit grants
npx @ritualdev-lab/mcp-builder-kit bounties
```

---

## 3. AgentShield Zero-Leak Security Audit

AgentShield prevents insecure MCP server implementations that expose local files or execute arbitrary shell commands.

### Detection Rules:
- **`hardcoded_secret`**: API keys, tokens, or JWTs embedded directly in tool code.
- **`command_injection`**: Unsanitized parameters passed to `child_process.exec()`, `execSync()`, or Python `subprocess.Popen(shell=True)`.
- **`path_traversal`**: File path parameters missing root resolution or using unvalidated `../` sequences.
- **`wildcard_permission`**: Unrestricted network or filesystem capabilities requested in server manifests.

AgentShield automatically outputs a zero-leak parameter sanitizer middleware (`agent-shield-middleware.ts`) that strips malicious shell metacharacters and directory traversal paths at runtime.

---

## 4. Community Sponsorship & Discussions

We welcome developer contributions, feature requests, and community discussions:
- **GitHub Discussions**: [Ask questions, propose RFCs, and showcase your MCP servers](https://github.com/RitualDev-Lab/mcp-builder-kit/discussions)
- **GitHub Sponsors**: [Support our open-source maintainers](https://github.com/sponsors/RitualDev-Lab)
- **Polar.sh Bounties**: [Earn rewards for implementing feature bounties](https://polar.sh/RitualDev-Lab/mcp-builder-kit)
- **Direct Portal**: [Visit the official web portal at mcp.ritualdev.in](https://mcp.ritualdev.in)
