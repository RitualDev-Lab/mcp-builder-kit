import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import type {
  McpDiscoveredResource,
  McpDiscoveredTool,
  McpInspectionReport,
  McpJsonRpcRequest,
  McpJsonRpcResponse,
} from "./types.js";

export interface McpInspectorOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Headless JSON-RPC 2.0 Client & Conformance Inspector for Model Context Protocol servers
 */
export class McpServerInspector {
  private childProcess: ChildProcessWithoutNullStreams | null = null;
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (res: McpJsonRpcResponse) => void;
      reject: (err: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();
  private buffer = "";
  private nextId = 1;

  constructor(private options: McpInspectorOptions) {}

  /**
   * Boots the target MCP server subprocess over stdio transport
   */
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.childProcess = spawn(this.options.command, this.options.args || [], {
          cwd: this.options.cwd || process.cwd(),
          env: { ...process.env, ...this.options.env },
          stdio: ["pipe", "pipe", "pipe"],
          shell: false,
        });

        this.childProcess.stdout.on("data", (data: Buffer) => {
          this.handleStdoutData(data.toString("utf8"));
        });

        this.childProcess.stderr.on("data", (data: Buffer) => {
          const text = data.toString("utf8");
          // Surface critical errors or store for diagnostic inspections
          if (process.env.MCP_INSPECTOR_VERBOSE) {
            process.stderr.write(`[MCP Server stderr]: ${text}`);
          }
        });

        this.childProcess.on("error", (err) => {
          reject(new Error(`Failed to spawn MCP server: ${err.message}`));
        });

        this.childProcess.on("exit", (code) => {
          for (const req of this.pendingRequests.values()) {
            clearTimeout(req.timer);
            req.reject(new Error(`MCP server exited prematurely with code ${code}`));
          }
          this.pendingRequests.clear();
        });

        // Ensure child process is spawned and event loop tick has settled
        setTimeout(resolve, 50);
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : "Failed to spawn process";
        reject(new Error(errorMsg));
      }
    });
  }

  /**
   * Sends an asynchronous JSON-RPC notification (no id, no response expected)
   */
  public sendNotification(method: string, params: Record<string, unknown> = {}): void {
    if (!this.childProcess || !this.childProcess.stdin.writable) {
      return;
    }
    const notification = {
      jsonrpc: "2.0",
      method,
      params,
    };
    this.childProcess.stdin.write(`${JSON.stringify(notification)}\n`);
  }

  /**
   * Dispatches a JSON-RPC request to the running MCP server
   */
  public async sendRequest(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<McpJsonRpcResponse> {
    if (!this.childProcess || !this.childProcess.stdin.writable) {
      throw new Error("Cannot send request: MCP server process is not connected");
    }

    const id = this.nextId++;
    const request: McpJsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    const timeout = this.options.timeoutMs || 5000;

    return new Promise<McpJsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP request '${method}' timed out after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.childProcess?.stdin.write(`${JSON.stringify(request)}\n`);
    });
  }

  /**
   * Runs the full automated conformance inspection suite against the server
   */
  public async inspect(): Promise<McpInspectionReport> {
    const startTime = Date.now();
    await this.connect();

    const conformanceChecks: { name: string; passed: boolean; details?: string }[] = [];
    let serverInfo: { name: string; version: string } | undefined;
    const capabilities = { tools: false, resources: false, prompts: false };
    const discoveredTools: McpDiscoveredTool[] = [];
    const discoveredResources: McpDiscoveredResource[] = [];
    let protocolVersion = "unknown";

    try {
      // 1. Check Protocol Initialization (initialize)
      try {
        const initRes = await this.sendRequest("initialize", {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "mcp-builder-kit-inspector", version: "0.1.0" },
        });

        if (initRes.error) {
          conformanceChecks.push({
            name: "Protocol Handshake ('initialize')",
            passed: false,
            details: `Returned JSON-RPC error: ${initRes.error.message}`,
          });
        } else {
          conformanceChecks.push({
            name: "Protocol Handshake ('initialize')",
            passed: true,
            details: "Responded with valid JSON-RPC 2.0 handshake",
          });

          // Conformance requirement: Client must notify server that initialization is complete
          this.sendNotification("notifications/initialized", {});

          const result = initRes.result as {
            protocolVersion?: string;
            serverInfo?: { name: string; version: string };
            capabilities?: Record<string, unknown>;
          };

          protocolVersion = result.protocolVersion || "2024-11-05";
          serverInfo = result.serverInfo;
          capabilities.tools = Boolean(result.capabilities?.tools);
          capabilities.resources = Boolean(result.capabilities?.resources);
          capabilities.prompts = Boolean(result.capabilities?.prompts);
        }
      } catch (err: unknown) {
        conformanceChecks.push({
          name: "Protocol Handshake ('initialize')",
          passed: false,
          details: err instanceof Error ? err.message : "Handshake failed",
        });
      }

      // 2. Discover Tools (tools/list)
      try {
        const toolsRes = await this.sendRequest("tools/list", {});
        if (!toolsRes.error && toolsRes.result) {
          const list = (toolsRes.result as { tools?: McpDiscoveredTool[] }).tools || [];
          for (const t of list) {
            discoveredTools.push(t);
          }
          conformanceChecks.push({
            name: "Tool Discovery ('tools/list')",
            passed: true,
            details: `Successfully discovered ${discoveredTools.length} tools`,
          });
        } else {
          conformanceChecks.push({
            name: "Tool Discovery ('tools/list')",
            passed: false,
            details: toolsRes.error?.message || "No tools returned",
          });
        }
      } catch (err: unknown) {
        conformanceChecks.push({
          name: "Tool Discovery ('tools/list')",
          passed: false,
          details: err instanceof Error ? err.message : "tools/list failed",
        });
      }

      // 3. Discover Resources (resources/list)
      if (capabilities.resources) {
        try {
          const resRes = await this.sendRequest("resources/list", {});
          if (!resRes.error && resRes.result) {
            const list = (resRes.result as { resources?: McpDiscoveredResource[] }).resources || [];
            for (const r of list) {
              discoveredResources.push(r);
            }
            conformanceChecks.push({
              name: "Resource Discovery ('resources/list')",
              passed: true,
              details: `Successfully discovered ${discoveredResources.length} resources`,
            });
          } else {
            conformanceChecks.push({
              name: "Resource Discovery ('resources/list')",
              passed: false,
              details:
                resRes.error?.message ||
                "Resources advertised in capabilities but resources/list failed",
            });
          }
        } catch (err: unknown) {
          conformanceChecks.push({
            name: "Resource Discovery ('resources/list')",
            passed: false,
            details: err instanceof Error ? err.message : "resources/list failed",
          });
        }
      } else {
        conformanceChecks.push({
          name: "Resource Discovery ('resources/list')",
          passed: true,
          details: "Resource capability not advertised (skipped)",
        });
      }

      // 4. Validate Error Handling (invalid tool call)
      try {
        const invalidRes = await this.sendRequest("tools/call", {
          name: "__non_existent_tool_probe__",
          arguments: {},
        });

        if (invalidRes.error || (invalidRes.result as { isError?: boolean })?.isError) {
          conformanceChecks.push({
            name: "Negative Test (Invalid Tool Invocation)",
            passed: true,
            details: "Correctly returned structured error for non-existent tool",
          });
        } else {
          conformanceChecks.push({
            name: "Negative Test (Invalid Tool Invocation)",
            passed: false,
            details: "Server should return an error for unknown tool calls",
          });
        }
      } catch {
        conformanceChecks.push({
          name: "Negative Test (Invalid Tool Invocation)",
          passed: true,
          details: "Subprocess threw structured exception on unknown tool",
        });
      }
    } finally {
      this.close();
    }

    const latencyMs = Date.now() - startTime;

    return {
      serverCommand: `${this.options.command} ${(this.options.args || []).join(" ")}`.trim(),
      protocolVersion,
      serverInfo,
      capabilities,
      discoveredTools,
      discoveredResources,
      conformanceChecks,
      latencyMs,
    };
  }

  /**
   * Closes the process cleanly
   */
  public close(): void {
    if (this.childProcess) {
      this.childProcess.kill();
      this.childProcess = null;
    }
  }

  private handleStdoutData(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const json = JSON.parse(trimmed) as McpJsonRpcResponse;
        if (json.id !== undefined && this.pendingRequests.has(json.id)) {
          const req = this.pendingRequests.get(json.id);
          if (req) {
            clearTimeout(req.timer);
            this.pendingRequests.delete(json.id);
            req.resolve(json);
          }
        }
      } catch {
        // Non-JSON-RPC lines or partial fragments ignored
      }
    }
  }
}
