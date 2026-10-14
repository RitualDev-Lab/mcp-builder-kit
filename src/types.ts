export type McpLanguage = "typescript" | "python";
export type McpTransport = "stdio" | "sse" | "both";

export interface McpScaffoldOptions {
  projectName: string;
  targetDir: string;
  language?: McpLanguage;
  transport?: McpTransport;
  description?: string;
  author?: string;
  includeAgentShield?: boolean;
  tools?: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface ScaffoldResult {
  success: boolean;
  projectName: string;
  targetDir: string;
  language: McpLanguage;
  transport: McpTransport;
  filesCreated: string[];
}

export type ToolParamType = "string" | "number" | "boolean" | "object" | "array";

export interface ToolParameter {
  name: string;
  type: ToolParamType;
  description?: string;
  required?: boolean;
  default?: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

export interface ResourceDefinition {
  uri: string;
  name: string;
  mimeType: string;
  description?: string;
}

export interface OpenApiConversionOptions {
  spec: Record<string, unknown>;
  serverName?: string;
  language?: McpLanguage;
  baseUrl?: string;
}

export interface OpenApiConversionResult {
  tools: ToolDefinition[];
  generatedCode: string;
}
