import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface DeployOptions {
  target: "cloudflare-workers" | "cloud-run";
  serverDir?: string;
  outputDir?: string;
  projectName?: string;
  serverName?: string;
  port?: number;
}

export interface DeployResult {
  target: string;
  success: boolean;
  filesGenerated: string[];
  filesCreated: string[];
  instructions: string[];
  deployInstructions: string[];
}

/**
 * McpServerDeployer
 *
 * Automates serverless deployment packaging for Model Context Protocol servers:
 * 1. Cloudflare Workers (Zero-infra serverless edge MCP with SSE transport).
 * 2. Google Cloud Run (Containerized autoscaling MCP with HTTP/SSE & Docker).
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Deployer utility class
export class McpServerDeployer {
  public static generateDeployment(options: DeployOptions): DeployResult {
    const targetDir = resolve(options.outputDir || options.serverDir || ".");
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
    const projectName = options.serverName || options.projectName || "mcp-server";
    const filesGenerated: string[] = [];
    const instructions: string[] = [];

    if (options.target === "cloudflare-workers") {
      const wranglerToml = `name = "${projectName}"
main = "src/worker.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[vars]
MCP_SERVER_NAME = "${projectName}"
MCP_PROTOCOL_VERSION = "2024-11-05"
`;
      const workerTs = `/**
 * Serverless MCP Server on Cloudflare Workers
 * Powered by @ritualdev-lab/mcp-builder-kit
 */

export interface Env {
  MCP_SERVER_NAME: string;
  MCP_PROTOCOL_VERSION: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // Health check endpoint
    if (url.pathname === "/health" || url.pathname === "/") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          server: env.MCP_SERVER_NAME || "${projectName}",
          protocolVersion: env.MCP_PROTOCOL_VERSION || "2024-11-05",
          transport: "sse/http",
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Server-Sent Events (SSE) stream endpoint for MCP clients
    if (url.pathname === "/sse" && request.method === "GET") {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Send initial endpoint event
      const endpointUri = \`\${url.origin}/message\`;
      writer.write(encoder.encode(\`event: endpoint\\ndata: \${endpointUri}\\n\\n\`));

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // JSON-RPC Message Handler
    if (url.pathname === "/message" && request.method === "POST") {
      try {
        const body = (await request.json()) as any;
        const id = body?.id ?? null;
        const method = body?.method;

        if (method === "initialize") {
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id,
              result: {
                protocolVersion: "2024-11-05",
                capabilities: { tools: {} },
                serverInfo: { name: env.MCP_SERVER_NAME || "${projectName}", version: "1.0.0" },
              },
            }),
            { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
          );
        }

        if (method === "tools/list") {
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id,
              result: {
                tools: [
                  {
                    name: "ping",
                    description: "Edge healthcheck tool",
                    inputSchema: { type: "object", properties: {} },
                  },
                ],
              },
            }),
            { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
          );
        }

        if (method === "tools/call") {
          const toolName = body?.params?.name;
          const toolArgs = body?.params?.arguments || {};
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: \`[Edge Execution: \${toolName}] Executed successfully with: \${JSON.stringify(toolArgs)}\`,
                  },
                ],
              },
            }),
            { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
          );
        }

        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: \`Method '\${method}' not implemented on edge\` },
          }),
          { status: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }),
          { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
`;
      const wranglerPath = join(targetDir, "wrangler.toml");
      const srcDir = join(targetDir, "src");
      if (!existsSync(srcDir)) mkdirSync(srcDir, { recursive: true });
      const workerPath = join(srcDir, "worker.ts");

      writeFileSync(wranglerPath, wranglerToml, "utf8");
      writeFileSync(workerPath, workerTs, "utf8");
      filesGenerated.push("wrangler.toml", "src/worker.ts");

      instructions.push("1. Install Wrangler CLI: npm install -D wrangler");
      instructions.push("2. Test locally on Cloudflare edge: npx wrangler dev");
      instructions.push("3. Deploy to global edge network: npx wrangler deploy");
    } else {
      // Cloud Run target
      const dockerfile = `FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build || true

FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist

ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "dist/index.js"]
`;
      const cloudRunYaml = `apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: ${projectName}
spec:
  template:
    spec:
      containers:
        - image: gcr.io/PROJECT_ID/${projectName}:latest
          ports:
            - containerPort: 8080
          resources:
            limits:
              memory: 512Mi
              cpu: 1000m
`;
      const dockerfilePath = join(targetDir, "Dockerfile.cloudrun");
      const serviceYamlPath = join(targetDir, "cloudrun-service.yaml");

      writeFileSync(dockerfilePath, dockerfile, "utf8");
      writeFileSync(serviceYamlPath, cloudRunYaml, "utf8");
      filesGenerated.push("Dockerfile.cloudrun", "cloudrun-service.yaml");

      instructions.push(
        `1. Build image: gcloud builds submit --tag gcr.io/PROJECT_ID/${projectName}`,
      );
      instructions.push(
        `2. Deploy to Cloud Run: gcloud run deploy ${projectName} --image gcr.io/PROJECT_ID/${projectName} --platform managed --allow-unauthenticated`,
      );
    }

    return {
      target: options.target,
      success: true,
      filesGenerated,
      filesCreated: filesGenerated,
      instructions,
      deployInstructions: instructions,
    };
  }
}
