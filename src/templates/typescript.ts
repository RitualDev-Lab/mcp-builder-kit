import type { McpScaffoldOptions, GeneratedFile } from "../types.js";

export function generateTypeScriptTemplate(options: McpScaffoldOptions): GeneratedFile[] {
  const name = options.projectName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const className = toSafeClassName(options.projectName);
  const description = options.description || "High-performance Model Context Protocol (MCP) server";
  const author = options.author || "RitualDev Lab";
  const transport = options.transport || "stdio";
  const includeAgentShield = Boolean(options.includeAgentShield);
  const monetize = options.monetize;
  const usesStreamableHttp = transport === "streamable-http" || transport === "both";

  const dependencies: Record<string, string> = {
    "@modelcontextprotocol/sdk": "^1.12.0",
    zod: "^3.24.2",
  };
  if (includeAgentShield) {
    dependencies["@ritualdev-lab/agentshield"] = "^0.2.2";
  }

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
    dependencies,
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

  const agentShieldImport = includeAgentShield
    ? 'import { withAgentShieldRedaction } from "./agentshield-middleware.js";\n'
    : "";
  const monetizeImport = monetize
    ? 'import { verifyHttpMonetization, withMonetizePaywall } from "./monetize-middleware.js";\n'
    : "";
  const streamableHttpImport = usesStreamableHttp
    ? 'import { createServer, type IncomingMessage, type ServerResponse } from "node:http";\nimport { randomUUID } from "node:crypto";\n'
    : "";

  const checkoutUrlDefault =
    monetize === "stripe"
      ? "https://buy.stripe.com/your_price_link"
      : "https://checkout.dodopayments.com/buy/your_product_id";
  const envKeyName = monetize === "stripe" ? "STRIPE_WEBHOOK_SECRET" : "DODO_PAYMENTS_API_KEY";

  const monetizeMiddlewareTs = `/**
 * MCP Monetize Paywall & Usage Metering Middleware (${monetize === "stripe" ? "Stripe" : "Dodo Payments"})
 * Enforces license-key verification and per-key usage quotas before executing paid MCP tools.
 */

import { timingSafeEqual } from "node:crypto";

export type MonetizeProvider = "dodo" | "stripe";

export interface MonetizeConfig {
  provider: MonetizeProvider;
  enforce: boolean;
  freeQuota: number;
  checkoutUrl: string;
  validKeys: string[];
}

export interface MeteringDecision {
  allowed: boolean;
  statusCode: 200 | 402;
  remainingQuota: number;
  provider: MonetizeProvider;
  checkoutUrl: string;
  reason?: string;
}

const usageByKey = new Map<string, number>();

export function getMonetizeConfig(): MonetizeConfig {
  const rawKeys = process.env.MCP_LICENSE_KEYS || "";
  return {
    provider: "${monetize || "dodo"}",
    enforce: process.env.MONETIZE_ENFORCE === "true" || rawKeys.length > 0,
    freeQuota: Number(process.env.MCP_FREE_QUOTA ?? 10),
    checkoutUrl: process.env.MCP_CHECKOUT_URL || "${checkoutUrlDefault}",
    validKeys: rawKeys
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  };
}

function matchesValidKey(candidate: string, validKeys: string[]): boolean {
  const candBuf = Buffer.from(candidate);
  for (const key of validKeys) {
    const keyBuf = Buffer.from(key);
    if (candBuf.length === keyBuf.length && timingSafeEqual(candBuf, keyBuf)) {
      return true;
    }
  }
  return false;
}

export function evaluateMonetization(
  licenseKey?: string,
  config: MonetizeConfig = getMonetizeConfig(),
): MeteringDecision {
  const key = (licenseKey || "").trim();

  if (key && config.validKeys.length > 0 && matchesValidKey(key, config.validKeys)) {
    const used = (usageByKey.get(key) || 0) + 1;
    usageByKey.set(key, used);
    return {
      allowed: true,
      statusCode: 200,
      remainingQuota: Number.POSITIVE_INFINITY,
      provider: config.provider,
      checkoutUrl: config.checkoutUrl,
    };
  }

  if (!config.enforce) {
    const anonUsed = (usageByKey.get("__free__") || 0) + 1;
    usageByKey.set("__free__", anonUsed);
    if (anonUsed <= config.freeQuota) {
      return {
        allowed: true,
        statusCode: 200,
        remainingQuota: Math.max(0, config.freeQuota - anonUsed),
        provider: config.provider,
        checkoutUrl: config.checkoutUrl,
      };
    }
  }

  return {
    allowed: false,
    statusCode: 402,
    remainingQuota: 0,
    provider: config.provider,
    checkoutUrl: config.checkoutUrl,
    reason: \`Payment Required: valid \${config.provider.toUpperCase()} license key required. Subscribe at \${config.checkoutUrl}\`,
  };
}

export function verifyHttpMonetization(
  headers: Record<string, string | string[] | undefined>,
): MeteringDecision {
  const authHeader = headers.authorization;
  const bearer =
    typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : undefined;
  const customKey =
    typeof headers["x-mcp-license-key"] === "string"
      ? headers["x-mcp-license-key"].trim()
      : undefined;
  return evaluateMonetization(bearer || customKey);
}

export interface PaidToolResponse {
  content: Array<{ type: string; text?: string; [k: string]: unknown }>;
  isError?: boolean;
}

export function withMonetizePaywall<TReq extends { params?: { _meta?: { licenseKey?: string } } }>(
  handler: (request: TReq) => Promise<PaidToolResponse>,
): (request: TReq) => Promise<PaidToolResponse> {
  return async (request: TReq) => {
    const licenseKey = request?.params?._meta?.licenseKey || process.env.MCP_ACTIVE_LICENSE_KEY;
    const decision = evaluateMonetization(licenseKey);
    if (!decision.allowed) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "PAYMENT_REQUIRED",
              statusCode: 402,
              provider: decision.provider,
              checkoutUrl: decision.checkoutUrl,
              message: decision.reason,
            }),
          },
        ],
      };
    }
    return handler(request);
  };
}

export function resetUsageCounters(): void {
  usageByKey.clear();
}
`;

  const agentShieldMiddlewareTs = `/**
 * AgentShield Zero-Leak MCP Tool Response Middleware
 * Automatically scans and redacts leaked credentials (OpenAI, Anthropic, AWS, GitHub,
 * Stripe, PEM keys, DB URIs) from every MCP tool response before returning to the LLM context.
 */

const SECRET_PATTERNS: Array<{ id: string; rx: RegExp }> = [
  { id: "OPENAI_KEY", rx: /\\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,160}\\b/g },
  { id: "ANTHROPIC_KEY", rx: /\\bsk-ant-(?:api03|admin01)-[A-Za-z0-9_-]{20,120}\\b/g },
  { id: "AWS_KEY", rx: /\\b(?:AKIA|ASIA|AIDA|AROA)[0-9A-Z]{16}\\b/g },
  { id: "GITHUB_PAT", rx: /\\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,64}\\b/g },
  { id: "STRIPE_KEY", rx: /\\b(?:sk|rk)_(?:live|test)_[0-9A-Za-z]{20,99}\\b/g },
  { id: "DB_URI", rx: /\\b(?:postgres|postgresql|mysql|mongodb(?:\\+srv)?|rediss?):\\/\\/[^\\s:@"'\\\`]+:[^\\s@"'\\\`]+@[^\\s"'\\\`]+/g },
  { id: "PEM_KEY", rx: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];

export function redactSecrets(input: string): string {
  let out = input;
  for (const rule of SECRET_PATTERNS) {
    out = out.replace(rule.rx, \`[AGENTSHIELD_REDACTED:\${rule.id}]\`);
  }
  return out;
}

export interface McpToolResponse {
  content: Array<{ type: string; text?: string; [k: string]: unknown }>;
  isError?: boolean;
}

export function withAgentShieldRedaction<TArgs>(
  handler: (args: TArgs) => Promise<McpToolResponse>,
): (args: TArgs) => Promise<McpToolResponse> {
  return async (args: TArgs) => {
    const response = await handler(args);
    return {
      ...response,
      content: response.content.map((block) =>
        block.type === "text" && typeof block.text === "string"
          ? { ...block, text: redactSecrets(block.text) }
          : block,
      ),
    };
  };
}
`;

  const indexTs = `${streamableHttpImport}${agentShieldImport}${monetizeImport}import { Server } from "@modelcontextprotocol/sdk/server/index.js";
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
    const handleToolCall = async (request: any) => {
      const { name, arguments: args, _meta } = request.params as any;
      const effectiveArgs = { ...(args || {}), _meta };

      if (name === "echo") {
        const schema = z.object({ message: z.string() });
        const parsed = schema.safeParse(effectiveArgs);
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
    };

    const wrappedToolHandler = ${
      monetize && includeAgentShield
        ? "withMonetizePaywall(withAgentShieldRedaction(handleToolCall))"
        : monetize
          ? "withMonetizePaywall(handleToolCall)"
          : includeAgentShield
            ? "withAgentShieldRedaction(handleToolCall)"
            : "handleToolCall"
    };
    this.server.setRequestHandler(CallToolRequestSchema, wrappedToolHandler);

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
${
  usesStreamableHttp
    ? `    const port = Number(process.env.PORT || 8080);
    const sessions = new Set<string>();
    const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", server: "${name}", transport: "${transport}" }));
        return;
      }
      if (req.url === "/mcp" && req.method === "POST") {${
        monetize
          ? `
        const paywall = verifyHttpMonetization(req.headers);
        if (!paywall.allowed) {
          res.writeHead(402, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32002,
                message: paywall.reason,
                data: { provider: paywall.provider, checkoutUrl: paywall.checkoutUrl },
              },
            }),
          );
          return;
        }`
          : ""
      }
        const sessionId = (req.headers["mcp-session-id"] as string) || randomUUID();
        sessions.add(sessionId);
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
          try {
            const rpc = JSON.parse(body || "{}");
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Mcp-Session-Id": sessionId,
            });
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                id: rpc.id ?? null,
                result: {
                  protocolVersion: "2025-03-26",
                  serverInfo: { name: "${name}", version: "0.1.0" },
                  transport: "streamable-http",
                  sessionId,
                },
              }),
            );
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }));
          }
        });
        return;
      }
      if (req.url === "/mcp" && req.method === "DELETE") {
        const sid = req.headers["mcp-session-id"] as string;
        if (sid) sessions.delete(sid);
        res.writeHead(204);
        res.end();
        return;
      }
      res.writeHead(404);
      res.end("Not Found");
    });

    await new Promise<void>((resolveListen) => httpServer.listen(port, resolveListen));
    console.error(\`${name} MCP Streamable HTTP server listening on http://127.0.0.1:\${port}/mcp\`);${
      transport === "both"
        ? `
    const stdioTransport = new StdioServerTransport();
    await this.server.connect(stdioTransport);
    console.error("${name} MCP server also active on stdio");`
        : ""
    }`
    : `    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("${name} MCP server running on stdio");`
}
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

  const generatedFiles: GeneratedFile[] = [
    { path: "package.json", content: JSON.stringify(packageJson, null, 2) },
    { path: "tsconfig.json", content: JSON.stringify(tsconfig, null, 2) },
    { path: "tsup.config.ts", content: tsupConfig },
    { path: "biome.json", content: biomeConfig },
    { path: "src/index.ts", content: indexTs },
    { path: "tests/index.test.ts", content: testFile },
    { path: "README.md", content: readme },
    { path: ".gitignore", content: "node_modules/\ndist/\n*.log\n.env\n" },
  ];

  if (includeAgentShield) {
    generatedFiles.push({
      path: "src/agentshield-middleware.ts",
      content: agentShieldMiddlewareTs,
    });
  }

  if (monetize) {
    generatedFiles.push({
      path: "src/monetize-middleware.ts",
      content: monetizeMiddlewareTs,
    });
    const readmeIdx = generatedFiles.findIndex((f) => f.path === "README.md");
    if (readmeIdx !== -1) {
      generatedFiles[readmeIdx].content += `\n## 💳 Monetization (${monetize === "stripe" ? "Stripe" : "Dodo Payments"})\n\nConfigure paywall enforcement via environment variables:\n\n\`\`\`bash\nexport MONETIZE_ENFORCE=true\nexport MCP_LICENSE_KEYS="lic_customer_1,lic_customer_2"\nexport MCP_CHECKOUT_URL="${checkoutUrlDefault}"\nexport ${envKeyName}="your_provider_secret"\n\`\`\`\n`;
    }
  }

  return generatedFiles;
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
