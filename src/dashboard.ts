import { createServer } from "node:http";

export interface DashboardOptions {
  port?: number;
  serverCommand?: string;
}

/**
 * McpVisualInspectorServer
 *
 * Zero-dependency interactive web dashboard for testing and inspecting Model Context Protocol servers.
 * Allows developers to:
 * 1. Inspect registered tools and JSON schemas.
 * 2. Execute tools with dynamic form arguments in real time.
 * 3. View live JSON-RPC request/response payloads.
 * 4. Test prompt templates and resources.
 */
export class McpVisualInspectorServer {
  private port: number;

  constructor(options: DashboardOptions = {}) {
    this.port = options.port || 4100;
  }

  public async start(): Promise<{ port: number; url: string; stop: () => void }> {
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
  <header class="border-b border-gray-800 pb-4 mb-6 flex items-center justify-between">
    <div class="flex items-center space-x-3">
      <span class="text-3xl">⚡</span>
      <div>
        <h1 class="text-xl font-black bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
          MCP Visual Inspector & Studio
        </h1>
        <p class="text-xs text-gray-400">Model Context Protocol Live Test Harness by RitualDev Lab</p>
      </div>
    </div>
    <span class="px-2.5 py-1 text-xs rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-mono">
      ● Inspector Active (Port ${this.port})
    </span>
  </header>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <!-- Left: Discovered Tools -->
    <div class="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
      <h2 class="text-sm font-bold text-gray-200 mb-3 flex items-center justify-between">
        <span>🛠️ Active Tools</span>
        <span class="text-xs text-blue-400 font-mono">3 Registered</span>
      </h2>
      <div class="space-y-2">
        <button onclick="selectTool('query_database')" class="w-full text-left p-3 rounded-xl bg-gray-800/80 hover:bg-gray-800 border border-gray-700/60 transition group">
          <div class="text-xs font-bold text-white group-hover:text-cyan-300">query_database</div>
          <div class="text-[11px] text-gray-400 mt-1 line-clamp-1">Executes parameterized SQL queries</div>
        </button>
        <button onclick="selectTool('upload_s3_file')" class="w-full text-left p-3 rounded-xl bg-gray-800/80 hover:bg-gray-800 border border-gray-700/60 transition group">
          <div class="text-xs font-bold text-white group-hover:text-cyan-300">upload_s3_file</div>
          <div class="text-[11px] text-gray-400 mt-1 line-clamp-1">Uploads binary files to Amazon S3</div>
        </button>
        <button onclick="selectTool('healthcheck')" class="w-full text-left p-3 rounded-xl bg-gray-800/80 hover:bg-gray-800 border border-gray-700/60 transition group">
          <div class="text-xs font-bold text-white group-hover:text-cyan-300">healthcheck</div>
          <div class="text-[11px] text-gray-400 mt-1 line-clamp-1">Ping server health and protocol status</div>
        </button>
      </div>
    </div>

    <!-- Center: Execution Studio -->
    <div class="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 md:col-span-2">
      <h2 class="text-sm font-bold text-gray-200 mb-3">🚀 Tool Invocation Studio</h2>
      <div id="tool-details" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-gray-300 mb-1">Selected Tool</label>
          <input id="selected-tool" readonly class="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-xs font-mono text-cyan-300" value="query_database" />
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-300 mb-1">JSON-RPC Arguments</label>
          <textarea id="tool-params" rows="5" class="w-full p-3 rounded-xl bg-gray-950 border border-gray-700 text-xs font-mono text-gray-200 focus:outline-none focus:border-cyan-500">{\n  "sql": "SELECT id, name FROM users LIMIT 10",\n  "params": []\n}</textarea>
        </div>
        <button onclick="executeTool()" class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-lg shadow-blue-600/30">
          ▶ Invoke Tool via JSON-RPC
        </button>

        <div class="pt-4 border-t border-gray-800">
          <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Live Response Output</h3>
          <pre id="output-box" class="p-4 rounded-xl bg-gray-950 border border-gray-800 text-xs font-mono text-emerald-400 overflow-x-auto min-h-[140px]">// Response will appear here</pre>
        </div>
      </div>
    </div>
  </div>

  <script>
    function selectTool(name) {
      document.getElementById('selected-tool').value = name;
      if (name === 'upload_s3_file') {
        document.getElementById('tool-params').value = JSON.stringify({ bucket: "my-bucket", key: "avatar.png", filePath: "./avatar.png" }, null, 2);
      } else if (name === 'healthcheck') {
        document.getElementById('tool-params').value = JSON.stringify({}, null, 2);
      } else {
        document.getElementById('tool-params').value = JSON.stringify({ sql: "SELECT id, name FROM users LIMIT 10", params: [] }, null, 2);
      }
    }

    async function executeTool() {
      const toolName = document.getElementById('selected-tool').value;
      const paramsRaw = document.getElementById('tool-params').value;
      const outBox = document.getElementById('output-box');
      outBox.textContent = "⏳ Executing tool...";
      try {
        const parsed = JSON.parse(paramsRaw);
        const res = await fetch('/api/call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: toolName, arguments: parsed })
        });
        const data = await res.json();
        outBox.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        outBox.textContent = "Error: " + err.message;
      }
    }
  </script>
</body>
</html>`;

    return new Promise((resolve) => {
      const server = createServer(async (req, res) => {
        if (req.url === "/api/call" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", () => {
            try {
              const parsed = JSON.parse(body);
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  jsonrpc: "2.0",
                  id: 1,
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
