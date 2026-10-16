import { McpCodeGenerator } from "./generator.js";
import type {
  OpenApiConversionOptions,
  OpenApiConversionResult,
  ToolDefinition,
  ToolParamType,
  ToolParameter,
} from "./types.js";

interface OpenApiEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in?: string;
    description?: string;
    required?: boolean;
    schema?: {
      type?: string;
      default?: unknown;
    };
  }>;
  requestBody?: {
    description?: string;
    content?: Record<
      string,
      {
        schema?: {
          type?: string;
          properties?: Record<string, { type?: string; description?: string }>;
          required?: string[];
        };
      }
    >;
  };
}

/**
 * Converts OpenAPI 3.0 / 3.1 specifications into strongly typed MCP Tools
 */
// biome-ignore lint/complexity/noStaticOnlyClass: OpenAPI parser utility class
export class OpenApiToMcpConverter {
  public static convert(options: OpenApiConversionOptions): OpenApiConversionResult {
    const spec = options.spec;
    const language = options.language || "typescript";
    const tools: ToolDefinition[] = [];
    const warnings: string[] = [];

    const paths = (spec.paths as Record<string, Record<string, unknown>>) || {};

    // Extract base URL from servers block if available
    let resolvedBaseUrl = options.baseUrl || "";
    if (!resolvedBaseUrl && Array.isArray(spec.servers) && spec.servers.length > 0) {
      resolvedBaseUrl = (spec.servers[0] as { url?: string })?.url || "";
    }

    // Extract security scheme (Bearer, API Key, etc.)
    let authHeader: { name: string; prefix?: string } | undefined;
    const securitySchemes = (spec.components as Record<string, unknown>)?.securitySchemes as
      | Record<string, unknown>
      | undefined;
    if (securitySchemes && typeof securitySchemes === "object") {
      for (const scheme of Object.values(securitySchemes)) {
        if (scheme && typeof scheme === "object") {
          const s = scheme as Record<string, unknown>;
          if (
            s.type === "apiKey" &&
            (s.in as string)?.toLowerCase() === "header" &&
            typeof s.name === "string"
          ) {
            authHeader = { name: s.name, prefix: "" };
            break;
          }
          if (s.type === "http" && (s.scheme as string)?.toLowerCase() === "bearer") {
            authHeader = { name: "Authorization", prefix: "Bearer " };
            break;
          }
        }
      }
    }

    const supportedMethods = new Set([
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "head",
      "options",
      "trace",
    ]);

    for (const [pathStr, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== "object") continue;

      for (const [method, opObj] of Object.entries(pathItem)) {
        const httpMethod = method.toLowerCase();
        if (!supportedMethods.has(httpMethod)) {
          warnings.push(
            `Skipped unsupported HTTP method '${method.toUpperCase()}' on path '${pathStr}'.`,
          );
          continue;
        }

        const endpoint = opObj as OpenApiEndpoint;
        const toolName = OpenApiToMcpConverter.generateToolName(
          httpMethod,
          pathStr,
          endpoint.operationId,
        );
        const description =
          endpoint.summary ||
          endpoint.description ||
          `${httpMethod.toUpperCase()} request to ${pathStr}`;

        const parameters: ToolParameter[] = [];
        const pathParams: string[] = [];
        const queryParams: string[] = [];
        const headerParams: string[] = [];
        const wireParamMap: Record<string, string> = {};
        const seenParamNames = new Map<string, string>();

        // Inherit path-item level parameters and merge with operation-level parameters
        const pathLevelParams = Array.isArray((pathItem as Record<string, unknown>).parameters)
          ? ((pathItem as Record<string, unknown>).parameters as Array<Record<string, unknown>>)
          : [];
        const opLevelParams = Array.isArray(endpoint.parameters)
          ? (endpoint.parameters as Array<Record<string, unknown>>)
          : [];

        const combinedParamsMap = new Map<string, Record<string, unknown>>();
        for (const rawP of [...pathLevelParams, ...opLevelParams]) {
          if (!rawP || typeof rawP !== "object") continue;
          const p = rawP.$ref
            ? (OpenApiToMcpConverter.resolveSchema(rawP, spec) as Record<string, unknown>)
            : rawP;
          const pName = p?.name as string;
          const pIn = ((p?.in as string) || "query").toLowerCase();
          if (pName) {
            combinedParamsMap.set(`${pIn}:${pName}`, p);
          }
        }
        const combinedParameters = Array.from(combinedParamsMap.values());

        // Parse query / path / header parameters
        for (const p of combinedParameters) {
          const loc = ((p.in as string) || "query").toLowerCase();
          const pName = (p.name as string) || "param";
          let argName = pName;
          if (seenParamNames.has(argName)) {
            argName = `${pName}_${loc}`;
            let counter = 2;
            while (seenParamNames.has(argName)) {
              argName = `${pName}_${loc}_${counter}`;
              counter++;
            }
            wireParamMap[argName] = pName;
          }
          seenParamNames.set(argName, loc);

          if (loc === "path") pathParams.push(argName);
          else if (loc === "query") queryParams.push(argName);
          else if (loc === "header") headerParams.push(argName);

          const rawSchema = (p.schema as Record<string, unknown>) || {};
          const resolvedParamSchema = OpenApiToMcpConverter.resolveSchema(rawSchema, spec);
          const pType = (resolvedParamSchema?.type as string) || (rawSchema.type as string);

          parameters.push({
            name: argName,
            type: OpenApiToMcpConverter.normalizeType(pType),
            description: (p.description as string) || `${loc} parameter`,
            required: loc === "path" ? true : Boolean(p.required),
            default: resolvedParamSchema?.default ?? rawSchema.default,
          });
        }

        // Parse requestBody properties with recursive $ref resolution
        let hasBody = false;
        const requestBody = endpoint.requestBody;
        const contentTypes = requestBody?.content ? Object.keys(requestBody.content) : [];

        // Check for supported structured content types: application/json, multipart/form-data, application/x-www-form-urlencoded
        const bodyContent =
          requestBody?.content?.["application/json"] ||
          requestBody?.content?.["multipart/form-data"] ||
          requestBody?.content?.["application/x-www-form-urlencoded"];

        if (bodyContent?.schema) {
          hasBody = true;
          const resolvedSchema = OpenApiToMcpConverter.resolveSchema(bodyContent.schema, spec);
          if (resolvedSchema?.properties) {
            const reqList = Array.isArray(resolvedSchema.required) ? resolvedSchema.required : [];
            const requiredSet = new Set(reqList);
            for (const [propName, propSchemaRaw] of Object.entries(
              resolvedSchema.properties as Record<string, unknown>,
            )) {
              const propSchema = OpenApiToMcpConverter.resolveSchema(
                propSchemaRaw as Record<string, unknown>,
                spec,
              );
              let argName = propName;
              if (seenParamNames.has(argName)) {
                argName = `${propName}_body`;
                let counter = 2;
                while (seenParamNames.has(argName)) {
                  argName = `${propName}_body_${counter}`;
                  counter++;
                }
                wireParamMap[argName] = propName;
              }
              seenParamNames.set(argName, "body");

              parameters.push({
                name: argName,
                type: OpenApiToMcpConverter.normalizeType(propSchema.type as string),
                description: (propSchema.description as string) || "Body field",
                required: requiredSet.has(propName),
              });
            }
          }
        } else if (requestBody && contentTypes.length > 0) {
          // Explicit warning for unsupported MIME types (e.g. application/xml, text/plain, etc.)
          warnings.push(
            `Operation '${toolName}' (${httpMethod.toUpperCase()} ${pathStr}) specifies unsupported requestBody content-type(s): ${contentTypes.join(", ")}. Supported body types: application/json, multipart/form-data, application/x-www-form-urlencoded.`,
          );
        }

        tools.push({
          name: toolName,
          description,
          parameters,
          apiEndpoint: {
            path: pathStr,
            method: httpMethod.toUpperCase(),
            pathParams,
            queryParams,
            headerParams,
            hasBody,
            baseUrlVar: "BASE_URL",
            ...(authHeader ? { authHeader } : {}),
            ...(Object.keys(wireParamMap).length > 0 ? { wireParamMap } : {}),
          },
        });
      }
    }

    let generatedCode = "";
    if (language === "typescript") {
      const header = [
        'import { z } from "zod";',
        "",
        `// Base API Endpoint: ${resolvedBaseUrl || "Configurable via API_BASE_URL"}`,
        `const BASE_URL = process.env.API_BASE_URL || ${JSON.stringify(resolvedBaseUrl || "")};`,
        "",
      ].join("\n");
      generatedCode =
        header + tools.map((t) => McpCodeGenerator.generateTypeScriptTool(t)).join("\n\n");
    } else {
      const header = [
        "import json",
        "import os",
        "import urllib.error",
        "import urllib.parse",
        "import urllib.request",
        "",
        `# Base API Endpoint: ${resolvedBaseUrl || "Configurable via API_BASE_URL"}`,
        `BASE_URL = os.environ.get("API_BASE_URL", ${JSON.stringify(resolvedBaseUrl || "")})`,
        "",
      ].join("\n");
      generatedCode =
        header + tools.map((t) => McpCodeGenerator.generatePythonTool(t)).join("\n\n");
    }

    return {
      tools,
      generatedCode,
      warnings,
    };
  }

  /**
   * Resolves $ref pointers (e.g. #/components/schemas/Pet) against the root specification
   * with circular reference cycle detection and allOf composition support.
   */
  public static resolveSchema(
    schema: Record<string, unknown>,
    rootSpec: Record<string, unknown>,
    visited: Set<string> = new Set<string>(),
  ): Record<string, unknown> {
    if (!schema || typeof schema !== "object") return {};

    // 1. Resolve $ref with circular reference cycle detection
    if (typeof schema.$ref === "string") {
      const refPath = schema.$ref;
      if (visited.has(refPath)) {
        // Break cycle safely on recursive / cyclic schemas
        return { type: "object", description: `Circular reference to ${refPath}` };
      }
      visited.add(refPath);

      if (refPath.startsWith("#/")) {
        const parts = refPath.replace("#/", "").split("/");
        let current: unknown = rootSpec;
        for (const part of parts) {
          if (
            current &&
            typeof current === "object" &&
            part in (current as Record<string, unknown>)
          ) {
            current = (current as Record<string, unknown>)[part];
          } else {
            return schema;
          }
        }
        if (current && typeof current === "object") {
          return OpenApiToMcpConverter.resolveSchema(
            current as Record<string, unknown>,
            rootSpec,
            visited,
          );
        }
      }
    }

    // 2. Resolve allOf composition
    if (Array.isArray(schema.allOf)) {
      const merged: Record<string, unknown> = {
        type: "object",
        properties: {},
        required: [],
      };
      for (const sub of schema.allOf) {
        if (sub && typeof sub === "object") {
          const resolvedSub = OpenApiToMcpConverter.resolveSchema(
            sub as Record<string, unknown>,
            rootSpec,
            visited,
          );
          if (resolvedSub && typeof resolvedSub === "object") {
            if (resolvedSub.properties && typeof resolvedSub.properties === "object") {
              Object.assign(merged.properties as Record<string, unknown>, resolvedSub.properties);
            }
            if (Array.isArray(resolvedSub.required)) {
              (merged.required as string[]).push(...(resolvedSub.required as string[]));
            }
          }
        }
      }
      return merged;
    }

    return schema;
  }

  private static generateToolName(method: string, path: string, operationId?: string): string {
    if (operationId) {
      return operationId.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
    }
    const cleanPath = path
      .replace(/\{([^}]+)\}/g, "by_$1")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    return `${method.toLowerCase()}_${cleanPath}`;
  }

  private static normalizeType(type?: string): ToolParamType {
    if (!type) return "string";
    const lower = type.toLowerCase();
    if (lower === "integer" || lower === "float" || lower === "number") return "number";
    if (lower === "boolean") return "boolean";
    if (lower === "array") return "array";
    if (lower === "object") return "object";
    return "string";
  }
}
