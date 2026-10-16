import type { McpScaffoldOptions, GeneratedFile } from "../types.js";

export function generateTypeScriptTemplate(options: McpScaffoldOptions): GeneratedFile[] {
  const name = options.projectName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const className = toSafeClassName(options.projectName);
  const description = options.description || "High-performance Model Context Protocol (MCP) server";
  const author = options.author || "RitualDev Lab";
  const transport = options.transport || "stdio";

  const packageJson = {
    name,
    version: "0.1.0",
    description,
    type: "module",
    bin: {
      [name]: "./dist/index.js",
    },
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    scripts: {
      build: "tsup",
      start: "node dist/index.js",
      dev: "tsup --watch",
      test: "tsx --test tests/**/*.test.ts",
      lint: "biome lint .",
      format: "biome format --write .",
    },
    dependencies: {
      "@modelcontextprotocol/sdk": "^1.6.0",
      zod: "^3.24.2",
    },
    devDependencies: {
      "@biomejs/biome": "^1.9.4",
      "@types/node": "^22.10.1",
      tsup: "^8.3.5",
      tsx: "^4.19.2",
      typescript: "^5.7.2",
    },
    keywords: ["mcp", "model-context-protocol", "ai-agent", name],
    author,
    license: "MIT",
  };

  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      lib: ["ES2022"],
      declaration: true,
      outDir: "./dist",
      rootDir: "./src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist", "tests"],
  };

  const tsupConfig = `import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  banner: {
    js: "#!/usr/bin/env node",
  },
});
`;

  const biomeConfig = `{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "files": {
    "ignore": ["node_modules", "dist", "*.log"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
`;

  const indexTs = `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

/**
 * ${name} - Model Context Protocol Server
 * ${description}
 */
export class ${className} {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "${name}",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.registerHandlers();
  }

  private registerHandlers(): void {
    // 1. Tool Listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "echo",
            description: "Echoes input back with execution metadata",
            inputSchema: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "The text payload to echo",
                },
              },
              required: ["message"],
            },
          },
          {
            name: "system_info",
            description: "Provides basic execution platform statistics",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
        ],
      };
    });

    // 2. Tool Invocation
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === "echo") {
        const schema = z.object({ message: z.string() });
        const parsed = schema.safeParse(args);
        if (!parsed.success) {
          throw new Error(\`Invalid arguments for echo: \${parsed.error.message}\`);
        }

        return {
          content: [
            {
              type: "text",
              text: \`[Echo]: \${parsed.data.message}\`,
            },
          ],
        };
      }

      if (name === "system_info") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  platform: process.platform,
                  nodeVersion: process.version,
                  uptimeSeconds: Math.floor(process.uptime()),
                  server: "${name}",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      throw new Error(\`Unknown tool: \${name}\`);
    });

    // 3. Resources Listing
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: "${name}://metadata",
            name: "Server Metadata",
            mimeType: "application/json",
            description: "Live operational specifications and capability listing",
          },
        ],
      };
    });

    // 4. Resource Reading
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      if (request.params.uri === "${name}://metadata") {
        return {
          contents: [
            {
              uri: "${name}://metadata",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  name: "${name}",
                  description: "${description}",
                  transports: ["${transport}"],
                  status: "online",
                },
                null,
                2
              ),
            },
          ],
        };
      }
      throw new Error(\`Resource not found: \${request.params.uri}\`);
    });
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("${name} MCP server running on stdio");
  }
}

// Direct execution entrypoint
const server = new ${className}();
server.start().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
`;

  const testFile = `import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { ${className} } from "../src/index.js";

describe("${name} MCP Server Test Suite", () => {
  test("initializes server instance correctly", () => {
    const instance = new ${className}();
    assert.ok(instance, "Server instance should construct successfully");
  });
});
`;

  const readme = `# ${name}

> ${description}

Built with [**mcp-builder-kit**](https://github.com/RitualDev-Lab/mcp-builder-kit) — The production Model Context Protocol (MCP) server development toolkit.

---

## ⚡ Quick Start

\`\`\`bash
# 1. Install dependencies
pnpm install

# 2. Build TypeScript distribution
pnpm run build

# 3. Run unit tests
pnpm test
\`\`\`

---

## 🔌 Client Integration

### Claude Desktop (\`claude_desktop_config.json\`)

\`\`\`json
{
  "mcpServers": {
    "${name}": {
      "command": "node",
      "args": ["${options.targetDir.replace(/\\/g, "/")}/dist/index.js"]
    }
  }
}
\`\`\`

### Antigravity / Gemini CLI Configuration

\`\`\`json
{
  "mcpServers": {
    "${name}": {
      "command": "node",
      "args": ["${options.targetDir.replace(/\\/g, "/")}/dist/index.js"]
    }
  }
}
\`\`\`

---

## 🛠️ Tools Available

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| \`echo\` | \`message: string\` | Returns echoed string payload with metadata |
| \`system_info\` | _None_ | Returns runtime platform telemetry |

---

## 📜 License

MIT © ${author}
`;

  return [
    { path: "package.json", content: JSON.stringify(packageJson, null, 2) },
    { path: "tsconfig.json", content: JSON.stringify(tsconfig, null, 2) },
    { path: "tsup.config.ts", content: tsupConfig },
    { path: "biome.json", content: biomeConfig },
    { path: "src/index.ts", content: indexTs },
    { path: "tests/index.test.ts", content: testFile },
    { path: "README.md", content: readme },
    { path: ".gitignore", content: "node_modules/\ndist/\n*.log\n.env\n" },
  ];
}

export function toSafeClassName(str: string): string {
  let pascal = str
    .replace(/[^a-zA-Z0-9_-]/g, " ")
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

  if (!pascal) {
    pascal = "Mcp";
  }
  if (/^[0-9]/.test(pascal)) {
    pascal = `Mcp${pascal}`;
  }
  return `${pascal}Server`;
}
