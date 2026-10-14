import type { ToolDefinition, ResourceDefinition, ToolParameter } from "./types.js";

/**
 * Generates strongly typed MCP tool code and JSON Schemas for TypeScript and Python
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Code generator utility class
export class McpCodeGenerator {
  /**
   * Generates a TypeScript tool handler snippet using Zod and Mcp Server SDK
   */
  public static generateTypeScriptTool(tool: ToolDefinition): string {
    const zodFields = tool.parameters
      .map((p) => {
        let field = McpCodeGenerator.toZodType(p);
        if (p.description) {
          field += `.describe(${JSON.stringify(p.description)})`;
        }
        if (!p.required) {
          field += ".optional()";
        }
        return `    ${p.name}: ${field},`;
      })
      .join("\n");

    const inputProperties = tool.parameters
      .map((p) => {
        return `        ${p.name}: {
          type: "${p.type}",
          description: ${JSON.stringify(p.description || "")},
        },`;
      })
      .join("\n");

    const requiredFields = tool.parameters
      .filter((p) => p.required)
      .map((p) => `"${p.name}"`)
      .join(", ");

    return `
// Tool: ${tool.name}
// Description: ${tool.description}
export const ${toCamelCase(tool.name)}ToolDefinition = {
  name: "${tool.name}",
  description: ${JSON.stringify(tool.description)},
  inputSchema: {
    type: "object",
    properties: {
${inputProperties}
    },
    required: [${requiredFields}],
  },
};

export const ${toCamelCase(tool.name)}ArgsSchema = z.object({
${zodFields}
});

export async function handle${toPascalCase(tool.name)}(
  args: z.infer<typeof ${toCamelCase(tool.name)}ArgsSchema>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  // TODO: Implement custom tool logic for ${tool.name}
  return {
    content: [
      {
        type: "text",
        text: \`Successfully executed ${tool.name} with parameters: \${JSON.stringify(args)}\`,
      },
    ],
  };
}
`.trim();
  }

  /**
   * Generates a Python FastMCP tool function
   */
  public static generatePythonTool(tool: ToolDefinition): string {
    const fnArgs = tool.parameters
      .map((p) => {
        const pyType = McpCodeGenerator.toPythonType(p);
        const defaultVal = p.required ? "" : " = None";
        return `${p.name}: ${pyType}${defaultVal}`;
      })
      .join(", ");

    const docstringArgs = tool.parameters
      .map((p) => `    ${p.name}: ${p.description || "Parameter"}`)
      .join("\n");

    return `
@mcp.tool()
def ${toSnakeCase(tool.name)}(${fnArgs}) -> str:
    """${tool.description}

    Args:
${docstringArgs}
    """
    # TODO: Implement custom tool logic for ${tool.name}
    return f"Successfully executed ${tool.name} with inputs"
`.trim();
  }

  /**
   * Generates a TypeScript dynamic resource handler
   */
  public static generateTypeScriptResource(resource: ResourceDefinition): string {
    return `
// Resource: ${resource.name} (${resource.uri})
export const ${toCamelCase(resource.name)}ResourceDefinition = {
  uri: "${resource.uri}",
  name: "${resource.name}",
  mimeType: "${resource.mimeType}",
  description: ${JSON.stringify(resource.description || "")},
};

export async function read${toPascalCase(resource.name)}Resource(): Promise<{
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}> {
  return {
    contents: [
      {
        uri: "${resource.uri}",
        mimeType: "${resource.mimeType}",
        text: JSON.stringify({ resource: "${resource.name}", timestamp: new Date().toISOString() }, null, 2),
      },
    ],
  };
}
`.trim();
  }

  private static toZodType(param: ToolParameter): string {
    switch (param.type) {
      case "number":
        return "z.number()";
      case "boolean":
        return "z.boolean()";
      case "array":
        return "z.array(z.any())";
      case "object":
        return "z.record(z.any())";
      default:
        return "z.string()";
    }
  }

  private static toPythonType(param: ToolParameter): string {
    switch (param.type) {
      case "number":
        return "float";
      case "boolean":
        return "bool";
      case "array":
        return "list";
      case "object":
        return "dict";
      default:
        return "str";
    }
  }
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[a-z]/, (c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}
