/**
 * GraphQL & gRPC / Protobuf Schema Parser and MCP Tool Scaffolder
 *
 * Expands mcp-builder-kit beyond REST/OpenAPI to automatically generate production MCP servers
 * directly from:
 * 1. GraphQL Schema Definition Language (.graphql / .gql)
 * 2. Protobuf / gRPC service definitions (.proto / proto3)
 */

import { McpCodeGenerator } from "./generator.js";
import type { McpLanguage, McpToolDefinition, ToolDefinition, ToolParameter } from "./types.js";

export interface ParsedGraphQLField {
  name: string;
  operationType: "query" | "mutation";
  description: string;
  args: ToolParameter[];
  returnType: string;
}

export interface ParsedProtoRpc {
  serviceName: string;
  rpcName: string;
  description: string;
  requestMessage: string;
  responseMessage: string;
  fields: ToolParameter[];
}

/**
 * Detects whether an input file content is OpenAPI, GraphQL, or Protobuf
 */
export function detectSchemaType(content: string): "openapi" | "graphql" | "protobuf" {
  const trimmed = content.trim();

  // Protobuf detection
  if (
    trimmed.includes('syntax = "proto3"') ||
    trimmed.includes("syntax = 'proto3'") ||
    trimmed.includes('syntax = "proto2"') ||
    /\bservice\s+[A-Za-z0-9_]+\s*\{/i.test(trimmed)
  ) {
    return "protobuf";
  }

  // GraphQL detection
  if (
    /\btype\s+(Query|Mutation|Subscription)\b/i.test(trimmed) ||
    /\bschema\s*\{/i.test(trimmed) ||
    /\binput\s+[A-Za-z0-9_]+\s*\{/i.test(trimmed)
  ) {
    return "graphql";
  }

  return "openapi";
}

/**
 * Parses GraphQL Schema Definition Language (SDL) into structured operations
 */
export function parseGraphQLSchema(sdlContent: string): ParsedGraphQLField[] {
  const operations: ParsedGraphQLField[] = [];

  // Match Query or Mutation blocks
  const typeBlockRegex = /type\s+(Query|Mutation)\s*\{([^}]*)\}/gi;
  let typeMatch = typeBlockRegex.exec(sdlContent);

  while (typeMatch !== null) {
    const opType = typeMatch[1].toLowerCase() as "query" | "mutation";
    const body = typeMatch[2];

    // Match individual field definitions e.g.:
    // # Get a user by ID
    // getUser(id: ID!, limit: Int): User
    const lines = body.split("\n");
    let inDocstring = false;
    let pendingDocLines: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.startsWith('"""')) {
        if (inDocstring) {
          inDocstring = false;
          continue;
        }
        if (line.endsWith('"""') && line.length > 3) {
          pendingDocLines = [line.slice(3, -3).trim()];
          continue;
        }
        inDocstring = true;
        const rest = line.slice(3).trim();
        if (rest) pendingDocLines.push(rest);
        continue;
      }

      if (inDocstring) {
        if (line.endsWith('"""')) {
          inDocstring = false;
          const content = line.slice(0, -3).trim();
          if (content) pendingDocLines.push(content);
        } else {
          pendingDocLines.push(line);
        }
        continue;
      }

      if (line.startsWith("#")) {
        pendingDocLines.push(line.replace(/^#+\s*/, "").trim());
        continue;
      }

      const pendingDoc = pendingDocLines.join(" ").trim();

      const fieldMatch = line.match(/^([a-zA-Z0-9_]+)(?:\(([^)]*)\))?\s*:\s*([a-zA-Z0-9_!\[\]]+)/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        const rawArgs = fieldMatch[2] || "";
        const returnType = fieldMatch[3];

        const args: ToolParameter[] = [];
        if (rawArgs.trim()) {
          const argList = rawArgs.split(",");
          for (const rawArg of argList) {
            const parts = rawArg.trim().split(":");
            if (parts.length === 2) {
              const argName = parts[0].trim();
              const argTypeRaw = parts[1].trim();
              const isRequired = argTypeRaw.includes("!");
              const cleanType = argTypeRaw.replace(/[!\[\]]/g, "").toLowerCase();

              let mappedType: ToolParameter["type"] = "string";
              if (cleanType === "int" || cleanType === "float") mappedType = "number";
              else if (cleanType === "boolean") mappedType = "boolean";
              else if (argTypeRaw.includes("[") && argTypeRaw.includes("]")) mappedType = "array";
              else if (cleanType !== "string" && cleanType !== "id") mappedType = "object";

              args.push({
                name: argName,
                type: mappedType,
                description: `GraphQL parameter (${argTypeRaw})`,
                required: isRequired,
              });
            }
          }
        }

        operations.push({
          name: fieldName,
          operationType: opType,
          description: pendingDoc || `GraphQL ${opType}: ${fieldName}`,
          args,
          returnType,
        });

        pendingDocLines = [];
      }
    }

    typeMatch = typeBlockRegex.exec(sdlContent);
  }

  return operations;
}

/**
 * Converts parsed GraphQL schema operations into production MCP Tool Definitions
 */
export function convertGraphQLToTools(
  sdlContent: string,
  options: { endpoint?: string; serverName?: string } = {},
): McpToolDefinition[] {
  const operations = parseGraphQLSchema(sdlContent);
  const endpoint = options.endpoint || "http://localhost:4000/graphql";

  return operations.map((op) => {
    const isMutation = op.operationType === "mutation";
    const toolName = op.name;

    // Generate runtime TypeScript handler executing real GraphQL POST
    const executionCode = `
      // Auto-generated GraphQL ${op.operationType} caller
      const endpoint = process.env.GRAPHQL_ENDPOINT || "${endpoint}";
      const query = \`${isMutation ? "mutation" : "query"} \${toolName}(\${Object.keys(args).map(k => "$" + k + ": Any").join(", ")}) {
        ${op.name}(\${Object.keys(args).map(k => k + ": $" + k).join(", ")})
      }\`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.API_KEY ? { "Authorization": "Bearer " + process.env.API_KEY } : {}),
        },
        body: JSON.stringify({ query, variables: args }),
      });
      if (!response.ok) {
        throw new Error("GraphQL error: HTTP " + response.status + " " + (await response.text()));
      }
      const result = await response.json();
      return {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    `.trim();

    return {
      name: toolName,
      description: `${op.description} (Returns: ${op.returnType})`,
      parameters: op.args,
      executionCode,
    };
  });
}

/**
 * Parses Protobuf service definitions (.proto) into structured RPC operations
 */
export function parseProtobufDefinition(protoContent: string): ParsedProtoRpc[] {
  const rpcs: ParsedProtoRpc[] = [];

  // 1. Extract message fields mapping
  const messages = new Map<string, ToolParameter[]>();
  const messageRegex = /message\s+([a-zA-Z0-9_]+)\s*\{([^}]*)\}/gi;
  let msgMatch = messageRegex.exec(protoContent);

  while (msgMatch !== null) {
    const msgName = msgMatch[1];
    const msgBody = msgMatch[2];
    const fields: ToolParameter[] = [];

    const fieldLines = msgBody.split("\n");
    for (const rawLine of fieldLines) {
      const line = rawLine.replace(/\/\/.*$/, "").trim();
      if (!line) continue;

      // e.g. "string user_id = 1;" or "repeated int32 limits = 2;"
      const fieldPattern = /(?:(repeated)\s+)?([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)\s*=\s*\d+;/i;
      const match = line.match(fieldPattern);
      if (match) {
        const isRepeated = Boolean(match[1]);
        const protoType = match[2].toLowerCase();
        const fieldName = match[3];

        let mappedType: ToolParameter["type"] = "string";
        if (
          [
            "int32",
            "int64",
            "uint32",
            "uint64",
            "sint32",
            "sint64",
            "fixed32",
            "fixed64",
            "float",
            "double",
          ].includes(protoType)
        ) {
          mappedType = "number";
        } else if (protoType === "bool") {
          mappedType = "boolean";
        } else if (isRepeated) {
          mappedType = "array";
        }

        fields.push({
          name: fieldName,
          type: mappedType,
          description: `Protobuf field ${protoType} tag`,
          required: false,
        });
      }
    }

    messages.set(msgName, fields);
    msgMatch = messageRegex.exec(protoContent);
  }

  // 2. Extract services and RPCs
  const serviceRegex = /service\s+([a-zA-Z0-9_]+)\s*\{([^}]*)\}/gi;
  let serviceMatch = serviceRegex.exec(protoContent);

  while (serviceMatch !== null) {
    const serviceName = serviceMatch[1];
    const serviceBody = serviceMatch[2];

    const rpcRegex =
      /rpc\s+([a-zA-Z0-9_]+)\s*\(\s*([a-zA-Z0-9_]+)\s*\)\s*returns\s*\(\s*([a-zA-Z0-9_]+)\s*\);/gi;
    let rpcMatch = rpcRegex.exec(serviceBody);

    while (rpcMatch !== null) {
      const rpcName = rpcMatch[1];
      const reqMsg = rpcMatch[2];
      const respMsg = rpcMatch[3];
      const fields = messages.get(reqMsg) || [];

      rpcs.push({
        serviceName,
        rpcName,
        description: `gRPC unary call ${serviceName}.${rpcName}`,
        requestMessage: reqMsg,
        responseMessage: respMsg,
        fields,
      });

      rpcMatch = rpcRegex.exec(serviceBody);
    }

    serviceMatch = serviceRegex.exec(protoContent);
  }

  return rpcs;
}

/**
 * Converts parsed Protobuf / gRPC definitions into production MCP Tool Definitions
 */
export function convertProtobufToTools(
  protoContent: string,
  options: { serviceHost?: string } = {},
): McpToolDefinition[] {
  const rpcs = parseProtobufDefinition(protoContent);
  const host = options.serviceHost || "localhost:50051";

  return rpcs.map((rpc) => {
    const toolName = `${rpc.serviceName}_${rpc.rpcName}`;

    const executionCode = `
      // Auto-generated gRPC / Connect-RPC caller
      const host = process.env.GRPC_HOST || "${host}";
      // Standard HTTP/JSON transcoding gateway or Connect-RPC endpoint
      const url = \`http://\${host}/${rpc.serviceName}/${rpc.rpcName}\`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.GRPC_AUTH_TOKEN ? { "Authorization": "Bearer " + process.env.GRPC_AUTH_TOKEN } : {}),
        },
        body: JSON.stringify(args),
      });
      if (!response.ok) {
        throw new Error("gRPC error: HTTP " + response.status + " " + (await response.text()));
      }
      const result = await response.json();
      return {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    `.trim();

    return {
      name: toolName,
      description: `${rpc.description} (Input: ${rpc.requestMessage}, Output: ${rpc.responseMessage})`,
      parameters: rpc.fields,
      executionCode,
    };
  });
}

/**
 * Generates full production MCP server source code from GraphQL SDL
 */
export function generateGraphQLServer(
  sdlContent: string,
  options: { serverName?: string; endpoint?: string; language?: McpLanguage } = {},
): { tools: ToolDefinition[]; generatedCode: string } {
  const tools = convertGraphQLToTools(sdlContent, options);
  const serverName = options.serverName || "graphql-mcp-server";
  const language = options.language || "typescript";

  let generatedCode = "";
  if (language === "typescript") {
    const header = [
      'import { z } from "zod";',
      "",
      `// Server: ${serverName}`,
      `// Base GraphQL Endpoint: ${options.endpoint || "http://localhost:4000/graphql"}`,
      "",
    ].join("\n");
    generatedCode =
      header + tools.map((t) => McpCodeGenerator.generateTypeScriptTool(t)).join("\n\n");
  } else {
    generatedCode = tools.map((t) => McpCodeGenerator.generatePythonTool(t)).join("\n\n");
  }

  return { tools, generatedCode };
}

/**
 * Generates full production MCP server source code from Protobuf / gRPC definitions
 */
export function generateProtobufServer(
  protoContent: string,
  options: { serverName?: string; serviceHost?: string; language?: McpLanguage } = {},
): { tools: ToolDefinition[]; generatedCode: string } {
  const tools = convertProtobufToTools(protoContent, options);
  const serverName = options.serverName || "grpc-mcp-server";
  const language = options.language || "typescript";

  let generatedCode = "";
  if (language === "typescript") {
    const header = [
      'import { z } from "zod";',
      "",
      `// Server: ${serverName}`,
      `// gRPC Service Host: ${options.serviceHost || "localhost:50051"}`,
      "",
    ].join("\n");
    generatedCode =
      header + tools.map((t) => McpCodeGenerator.generateTypeScriptTool(t)).join("\n\n");
  } else {
    generatedCode = tools.map((t) => McpCodeGenerator.generatePythonTool(t)).join("\n\n");
  }

  return { tools, generatedCode };
}
