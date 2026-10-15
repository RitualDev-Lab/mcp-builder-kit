# Contributing to mcp-builder-kit

Thank you for your interest in contributing to **mcp-builder-kit**! We welcome community contributions to expand MCP server scaffolding, improve tool and resource generators, harden security audits, and enhance JSON-RPC protocol conformance.

## 🛠️ Development Setup

The project uses Node.js (>=20) and `pnpm`:

```bash
# Clone the repository
git clone https://github.com/RitualDev-Lab/mcp-builder-kit.git
cd mcp-builder-kit

# Install dependencies
pnpm install

# Run the test suite
pnpm test

# Check code formatting & linting
pnpm run lint

# Build the TypeScript distribution
pnpm run build
```

## 📋 Architectural Principles

1. **Protocol Conformance**: All generated MCP servers and mock inspectors must strictly conform to the official Model Context Protocol JSON-RPC specification.
2. **Dual-Language Parity**: Whenever adding tool scaffolding features, maintain parity between TypeScript (`@modelcontextprotocol/sdk`) and Python (`FastMCP`).
3. **Security First**: Pre-flight security audits (`audit`) must follow Shannon entropy standards and zero-leak path isolation rules to keep sensitive credentials out of prompt context.
4. **Clean Builds**: Always verify `pnpm test` and `pnpm run lint` pass before submitting pull requests.

## 🚀 Submitting Contributions

1. Fork the repository and create a feature branch (`git checkout -b feat/my-improvement`).
2. Add relevant unit tests under `tests/` covering new CLI options, generators, or conformance checks.
3. Commit with semantic conventional commit messages (`feat: ...`, `fix: ...`, `docs: ...`).
4. Submit a Pull Request to `main` with a clear explanation of what was added or fixed.

---

## 🏛️ Project Governance & Direct Access Admins

MCP Builder Kit is governed by [RitualDev Lab](https://github.com/RitualDev-Lab). Core releases, signing keys, and repository admin controls are managed by our **Direct Access Admins**:

- **Divyanshu Jethi** ([@divyanshujethi](https://github.com/divyanshujethi)) &mdash; Founder & Lead
- **Sakshi Sharma** ([@Sakshisharma1616](https://github.com/Sakshisharma1616)) &mdash; Core Maintainer & Product
- **RitualDev** ([@Ritual-Dev-Git](https://github.com/Ritual-Dev-Git)) &mdash; Core Maintainer & Infra

