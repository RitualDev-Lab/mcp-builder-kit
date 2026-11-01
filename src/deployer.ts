import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type DeployTarget =
  | "cloudflare-workers"
  | "cloud-run"
  | "docker"
  | "aws-lambda"
  | "flyio"
  | "fly"
  | "railway";

export interface DeployOptions {
  target: DeployTarget;
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
 * Automates serverless and containerized deployment packaging for Model Context Protocol servers:
 * 1. Cloudflare Workers (Zero-infra serverless edge MCP with SSE transport).
 * 2. Google Cloud Run (Containerized autoscaling MCP with HTTP/SSE & Docker).
 * 3. Docker (Multi-stage production build, non-root user, docker-compose).
 * 4. AWS Lambda (API Gateway v2 HTTP API & Function URLs with Serverless Framework).
 * 5. Fly.io (Global micro-VM with auto-stop machines and fly.toml).
 * 6. Railway (Zero-config Nixpacks deployment with railway.json and Procfile).
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Deployer utility class
export class McpServerDeployer {
  public static generateDeployment(options: DeployOptions): DeployResult {
    const targetDir = resolve(options.outputDir || options.serverDir || ".");
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
    const projectName = options.serverName || options.projectName || "mcp-server";
    const port = options.port || 8080;
    const filesGenerated: string[] = [];
    const instructions: string[] = [];

    const normTarget = options.target.toLowerCase();

    if (normTarget === "cloudflare-workers") {
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
    } else if (normTarget === "cloud-run") {
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
    } else if (normTarget === "docker") {
      // Generic Docker & Docker Compose target
      const dockerfile = `# Multi-stage production container for Model Context Protocol (MCP) server
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build || true

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=${port}
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist

USER node
EXPOSE ${port}

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:${port}/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

CMD ["node", "dist/index.js"]
`;
      const dockerignore = `node_modules
dist
.git
.env*
*.log
coverage
.nyc_output
`;
      const dockerCompose = `version: "3.8"
services:
  ${projectName}:
    build: .
    image: ${projectName}:latest
    container_name: ${projectName}
    restart: unless-stopped
    ports:
      - "${port}:${port}"
    environment:
      - PORT=${port}
      - NODE_ENV=production
      - MCP_SERVER_NAME=${projectName}
`;
      const dockerfilePath = join(targetDir, "Dockerfile");
      const dockerignorePath = join(targetDir, ".dockerignore");
      const composePath = join(targetDir, "docker-compose.yml");

      writeFileSync(dockerfilePath, dockerfile, "utf8");
      writeFileSync(dockerignorePath, dockerignore, "utf8");
      writeFileSync(composePath, dockerCompose, "utf8");
      filesGenerated.push("Dockerfile", ".dockerignore", "docker-compose.yml");

      instructions.push(`1. Build Docker container: docker build -t ${projectName} .`);
      instructions.push(`2. Run container: docker run -p ${port}:${port} ${projectName}`);
      instructions.push("3. Or start via Docker Compose: docker compose up -d");
    } else if (normTarget === "aws-lambda") {
      // AWS Lambda target
      const lambdaTs = `/**
 * AWS Lambda Handler for Model Context Protocol (MCP) Server
 * Powered by @ritualdev-lab/mcp-builder-kit
 *
 * Compatible with AWS API Gateway HTTP APIs (v2) and Lambda Function URLs
 */

export const handler = async (event: any, context: any) => {
  const method = event.requestContext?.http?.method || event.httpMethod || "POST";
  const path = event.requestContext?.http?.path || event.path || "/";

  // Health check endpoint
  if (method === "GET" && (path === "/health" || path === "/")) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "healthy",
        server: "${projectName}",
        target: "aws-lambda",
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // Parse JSON-RPC body
  let body = event.body;
  if (event.isBase64Encoded && body) {
    body = Buffer.from(body, "base64").toString("utf-8");
  }
  const rpc = typeof body === "string" ? JSON.parse(body || "{}") : body || {};

  if (rpc.method === "initialize") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: rpc.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "${projectName}", version: "1.0.0" },
        },
      }),
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: rpc.id ?? null,
      result: {
        content: [
          {
            type: "text",
            text: \`[AWS Lambda MCP Server: ${projectName}] Processed \${rpc.method || "call"}\`,
          },
        ],
      },
    }),
  };
};
`;
      const serverlessYml = `service: ${projectName}
frameworkVersion: '3'

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  environment:
    MCP_SERVER_NAME: "${projectName}"
    NODE_ENV: production

functions:
  mcp:
    handler: dist/lambda.handler
    events:
      - httpApi: '*'
`;
      const srcDir = join(targetDir, "src");
      if (!existsSync(srcDir)) mkdirSync(srcDir, { recursive: true });
      const lambdaPath = join(srcDir, "lambda.ts");
      const serverlessPath = join(targetDir, "serverless.yml");

      writeFileSync(lambdaPath, lambdaTs, "utf8");
      writeFileSync(serverlessPath, serverlessYml, "utf8");
      filesGenerated.push("src/lambda.ts", "serverless.yml");

      instructions.push("1. Install Serverless Framework: npm install -g serverless");
      instructions.push("2. Build project: npm run build");
      instructions.push("3. Deploy to AWS Lambda: serverless deploy");
    } else if (normTarget === "flyio" || normTarget === "fly") {
      // Fly.io target
      const flyToml = `app = "${projectName}"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile.fly"

[http_service]
  internal_port = ${port}
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
`;
      const dockerfileFly = `FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build || true

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=${port}
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE ${port}
CMD ["node", "dist/index.js"]
`;
      const flyPath = join(targetDir, "fly.toml");
      const dockerfilePath = join(targetDir, "Dockerfile.fly");

      writeFileSync(flyPath, flyToml, "utf8");
      writeFileSync(dockerfilePath, dockerfileFly, "utf8");
      filesGenerated.push("fly.toml", "Dockerfile.fly");

      instructions.push("1. Install Fly CLI: https://fly.io/docs/hands-on/install-flyctl/");
      instructions.push("2. Launch Fly app: fly launch --no-deploy");
      instructions.push("3. Deploy to Fly edge network: fly deploy");
    } else if (normTarget === "railway") {
      // Railway target
      const railwayJson = `{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build"
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
`;
      const procfile = "web: node dist/index.js\n";
      const railwayPath = join(targetDir, "railway.json");
      const procfilePath = join(targetDir, "Procfile");

      writeFileSync(railwayPath, railwayJson, "utf8");
      writeFileSync(procfilePath, procfile, "utf8");
      filesGenerated.push("railway.json", "Procfile");

      instructions.push("1. Install Railway CLI: npm install -g @railway/cli");
      instructions.push("2. Link Railway project: railway init");
      instructions.push("3. Deploy to Railway cloud: railway up");
    } else {
      throw new Error(
        `Unsupported deployment target '${options.target}'. Valid targets: cloudflare-workers, cloud-run, docker, aws-lambda, flyio, railway.`,
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
