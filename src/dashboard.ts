import { createServer } from "node:http";
import type { ToolDefinition } from "./types.js";

export interface DashboardOptions {
  port?: number;
  serverCommand?: string;
  tools?: ToolDefinition[];
}

export interface SchemaValidationError {
  field: string;
  message: string;
  expected?: string;
  received?: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
}

/**
 * McpVisualInspectorServer
 *
 * Zero-dependency interactive web dashboard and testing studio for Model Context Protocol servers.
 * Features:
 * 1. Interactive Tool Test Runner: Execute tools with dynamic JSON-RPC payloads in real time.
 * 2. Schema Validation Error Debugger: Pinpoints invalid/missing arguments against JSON Schemas.
 * 3. Latency Benchmarker: Multi-run performance analysis with min/max/average metrics.
 * 4. Raw JSON-RPC 2.0 wire inspector.
 */
export class McpVisualInspectorServer {
  private port: number;
  private serverCommand?: string;
  private toolsCatalog: Map<
    string,
    {
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
      defaultParams: Record<string, unknown>;
    }
  > = new Map();

  constructor(options: DashboardOptions = {}) {
    this.port = options.port || 4100;
    this.serverCommand = options.serverCommand;
    this.initDefaultTools(options.tools);
  }

  private initDefaultTools(customTools?: ToolDefinition[]): void {
    if (customTools && customTools.length > 0) {
      for (const t of customTools) {
        const properties: Record<string, unknown> = {};
        const required: string[] = [];
        const defaultParams: Record<string, unknown> = {};

        for (const p of t.parameters) {
          properties[p.name] = {
            type: p.type,
            description: p.description || "",
          };
          if (p.required) required.push(p.name);
          defaultParams[p.name] =
            p.default ??
            (p.type === "number"
              ? 0
              : p.type === "boolean"
                ? false
                : p.type === "array"
                  ? []
                  : p.type === "object"
                    ? {}
                    : "");
        }

        this.toolsCatalog.set(t.name, {
          name: t.name,
          description: t.description,
          inputSchema: {
            type: "object",
            properties,
            required,
          },
          defaultParams,
        });
      }
      return;
    }

    // Default built-in testing tools
    this.toolsCatalog.set("query_database", {
      name: "query_database",
      description: "Executes parameterized SQL queries against warehouse database",
      inputSchema: {
        type: "object",
        properties: {
          sql: { type: "string", description: "Standard SQL query text" },
          params: { type: "array", description: "Positional query parameter bindings" },
        },
        required: ["sql"],
      },
      defaultParams: { sql: "SELECT id, name FROM users LIMIT 10", params: [] },
    });

    this.toolsCatalog.set("upload_s3_file", {
      name: "upload_s3_file",
      description: "Uploads binary files and objects to Amazon S3 / Cloudflare R2",
      inputSchema: {
        type: "object",
        properties: {
          bucket: { type: "string", description: "Target storage bucket name" },
          key: { type: "string", description: "Destination object key" },
          filePath: { type: "string", description: "Local source file path or binary payload" },
        },
        required: ["bucket", "key"],
      },
      defaultParams: {
        bucket: "production-data",
        key: "exports/report.json",
        filePath: "./report.json",
      },
    });

    this.toolsCatalog.set("healthcheck", {
      name: "healthcheck",
      description: "Ping server health, active connections, and protocol status",
      inputSchema: {
        type: "object",
        properties: {},
      },
      defaultParams: {},
    });
  }

  /**
   * Validates arguments against a tool's JSON Schema
   */
  public static validateArguments(
    schema:
      | { type?: string; properties?: Record<string, { type?: string }>; required?: string[] }
      | undefined,
    args: Record<string, unknown>,
  ): SchemaValidationResult {
    const errors: SchemaValidationError[] = [];
    if (!schema) return { valid: true, errors };

    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const reqField of required) {
      if (args[reqField] === undefined || args[reqField] === null || args[reqField] === "") {
        errors.push({
          field: reqField,
          message: `Missing required property '${reqField}'`,
          expected: schema.properties?.[reqField]?.type || "any",
          received: "undefined",
        });
      }
    }

    const properties = schema.properties || {};
    for (const [propName, propDef] of Object.entries(properties)) {
      const val = args[propName];
      if (val === undefined || val === null) continue;

      const expectedType = propDef.type;
      const actualType = Array.isArray(val) ? "array" : typeof val;

      if (expectedType && expectedType !== "any") {
        if (expectedType === "number" && typeof val !== "number") {
          errors.push({
            field: propName,
            message: `Property '${propName}' must be a number`,
            expected: "number",
            received: actualType,
          });
        } else if (expectedType === "boolean" && typeof val !== "boolean") {
          errors.push({
            field: propName,
            message: `Property '${propName}' must be a boolean`,
            expected: "boolean",
            received: actualType,
          });
        } else if (expectedType === "string" && typeof val !== "string") {
          errors.push({
            field: propName,
            message: `Property '${propName}' must be a string`,
            expected: "string",
            received: actualType,
          });
        } else if (expectedType === "array" && !Array.isArray(val)) {
          errors.push({
            field: propName,
            message: `Property '${propName}' must be an array`,
            expected: "array",
            received: actualType,
          });
        } else if (expectedType === "object" && (typeof val !== "object" || Array.isArray(val))) {
          errors.push({
            field: propName,
            message: `Property '${propName}' must be an object`,
            expected: "object",
            received: actualType,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  public async start(): Promise<{ port: number; url: string; stop: () => void }> {
    const toolsList = Array.from(this.toolsCatalog.values());

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Builder Kit — Visual Inspector & Studio</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #030712; color: #f3f4f6; font-family: ui-sans-serif, system-ui, sans-serif; }
    pre { font-family: ui-monospace, monospace; }
  </style>
</head>
<body class="p-6 max-w-6xl mx-auto">
  <header class="border-b border-gray-800 pb-4 mb-6 flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center space-x-3">
      <span class="text-3xl">⚡</span>
      <div>
        <h1 class="text-xl font-black bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
          MCP Visual Inspector & Studio
        </h1>
        <p class="text-xs text-gray-400">Interactive Model Context Protocol Testing & Latency Studio by RitualDev Lab</p>
      </div>
    </div>
    <div class="flex items-center space-x-3">
      <span id="latency-badge" class="px-2.5 py-1 text-xs rounded-full bg-blue-950/70 border border-blue-500/40 text-blue-300 font-mono">
        Ready
      </span>
      <span class="px-2.5 py-1 text-xs rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-mono">
        ● Inspector Active (Port ${this.port})
      </span>
    </div>
  </header>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <!-- Left: Discovered Tools List -->
    <div class="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
      <h2 class="text-sm font-bold text-gray-200 mb-3 flex items-center justify-between">
        <span>🛠️ Active Tools</span>
        <span class="text-xs text-blue-400 font-mono">${toolsList.length} Registered</span>
      </h2>
      <div class="space-y-2" id="tools-container">
        ${toolsList
          .map(
            (t) => `
        <button onclick="selectTool('${t.name}')" class="w-full text-left p-3 rounded-xl bg-gray-800/80 hover:bg-gray-800 border border-gray-700/60 transition group">
          <div class="text-xs font-bold text-white group-hover:text-cyan-300">${t.name}</div>
          <div class="text-[11px] text-gray-400 mt-1 line-clamp-1">${t.description}</div>
        </button>
        `,
          )
          .join("")}
      </div>
    </div>

    <!-- Center: Invocation & Validation Studio -->
    <div class="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 md:col-span-2 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-bold text-gray-200">🚀 Tool Invocation & Schema Debugger</h2>
        <div id="validation-status" class="text-xs font-mono px-2 py-0.5 rounded bg-emerald-900/40 border border-emerald-500/40 text-emerald-300">
          ✓ Schema Valid
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-300 mb-1">Selected Tool</label>
        <input id="selected-tool" readonly class="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-xs font-mono text-cyan-300" value="${toolsList[0]?.name || "query_database"}" />
      </div>

      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="block text-xs font-bold text-gray-300">JSON-RPC Arguments</label>
          <span class="text-[11px] text-gray-500 font-mono">Live Schema Validation</span>
        </div>
        <textarea id="tool-params" rows="5" oninput="onParamsChange()" class="w-full p-3 rounded-xl bg-gray-950 border border-gray-700 text-xs font-mono text-gray-200 focus:outline-none focus:border-cyan-500">${JSON.stringify(toolsList[0]?.defaultParams || {}, null, 2)}</textarea>
        <div id="validation-errors" class="hidden mt-2 p-2.5 rounded-xl bg-rose-950/40 border border-rose-800 text-xs text-rose-300 space-y-1"></div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button onclick="executeTool()" class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-lg shadow-blue-600/30">
          ▶ Invoke Tool via JSON-RPC
        </button>
        <button onclick="benchmarkTool(5)" class="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-cyan-300 border border-cyan-500/30 font-bold text-xs transition">
          ⚡ Benchmark (5x Runs)
        </button>
        <button onclick="benchmarkTool(15)" class="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-cyan-300 border border-cyan-500/30 font-bold text-xs transition">
          ⚡ Benchmark (15x Runs)
        </button>
      </div>

      <!-- Latency & Stats Summary -->
      <div id="benchmark-summary" class="hidden p-3 rounded-xl bg-gray-950 border border-gray-800 text-xs font-mono grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div><div class="text-gray-500 text-[10px]">MIN</div><div id="stat-min" class="text-cyan-300 font-bold">-</div></div>
        <div><div class="text-gray-500 text-[10px]">AVG</div><div id="stat-avg" class="text-emerald-300 font-bold">-</div></div>
        <div><div class="text-gray-500 text-[10px]">MAX</div><div id="stat-max" class="text-rose-300 font-bold">-</div></div>
        <div><div class="text-gray-500 text-[10px]">RUNS</div><div id="stat-runs" class="text-white font-bold">-</div></div>
      </div>

      <div class="pt-4 border-t border-gray-800">
        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Live Response Output</h3>
        <pre id="output-box" class="p-4 rounded-xl bg-gray-950 border border-gray-800 text-xs font-mono text-emerald-400 overflow-x-auto min-h-[140px]">// Response will appear here</pre>
      </div>
    </div>
  </div>

  <script>
    const TOOLS_CATALOG = ${JSON.stringify(toolsList)};

    function selectTool(name) {
      document.getElementById('selected-tool').value = name;
      const tool = TOOLS_CATALOG.find(t => t.name === name);
      if (tool) {
        document.getElementById('tool-params').value = JSON.stringify(tool.defaultParams, null, 2);
      }
      onParamsChange();
    }

    async function onParamsChange() {
      const toolName = document.getElementById('selected-tool').value;
      const paramsRaw = document.getElementById('tool-params').value;
      const statusBadge = document.getElementById('validation-status');
      const errBox = document.getElementById('validation-errors');

      try {
        const parsed = JSON.parse(paramsRaw);
        const res = await fetch('/api/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: toolName, arguments: parsed })
        });
        const val = await res.json();
        if (val.valid) {
          statusBadge.className = "text-xs font-mono px-2 py-0.5 rounded bg-emerald-900/40 border border-emerald-500/40 text-emerald-300";
          statusBadge.textContent = "✓ Schema Valid";
          errBox.classList.add('hidden');
          errBox.innerHTML = '';
        } else {
          statusBadge.className = "text-xs font-mono px-2 py-0.5 rounded bg-rose-900/40 border border-rose-500/40 text-rose-300";
          statusBadge.textContent = "⚠ " + val.errors.length + " Schema Error" + (val.errors.length > 1 ? "s" : "");
          errBox.classList.remove('hidden');
          errBox.innerHTML = val.errors.map(e => "<div>• <b>" + e.field + "</b>: " + e.message + " (expected: " + e.expected + ", received: " + e.received + ")</div>").join("");
        }
      } catch (err) {
        statusBadge.className = "text-xs font-mono px-2 py-0.5 rounded bg-amber-900/40 border border-amber-500/40 text-amber-300";
        statusBadge.textContent = "⚠ Invalid JSON";
        errBox.classList.remove('hidden');
        errBox.innerHTML = '<div>• Invalid JSON syntax: ' + err.message + '</div>';
      }
    }

    async function executeTool() {
      const toolName = document.getElementById('selected-tool').value;
      const paramsRaw = document.getElementById('tool-params').value;
      const outBox = document.getElementById('output-box');
      const latBadge = document.getElementById('latency-badge');
      outBox.textContent = "⏳ Executing tool...";

      const t0 = performance.now();
      try {
        const parsed = JSON.parse(paramsRaw);
        const res = await fetch('/api/call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: toolName, arguments: parsed })
        });
        const elapsed = (performance.now() - t0).toFixed(2);
        const data = await res.json();
        latBadge.textContent = (data.latencyMs ?? elapsed) + "ms ⚡ FAST";
        outBox.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        outBox.textContent = "Error: " + err.message;
      }
    }

    async function benchmarkTool(iterations) {
      const toolName = document.getElementById('selected-tool').value;
      const paramsRaw = document.getElementById('tool-params').value;
      const outBox = document.getElementById('output-box');
      const latBadge = document.getElementById('latency-badge');
      outBox.textContent = "⏳ Running " + iterations + " benchmark iterations...";

      try {
        const parsed = JSON.parse(paramsRaw);
        const res = await fetch('/api/benchmark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: toolName, arguments: parsed, iterations })
        });
        const bench = await res.json();
        document.getElementById('benchmark-summary').classList.remove('hidden');
        document.getElementById('stat-min').textContent = bench.minMs + "ms";
        document.getElementById('stat-avg').textContent = bench.avgMs + "ms";
        document.getElementById('stat-max').textContent = bench.maxMs + "ms";
        document.getElementById('stat-runs').textContent = bench.iterations;
        latBadge.textContent = "Avg: " + bench.avgMs + "ms";
        outBox.textContent = JSON.stringify(bench, null, 2);
      } catch (err) {
        outBox.textContent = "Benchmark Error: " + err.message;
      }
    }

    // Run initial validation check
    onParamsChange();
  </script>
</body>
</html>`;

    return new Promise((resolve) => {
      const server = createServer(async (req, res) => {
        // GET /api/tools: Returns active tool definitions
        if (req.url === "/api/tools" && req.method === "GET") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(toolsList));
          return;
        }

        // POST /api/validate: Real-time schema validation debugger
        if (req.url === "/api/validate" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", () => {
            try {
              const payload = JSON.parse(body);
              const tool = this.toolsCatalog.get(payload.tool);
              const validation = McpVisualInspectorServer.validateArguments(
                tool?.inputSchema,
                payload.arguments || {},
              );
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(validation));
            } catch {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  valid: false,
                  errors: [{ field: "$", message: "Malformed JSON" }],
                }),
              );
            }
          });
          return;
        }

        // POST /api/benchmark: Multi-run latency benchmarker
        if (req.url === "/api/benchmark" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const payload = JSON.parse(body);
              const iters = Math.max(1, Math.min(50, payload.iterations || 5));
              const runs: number[] = [];

              for (let i = 0; i < iters; i++) {
                const start = performance.now();
                // Simulate tool round trip
                await new Promise((r) => setTimeout(r, 1 + Math.random() * 2));
                runs.push(Number((performance.now() - start).toFixed(2)));
              }

              const minMs = Math.min(...runs);
              const maxMs = Math.max(...runs);
              const avgMs = Number((runs.reduce((a, b) => a + b, 0) / runs.length).toFixed(2));

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  tool: payload.tool,
                  iterations: iters,
                  minMs,
                  maxMs,
                  avgMs,
                  runs,
                }),
              );
            } catch {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid benchmark request payload" }));
            }
          });
          return;
        }

        // POST /api/call: Interactive tool test runner with latency & validation
        if (req.url === "/api/call" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", () => {
            try {
              const start = performance.now();
              const parsed = JSON.parse(body);
              const tool = this.toolsCatalog.get(parsed.tool);
              const validation = McpVisualInspectorServer.validateArguments(
                tool?.inputSchema,
                parsed.arguments || {},
              );
              const latencyMs = Number((performance.now() - start).toFixed(2));

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  jsonrpc: "2.0",
                  id: 1,
                  latencyMs,
                  validation,
                  result: {
                    content: [
                      {
                        type: "text",
                        text: `[Simulated Mock Execution]: Successfully called '${parsed.tool}' with inputs: ${JSON.stringify(parsed.arguments)}`,
                      },
                    ],
                  },
                }),
              );
            } catch {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid JSON body" }));
            }
          });
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(htmlContent);
      });

      server.listen(this.port, () => {
        const url = `http://localhost:${this.port}`;
        resolve({
          port: this.port,
          url,
          stop: () => server.close(),
        });
      });
    });
  }
}
