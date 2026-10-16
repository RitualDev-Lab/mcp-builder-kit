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
  force?: boolean;
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

export interface ApiEndpointMetadata {
  path: string;
  method: string;
  pathParams?: string[];
  queryParams?: string[];
  headerParams?: string[];
  hasBody?: boolean;
  baseUrlVar?: string;
  wireParamMap?: Record<string, string>;
  authHeader?: {
    name: string;
    prefix?: string;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  apiEndpoint?: ApiEndpointMetadata;
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
  warnings?: string[];
}

export interface McpJsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpJsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface McpDiscoveredTool {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpDiscoveredResource {
  uri: string;
  name?: string;
  mimeType?: string;
  description?: string;
}

export interface McpInspectionReport {
  serverCommand: string;
  protocolVersion: string;
  serverInfo?: {
    name: string;
    version: string;
  };
  capabilities: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
  };
  discoveredTools: McpDiscoveredTool[];
  discoveredResources: McpDiscoveredResource[];
  conformanceChecks: {
    name: string;
    passed: boolean;
    details?: string;
  }[];
  latencyMs: number;
}

export type SecurityFindingSeverity = "critical" | "high" | "medium" | "low";

export interface SecurityFinding {
  id: string;
  type:
    | "hardcoded_secret"
    | "command_injection"
    | "path_traversal"
    | "insecure_transport"
    | "wildcard_permission";
  severity: SecurityFindingSeverity;
  file: string;
  line?: number;
  snippet?: string;
  description: string;
  remediation: string;
}

export interface McpSecurityAuditReport {
  targetDir: string;
  scannedFilesCount: number;
  findings: SecurityFinding[];
  score: number; // 0 to 100
  isSecure: boolean;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface McpPackageOptions {
  serverName: string;
  targetDir: string;
  language?: McpLanguage;
  entrypoint?: string;
  port?: number;
  envVars?: string[];
}

export interface McpPackageResult {
  dockerfile: string;
  claudeDesktopConfig: Record<string, unknown>;
  cursorConfig: Record<string, unknown>;
  antigravityConfig: Record<string, unknown>;
  registryManifest: Record<string, unknown>;
  writtenFiles: string[];
}

export interface PremiumPackDefinition {
  id: string;
  name: string;
  category: "database" | "devops" | "payments" | "all_access";
  priceUsd: number;
  type: "one_time" | "subscription";
  description: string;
  checkoutUrl: string;
  features: string[];
  sampleTools: string[];
}

export type McpBadgeTier = "verified" | "sponsor" | "enterprise";

export interface McpBadgeSnippetResult {
  markdown: string;
  html: string;
  svgBadgeUrl: string;
  verifyUrl: string;
  checkoutUrl: string;
  tier: McpBadgeTier;
}

export interface DevShelfSpotlightTier {
  id: string;
  name: string;
  priceUsd: number;
  billingPeriod: "monthly" | "one_time";
  description: string;
  checkoutUrl: string;
  features: string[];
}

export type TurnkeyPackageTierId = "starter" | "pro" | "enterprise";

export interface TurnkeyPackageTier {
  id: TurnkeyPackageTierId;
  name: string;
  priceUsd: number;
  turnaroundDays: string;
  description: string;
  depositCheckoutUrl: string;
  consultationUrl: string;
  deliverables: string[];
  sla: string;
}

export interface TurnkeyInquiryOptions {
  clientName?: string;
  companyName?: string;
  tierId?: TurnkeyPackageTierId;
  projectOverview?: string;
  targetSystems?: string[];
}

export interface TurnkeyInquiryResult {
  inquiryId: string;
  tier: TurnkeyPackageTier;
  clientName: string;
  companyName: string;
  depositCheckoutUrl: string;
  consultationUrl: string;
  intakeSummaryMarkdown: string;
}

export interface FoundationGrantProgram {
  id: string;
  name: string;
  organization: string;
  grantRangeUsd: string;
  focusArea: string;
  applicationUrl: string;
  requirements: string[];
  recommendedPitch: string;
}

export interface OpenSourceBountyItem {
  id: string;
  title: string;
  rewardUsd: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  category: "security" | "connector" | "testing" | "documentation";
  description: string;
  claimUrl: string;
  sponsor: string;
}

export interface GrantsAndBountiesCatalog {
  grants: FoundationGrantProgram[];
  bounties: OpenSourceBountyItem[];
  githubSponsorsUrl: string;
  polarBountiesUrl: string;
}
