import { escapePythonDocstring } from "../generator.js";
import type { GeneratedFile, McpScaffoldOptions } from "../types.js";

export function toSafePythonPackageName(name: string): string {
  let pkg = name.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "");
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

  const pyprojectToml = `[project]
name = "${name}"
version = "0.1.0"
description = "${description.replace(/"/g, '\\"')}"
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
import sys
import platform
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field

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
    return f"[Echo]: {message}"

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
    mcp.run()

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

  return [
    { path: "pyproject.toml", content: pyprojectToml },
    { path: `${name}/__init__.py`, content: `"""${name} package"""\n__version__ = "0.1.0"\n` },
    { path: `${name}/server.py`, content: serverPy },
    { path: "tests/__init__.py", content: "" },
    { path: "tests/test_server.py", content: testPy },
    { path: "README.md", content: readme },
    { path: ".gitignore", content: "__pycache__/\n*.py[cod]\n.venv/\nvenv/\n*.egg-info/\ndist/\n.pytest_cache/\n" },
  ];
}
