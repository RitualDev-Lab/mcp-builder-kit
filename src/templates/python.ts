import { escapePythonDocstring } from "../generator.js";
import type { GeneratedFile, McpScaffoldOptions } from "../types.js";

export function toSafePythonPackageName(name: string): string {
  let pkg = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  while (pkg.startsWith("_")) {
    pkg = pkg.slice(1);
  }
  while (pkg.endsWith("_")) {
    pkg = pkg.slice(0, -1);
  }
  if (!pkg) {
    pkg = "mcp_server";
  }
  if (/^[0-9]/.test(pkg)) {
    pkg = `mcp_${pkg}`;
  }
  return pkg;
}

export function generatePythonTemplate(options: McpScaffoldOptions): GeneratedFile[] {
  const name = toSafePythonPackageName(options.projectName);
  const description = options.description || "High-performance FastMCP Server in Python";
  const author = options.author || "RitualDev Lab";
  const transport = options.transport || "stdio";
  const includeAgentShield = Boolean(options.includeAgentShield);
  const monetize = options.monetize;
  const fastMcpTransport = transport === "streamable-http" ? "streamable-http" : transport === "sse" ? "sse" : "stdio";

  const safeDescription = description.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const pyprojectToml = `[project]
name = "${name}"
version = "0.1.0"
description = "${safeDescription}"
readme = "README.md"
requires-python = ">=3.10"
dependencies = [
    "mcp[cli]>=1.3.0",
    "pydantic>=2.0.0",
]

[project.scripts]
${name} = "${name}.server:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
`;

  const serverPy = `"""
${name} - Model Context Protocol Server
${escapePythonDocstring(description)}
"""
import os
import re
import sys
import platform
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field
${monetize ? `from ${name}.monetize import verify_license\n` : ""}

${
  includeAgentShield
    ? `_AGENTSHIELD_PATTERNS = [
    re.compile(r"\\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,160}\\b"),
    re.compile(r"\\b(?:AKIA|ASIA|AIDA|AROA)[0-9A-Z]{16}\\b"),
    re.compile(r"\\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,64}\\b"),
]

def redact_secrets(text: str) -> str:
    sanitized = text
    for pattern in _AGENTSHIELD_PATTERNS:
        sanitized = pattern.sub("[AGENTSHIELD_REDACTED]", sanitized)
    return sanitized
`
    : ""
}
# Initialize FastMCP Server
mcp = FastMCP(
    name="${name}",
    dependencies=["pydantic"],
)

class EchoInput(BaseModel):
    message: str = Field(description="The text message to echo back")

@mcp.tool()
def echo(message: str) -> str:
    """Echoes input back with execution status"""
${monetize ? `    allowed, err = verify_license(os.getenv("MCP_ACTIVE_LICENSE_KEY", ""))\n    if not allowed:\n        return err\n` : ""}    payload = f"[Echo]: {message}"
    return ${includeAgentShield ? "redact_secrets(payload)" : "payload"}

@mcp.tool()
def system_info() -> dict:
    """Provides execution platform statistics and Python runtime information"""
    return {
        "platform": platform.platform(),
        "python_version": sys.version,
        "server": "${name}",
        "os": os.name,
    }

@mcp.resource("${name}://metadata")
def get_metadata() -> str:
    """Server metadata resource"""
    return f"MCP Server: ${name}\\nDescription: ${description}"

def main():
    mcp.run(transport="${fastMcpTransport}")

if __name__ == "__main__":
    main()
`;

  const testPy = `import pytest
from ${name}.server import echo, system_info

def test_echo():
    result = echo("hello world")
    assert result == "[Echo]: hello world"

def test_system_info():
    info = system_info()
    assert "platform" in info
    assert info["server"] == "${name}"
`;

  const readme = `# ${name}

> ${description}

Built with [**mcp-builder-kit**](https://github.com/RitualDev-Lab/mcp-builder-kit) — FastMCP Python template.

---

## ⚡ Quick Start

\`\`\`bash
# 1. Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\\Scripts\\activate

# 2. Install dependencies
pip install -e .

# 3. Run test suite
pytest
\`\`\`

---

## 🔌 Client Integration

### Claude Desktop (\`claude_desktop_config.json\`)

\`\`\`json
{
  "mcpServers": {
    "${name}": {
      "command": "python",
      "args": ["-m", "${name}.server"]
    }
  }
}
\`\`\`

---

## 📜 License

MIT © ${author}
`;

  const generated: GeneratedFile[] = [
    { path: "pyproject.toml", content: pyprojectToml },
    { path: `${name}/__init__.py`, content: `"""${name} package"""\n__version__ = "0.1.0"\n` },
    { path: `${name}/server.py`, content: serverPy },
    { path: "tests/__init__.py", content: "" },
    { path: "tests/test_server.py", content: testPy },
    { path: "README.md", content: readme },
    { path: ".gitignore", content: "__pycache__/\n*.py[cod]\n.venv/\nvenv/\n*.egg-info/\ndist/\n.pytest_cache/\n" },
  ];

  if (monetize) {
    const checkoutUrl =
      monetize === "stripe"
        ? "https://buy.stripe.com/your_price_link"
        : "https://checkout.dodopayments.com/buy/your_product_id";
    const monetizePy = `"""MCP Monetize Paywall Middleware (${monetize})"""
import hmac
import os

PROVIDER = "${monetize}"
DEFAULT_CHECKOUT_URL = "${checkoutUrl}"
_FREE_CALLS = 0


def verify_license(license_key: str) -> tuple[bool, str]:
    global _FREE_CALLS
    raw_keys = os.getenv("MCP_LICENSE_KEYS", "")
    valid_keys = [k.strip() for k in raw_keys.split(",") if k.strip()]
    enforce = os.getenv("MONETIZE_ENFORCE", "").lower() == "true" or bool(valid_keys)
    checkout = os.getenv("MCP_CHECKOUT_URL", DEFAULT_CHECKOUT_URL)

    if license_key and any(hmac.compare_digest(license_key, k) for k in valid_keys):
        return True, ""

    if not enforce:
        _FREE_CALLS += 1
        if _FREE_CALLS <= int(os.getenv("MCP_FREE_QUOTA", "10")):
            return True, ""

    return False, f"402 Payment Required ({PROVIDER}): subscribe at {checkout}"
`;
    generated.push({ path: `${name}/monetize.py`, content: monetizePy });
  }

  return generated;
}
