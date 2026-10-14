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
