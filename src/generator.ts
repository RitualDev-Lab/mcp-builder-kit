import type { ResourceDefinition, ToolDefinition, ToolParameter } from "./types.js";

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

    let handlerBody = "";
    if (tool.apiEndpoint) {
      const ep = tool.apiEndpoint;
      const pathSubstitutions = (ep.pathParams || [])
        .map((p) => `    requestPath = requestPath.replace("{${p}}", encodeURIComponent(String(args.${p} ?? "")));`)
        .join("\n");

      const queryAppenders = (ep.queryParams || [])
        .map((q) => `    if (args.${q} !== undefined) { url.searchParams.set("${q}", String(args.${q})); }`)
        .join("\n");

      let bodyHandling = "const requestBody = undefined;";
      if (ep.hasBody) {
        const excludeProps = [...(ep.pathParams || []), ...(ep.queryParams || [])];
        const deleteStatements = excludeProps.map((p) => `    delete (bodyPayload as any).${p};`).join("\n");
        bodyHandling = `headers["Content-Type"] = "application/json";
    const bodyPayload = { ...args };
${deleteStatements}
    const requestBody = JSON.stringify(bodyPayload);`;
      }

      handlerBody = `  try {
    // 1. Substitute path parameters
    let requestPath = "${ep.path}";
${pathSubstitutions ? `${pathSubstitutions}\n` : ""}
    // 2. Build URL & Query parameters
    const url = new URL(requestPath, BASE_URL);
${queryAppenders ? `${queryAppenders}\n` : ""}
    // 3. Prepare headers
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(process.env.API_KEY ? { Authorization: \`Bearer \${process.env.API_KEY}\` } : {}),
    };

    // 4. Prepare request payload
    ${bodyHandling}

    // 5. Execute HTTP Request
    const response = await fetch(url.toString(), {
      method: "${ep.method}",
      headers,
      body: requestBody,
    });

    const responseText = await response.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    if (!response.ok) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: \`API Request failed with status \${response.status} (\${response.statusText}): \${typeof responseData === "string" ? responseData : JSON.stringify(responseData, null, 2)}\`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: typeof responseData === "string" ? responseData : JSON.stringify(responseData, null, 2),
        },
      ],
    };
  } catch (err: any) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: \`Tool execution failed: \${err.message || String(err)}\`,
        },
      ],
    };
  }`;
    } else {
      handlerBody = `  // TODO: Implement custom tool logic for ${tool.name}
  return {
    content: [
      {
        type: "text",
        text: \`Successfully executed ${tool.name} with parameters: \${JSON.stringify(args)}\`,
      },
    ],
  };`;
    }

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
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
${handlerBody}
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

    let pyBody = "";
    if (tool.apiEndpoint) {
      const ep = tool.apiEndpoint;
      const pathSubs = (ep.pathParams || [])
        .map((p) => `    endpoint_path = endpoint_path.replace("{${p}}", urllib.parse.quote(str(${p}) if ${p} is not None else ""))`)
        .join("\n");

      const queryEntries = (ep.queryParams || []).map((q) => `"${q}": ${q}`).join(", ");
      const queryLogic = queryEntries
        ? `    query_params = {k: v for k, v in {${queryEntries}}.items() if v is not None}\n    if query_params:\n        full_url += "?" + urllib.parse.urlencode(query_params)`
        : "";

      let bodyLogic = "    req_body = None";
      if (ep.hasBody) {
        const nonBody = new Set([...(ep.pathParams || []), ...(ep.queryParams || [])]);
        const bodyParams = tool.parameters.filter((p) => !nonBody.has(p.name)).map((p) => p.name);
        const bodyEntries = bodyParams.map((p) => `"${p}": ${p}`).join(", ");
        bodyLogic = `    headers["Content-Type"] = "application/json"\n    body_dict = {k: v for k, v in {${bodyEntries}}.items() if v is not None}\n    req_body = json.dumps(body_dict).encode("utf-8") if body_dict else None`;
      }

      pyBody = `    import json
    import os
    import urllib.request
    import urllib.error
    import urllib.parse

    # 1. Substitute path parameters
    endpoint_path = "${ep.path}"
${pathSubs ? `${pathSubs}\n` : ""}
    # 2. Build full URL with query parameters
    base_url = BASE_URL.rstrip("/")
    full_url = f"{base_url}{endpoint_path}"
${queryLogic ? `${queryLogic}\n` : ""}
    # 3. Prepare headers
    headers = {"Accept": "application/json"}
    api_key = os.environ.get("API_KEY")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    # 4. Prepare body payload
${bodyLogic}

    # 5. Execute HTTP Request
    req = urllib.request.Request(full_url, data=req_body, headers=headers, method="${ep.method}")
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            res_text = response.read().decode("utf-8")
            try:
                parsed = json.loads(res_text)
                return json.dumps(parsed, indent=2)
            except Exception:
                return res_text
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        return f"HTTP Error {e.code}: {e.reason} - {error_body}"
    except Exception as e:
        return f"Request failed: {str(e)}"`;
    } else {
      pyBody = `    # TODO: Implement custom tool logic for ${tool.name}
    return f"Successfully executed ${tool.name} with inputs"`;
    }

    return `
@mcp.tool()
def ${toSnakeCase(tool.name)}(${fnArgs}) -> str:
    """${tool.description}

    Args:
${docstringArgs}
    """
${pyBody}
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
