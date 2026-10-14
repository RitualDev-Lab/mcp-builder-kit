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

    const paths = (spec.paths as Record<string, Record<string, unknown>>) || {};

    // Extract base URL from servers block if available
    let resolvedBaseUrl = options.baseUrl || "";
    if (!resolvedBaseUrl && Array.isArray(spec.servers) && spec.servers.length > 0) {
      resolvedBaseUrl = (spec.servers[0] as { url?: string })?.url || "";
    }

    for (const [pathStr, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== "object") continue;

      for (const [method, opObj] of Object.entries(pathItem)) {
        const httpMethod = method.toLowerCase();
        if (!["get", "post", "put", "patch", "delete"].includes(httpMethod)) {
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

        // Parse query / path parameters
        if (Array.isArray(endpoint.parameters)) {
          for (const p of endpoint.parameters) {
            parameters.push({
              name: p.name,
              type: OpenApiToMcpConverter.normalizeType(p.schema?.type),
              description: p.description || `${p.in || "query"} parameter`,
              required: Boolean(p.required),
              default: p.schema?.default,
            });
          }
        }

        // Parse requestBody JSON properties with recursive $ref resolution
        const jsonContent = endpoint.requestBody?.content?.["application/json"];
        if (jsonContent?.schema) {
          const resolvedSchema = OpenApiToMcpConverter.resolveSchema(jsonContent.schema, spec);
          if (resolvedSchema?.properties) {
            const reqList = Array.isArray(resolvedSchema.required) ? resolvedSchema.required : [];
            const requiredSet = new Set(reqList);
            for (const [propName, propSchemaRaw] of Object.entries(resolvedSchema.properties as Record<string, unknown>)) {
              const propSchema = OpenApiToMcpConverter.resolveSchema(propSchemaRaw as Record<string, unknown>, spec);
              parameters.push({
                name: propName,
                type: OpenApiToMcpConverter.normalizeType(propSchema.type as string),
                description: (propSchema.description as string) || "Body field",
                required: requiredSet.has(propName),
              });
            }
          }
        }

        tools.push({
          name: toolName,
          description,
          parameters,
        });
      }
    }

    let generatedCode = "";
    if (language === "typescript") {
      const header = resolvedBaseUrl
        ? `// Base API Endpoint: ${resolvedBaseUrl}\nconst BASE_URL = process.env.API_BASE_URL || ${JSON.stringify(resolvedBaseUrl)};\n\n`
        : "";
      generatedCode = header + tools.map((t) => McpCodeGenerator.generateTypeScriptTool(t)).join("\n\n");
    } else {
      const header = resolvedBaseUrl
        ? `# Base API Endpoint: ${resolvedBaseUrl}\nBASE_URL = os.environ.get("API_BASE_URL", ${JSON.stringify(resolvedBaseUrl)})\n\n`
        : "";
      generatedCode = header + tools.map((t) => McpCodeGenerator.generatePythonTool(t)).join("\n\n");
    }

    return {
      tools,
      generatedCode,
    };
  }

  /**
   * Resolves $ref pointers (e.g. #/components/schemas/Pet) against the root specification
   */
  public static resolveSchema(
    schema: Record<string, unknown>,
    rootSpec: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!schema || typeof schema !== "object") return {};
    if (typeof schema.$ref === "string") {
      const refPath = schema.$ref;
      if (refPath.startsWith("#/")) {
        const parts = refPath.replace("#/", "").split("/");
        let current: unknown = rootSpec;
        for (const part of parts) {
          if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
            current = (current as Record<string, unknown>)[part];
          } else {
            return schema;
          }
        }
        if (current && typeof current === "object") {
          return OpenApiToMcpConverter.resolveSchema(current as Record<string, unknown>, rootSpec);
        }
      }
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

