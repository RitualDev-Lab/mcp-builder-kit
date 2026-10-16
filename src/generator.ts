import type { ResourceDefinition, ToolDefinition, ToolParameter } from "./types.js";

export const PYTHON_RESERVED_KEYWORDS = new Set([
  // Python syntax keywords
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
  "match",
  "case",
  // Common built-ins that should not be shadowed
  "type",
  "id",
  "format",
  "input",
  "list",
  "dict",
  "set",
  "int",
  "float",
  "str",
  "bool",
]);

export const JS_RESERVED_KEYWORDS = new Set([
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

/**
 * Normalizes any string into a safe, valid Python identifier.
 */
export function toSafePythonIdentifier(name: string): string {
  let normalized = name
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  if (!normalized) {
    normalized = "param";
  }

  if (/^[0-9]/.test(normalized)) {
    normalized = `arg_${normalized}`;
  }

  if (PYTHON_RESERVED_KEYWORDS.has(normalized)) {
    normalized = `${normalized}_`;
  }

  return normalized;
}

/**
 * Builds a collision-free mapping between external API parameter names and safe internal Python identifiers.
 */
export function buildPythonParameterMap(parameters: ToolParameter[]): Map<string, string> {
  const mapping = new Map<string, string>();
  const used = new Set<string>();

  for (const p of parameters) {
    let safeName = toSafePythonIdentifier(p.name);
    if (used.has(safeName)) {
      let counter = 2;
      const base = safeName.endsWith("_") ? safeName.slice(0, -1) : safeName;
      let candidate = `${base}_${counter}`;
      while (used.has(candidate)) {
        counter++;
        candidate = `${base}_${counter}`;
      }
      safeName = candidate;
    }
    used.add(safeName);
    mapping.set(p.name, safeName);
  }

  return mapping;
}

/**
 * Safely escapes a string for inclusion inside Python triple-double-quoted docstrings (""").
 * Prevents premature docstring termination, injection of unescaped quotes, and syntax errors.
 */
export function escapePythonDocstring(text: string): string {
  if (!text) return "";
  let escaped = text.replace(/\r\n/g, "\n");
  escaped = escaped.replace(/"""/g, '\\"\\"\\"');
  // If the string ends with an unescaped quote, escape it so it doesn't merge with the closing """
  // In Python, """..."""" is a SyntaxError.
  if (/(?<!\\)(?:\\\\)*"$/.test(escaped)) {
    escaped = `${escaped.slice(0, -1)}\\"`;
  }
  return escaped;
}

/**
 * Formats a TypeScript/JavaScript object property key, adding quotes if not a valid identifier.
 */
export function formatPropertyKey(name: string): string {
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) && !JS_RESERVED_KEYWORDS.has(name)) {
    return name;
  }
  return JSON.stringify(name);
}

/**
 * Generates strongly typed MCP tool code and JSON Schemas for TypeScript and Python
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Code generator utility class
export class McpCodeGenerator {
  public static toSafePythonIdentifier = toSafePythonIdentifier;
  public static buildPythonParameterMap = buildPythonParameterMap;
  public static formatPropertyKey = formatPropertyKey;
  public static escapePythonDocstring = escapePythonDocstring;

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
        const key = formatPropertyKey(p.name);
        return `    ${key}: ${field},`;
      })
      .join("\n");

    const inputProperties = tool.parameters
      .map((p) => {
        const key = formatPropertyKey(p.name);
        return `        ${key}: {
          type: "${p.type}",
          description: ${JSON.stringify(p.description || "")},
        },`;
      })
      .join("\n");

    const requiredFields = tool.parameters
      .filter((p) => p.required)
      .map((p) => JSON.stringify(p.name))
      .join(", ");

    let handlerBody = "";
    if (tool.apiEndpoint) {
      const ep = tool.apiEndpoint;
      const pathSubstitutions = (ep.pathParams || [])
        .map((p) => {
          const wireName = ep.wireParamMap?.[p] || p;
          return `    requestPath = requestPath.replaceAll("{${wireName}}", encodeURIComponent(String(args[${JSON.stringify(p)}] ?? "")));`;
        })
        .join("\n");

      const queryAppenders = (ep.queryParams || [])
        .map((q) => {
          const wireName = ep.wireParamMap?.[q] || q;
          return `    if (args[${JSON.stringify(q)}] !== undefined) { url.searchParams.set(${JSON.stringify(wireName)}, String(args[${JSON.stringify(q)}])); }`;
        })
        .join("\n");

      const headerAppenders = (ep.headerParams || [])
        .map((h) => {
          const wireName = ep.wireParamMap?.[h] || h;
          return `    if (args[${JSON.stringify(h)}] !== undefined) { headers[${JSON.stringify(wireName)}] = String(args[${JSON.stringify(h)}]); }`;
        })
        .join("\n");

      let bodyHandling = "const requestBody = undefined;";
      if (ep.hasBody) {
        const excludeProps = [
          ...(ep.pathParams || []),
          ...(ep.queryParams || []),
          ...(ep.headerParams || []),
        ];
        const deleteStatements = excludeProps
          .map((p) => `    delete (bodyPayload as any)[${JSON.stringify(p)}];`)
          .join("\n");
        const bodyRemaps = tool.parameters
          .filter((p) => !excludeProps.includes(p.name) && ep.wireParamMap?.[p.name])
          .map((p) => {
            const wireName = ep.wireParamMap?.[p.name] || p.name;
            return `    if ((bodyPayload as any)[${JSON.stringify(p.name)}] !== undefined) {\n      (bodyPayload as any)[${JSON.stringify(wireName)}] = (bodyPayload as any)[${JSON.stringify(p.name)}];\n      delete (bodyPayload as any)[${JSON.stringify(p.name)}];\n    }`;
          })
          .join("\n");

        bodyHandling = `headers["Content-Type"] = "application/json";
    const bodyPayload = { ...args };
${deleteStatements}${bodyRemaps ? `\n${bodyRemaps}` : ""}
    const requestBody = JSON.stringify(bodyPayload);`;
      }

      const authHeaderName = ep.authHeader?.name || "Authorization";
      const authHeaderPrefix =
        ep.authHeader?.prefix !== undefined ? ep.authHeader.prefix : "Bearer ";
      const authValExpression = authHeaderPrefix
        ? `\`${authHeaderPrefix}\${process.env.API_KEY}\``
        : "process.env.API_KEY";
      const authAssignment =
        authHeaderName === "Authorization"
          ? `{ Authorization: ${authValExpression} }`
          : `{ [${JSON.stringify(authHeaderName)}]: ${authValExpression} }`;

      handlerBody = `  try {
    // 1. Substitute path parameters
    let requestPath = "${ep.path}";
${pathSubstitutions ? `${pathSubstitutions}\n` : ""}
    // 2. Build URL & Query parameters
    const cleanBasePath = BASE_URL.replace(/\\/+$/, "");
    const cleanRequestPath = requestPath.replace(/^\\/+/, "");
    const fullUrl = cleanRequestPath ? \`\${cleanBasePath}/\${cleanRequestPath}\` : cleanBasePath;
    const url = new URL(fullUrl);
${queryAppenders ? `${queryAppenders}\n` : ""}
    // 3. Prepare headers
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(process.env.API_KEY ? ${authAssignment} : {}),
    };
${headerAppenders ? `${headerAppenders}\n` : ""}
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
    const paramMap = buildPythonParameterMap(tool.parameters);

    // Place all required parameters before optional parameters to avoid Python SyntaxError
    const sortedParams = [...tool.parameters].sort((a, b) => {
      if (Boolean(a.required) === Boolean(b.required)) return 0;
      return a.required ? -1 : 1;
    });

    const fnArgs = sortedParams
      .map((p) => {
        const safeName = paramMap.get(p.name) || p.name;
        const pyType = McpCodeGenerator.toPythonType(p);
        const defaultVal = p.required ? "" : " = None";
        return `${safeName}: ${pyType}${defaultVal}`;
      })
      .join(", ");

    const docstringArgs = sortedParams
      .map((p) => {
        const safeName = paramMap.get(p.name) || p.name;
        const desc = escapePythonDocstring(p.description || "Parameter").replace(
          /\n/g,
          "\n        ",
        );
        return `    ${safeName}: ${desc}`;
      })
      .join("\n");

    let pyBody = "";
    if (tool.apiEndpoint) {
      const ep = tool.apiEndpoint;
      const pathSubs = (ep.pathParams || [])
        .map((p) => {
          const wireName = ep.wireParamMap?.[p] || p;
          const safeVar = paramMap.get(p) || p;
          return `    endpoint_path = endpoint_path.replace("{${wireName}}", urllib.parse.quote(str(${safeVar}) if ${safeVar} is not None else "", safe=""))`;
        })
        .join("\n");

      const queryEntries = (ep.queryParams || [])
        .map((q) => {
          const wireName = ep.wireParamMap?.[q] || q;
          const safeVar = paramMap.get(q) || q;
          return `${JSON.stringify(wireName)}: ${safeVar}`;
        })
        .join(", ");
      const queryLogic = queryEntries
        ? `    query_params = {k: v for k, v in {${queryEntries}}.items() if v is not None}\n    if query_params:\n        full_url += "?" + urllib.parse.urlencode(query_params, doseq=True)`
        : "";

      const headerEntries = (ep.headerParams || [])
        .map((h) => {
          const wireName = ep.wireParamMap?.[h] || h;
          const safeVar = paramMap.get(h) || h;
          return `    if ${safeVar} is not None:\n        headers[${JSON.stringify(wireName)}] = str(${safeVar})`;
        })
        .join("\n");

      let bodyLogic = "    req_body = None";
      if (ep.hasBody) {
        const nonBody = new Set([
          ...(ep.pathParams || []),
          ...(ep.queryParams || []),
          ...(ep.headerParams || []),
        ]);
        const bodyParams = tool.parameters.filter((p) => !nonBody.has(p.name));
        const bodyEntries = bodyParams
          .map((p) => {
            const wireName = ep.wireParamMap?.[p.name] || p.name;
            const safeVar = paramMap.get(p.name) || p.name;
            return `${JSON.stringify(wireName)}: ${safeVar}`;
          })
          .join(", ");
        bodyLogic = `    headers["Content-Type"] = "application/json"\n    body_dict = {k: v for k, v in {${bodyEntries}}.items() if v is not None}\n    req_body = json.dumps(body_dict).encode("utf-8") if body_dict else None`;
      }

      const authHeaderName = ep.authHeader?.name || "Authorization";
      const authHeaderPrefix =
        ep.authHeader?.prefix !== undefined ? ep.authHeader.prefix : "Bearer ";
      const authPyVal = authHeaderPrefix ? `f"${authHeaderPrefix}{api_key}"` : "str(api_key)";

      pyBody = `    import json
    import os
    import urllib.request
    import urllib.error
    import urllib.parse

    # 1. Substitute path parameters
    endpoint_path = "${ep.path}"
${pathSubs ? `${pathSubs}\n` : ""}
    # 2. Build full URL with query parameters
    clean_base = BASE_URL.rstrip("/")
    clean_path = endpoint_path.lstrip("/")
    full_url = f"{clean_base}/{clean_path}" if clean_path else clean_base
${queryLogic ? `${queryLogic}\n` : ""}
    # 3. Prepare headers
    headers = {"Accept": "application/json"}
    api_key = os.environ.get("API_KEY")
    if api_key:
        headers[${JSON.stringify(authHeaderName)}] = ${authPyVal}
${headerEntries ? `${headerEntries}\n` : ""}
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

    const toolFnName = toSafePythonIdentifier(tool.name);
    const safeToolDesc = escapePythonDocstring(tool.description);
    return `
@mcp.tool()
def ${toolFnName}(${fnArgs}) -> str:
    """${safeToolDesc}

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
        return "z.record(z.string(), z.any())";
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

export function toPascalCase(str: string): string {
  let res = str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[a-z]/, (c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");

  if (!res) {
    res = "Tool";
  }
  if (/^[0-9]/.test(res)) {
    res = `Mcp${res}`;
  }
  return res;
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}
