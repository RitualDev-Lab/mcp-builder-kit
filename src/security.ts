import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { McpSecurityAuditReport, SecurityFinding } from "./types.js";

/**
 * Built-in Secret Detection and High-Risk Pattern Signatures (Powered by AgentShield engine rules)
 */
interface PatternRule {
  id: string;
  type: SecurityFinding["type"];
  severity: SecurityFinding["severity"];
  regex: RegExp;
  description: string;
  remediation: string;
}

const SECURITY_RULES: PatternRule[] = [
  // 1. Hardcoded Secrets (AgentShield Secret Taxonomy)
  {
    id: "SEC-001",
    type: "hardcoded_secret",
    severity: "critical",
    regex:
      /(?:sk-[a-zA-Z0-9_-]{20,}|sk-ant-[a-zA-Z0-9_-]{20,}|AIzaSy[a-zA-Z0-9_-]{33}|ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})/,
    description: "Detected hardcoded AI or Cloud API key in MCP server source code",
    remediation: "Read credentials from process.env or secret manager instead of source code",
  },
  {
    id: "SEC-002",
    type: "hardcoded_secret",
    severity: "critical",
    regex: /(?:-----BEGIN (?:RSA |EC )?PRIVATE KEY-----)/,
    description: "Detected embedded cryptographic private key block",
    remediation:
      "Load private keys dynamically from secure file path or vault environment variables",
  },
  {
    id: "SEC-003",
    type: "hardcoded_secret",
    severity: "high",
    regex: /(?:AKIA[0-9A-Z]{16})/,
    description: "Detected hardcoded AWS Access Key ID",
    remediation: "Use AWS IAM roles or environment variables (AWS_ACCESS_KEY_ID)",
  },
  // 2. Command Injection & Arbitrary Execution Vulnerabilities
  {
    id: "SEC-004",
    type: "command_injection",
    severity: "critical",
    regex:
      /(?:exec\s*\(\s*`[^`]*\${|execSync\s*\(\s*`[^`]*\${|spawn\s*\([^,]+,\s*\{[^}]*shell:\s*true)/,
    description:
      "Potentially unsafe command execution with unsanitized template interpolation or shell: true",
    remediation:
      "Pass arguments as an array to spawn() without shell: true, or use AgentCommandSandbox",
  },
  {
    id: "SEC-005",
    type: "command_injection",
    severity: "high",
    regex: /(?:os\.system\s*\(|subprocess\.call\s*\([^,]+,\s*shell\s*=\s*True)/,
    description: "Unsafe shell invocation in Python MCP tool (command injection hazard)",
    remediation: "Use subprocess.run(['cmd', arg], shell=False) with tokenized arguments",
  },
  // 3. Path Traversal & Filesystem Escapes
  {
    id: "SEC-006",
    type: "path_traversal",
    severity: "high",
    regex: /(?:readFileSync\s*\(\s*`[^`]*\${|fs\.promises\.readFile\s*\(\s*`[^`]*\${)/,
    description: "Dynamic file read with direct template string (risk of ../ directory traversal)",
    remediation:
      "Validate path against an allowed base directory using path.resolve() and path.relative()",
  },
  // 4. Insecure HTTP / Open SSE Bindings
  {
    id: "SEC-007",
    type: "insecure_transport",
    severity: "medium",
    regex:
      /(?:http:\/\/localhost:\d+|http:\/\/0\.0\.0\.0:\d+|listen\s*\(\s*\d+\s*,\s*["']0\.0\.0\.0["'])/,
    description: "MCP Server listens on 0.0.0.0 or unencrypted plaintext HTTP transport",
    remediation:
      "Bind to 127.0.0.1 for local communication or terminate TLS/HTTPS for remote agents",
  },
];

/**
 * AgentShield Security Auditor & Pre-Flight Linter for MCP Servers
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Security audit utility class
export class AgentShieldMcpAuditor {
  public static auditDirectory(targetDir: string): McpSecurityAuditReport {
    const findings: SecurityFinding[] = [];
    const files = AgentShieldMcpAuditor.getFilesToScan(targetDir);

    for (const file of files) {
      try {
        const content = readFileSync(file, "utf8");
        const lines = content.split("\n");
        const relPath = relative(targetDir, file);

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          const line = lines[lineIdx];

          for (const rule of SECURITY_RULES) {
            const match = line.match(rule.regex);
            if (match) {
              findings.push({
                id: rule.id,
                type: rule.type,
                severity: rule.severity,
                file: relPath.replace(/\\/g, "/"),
                line: lineIdx + 1,
                snippet: line.trim().slice(0, 80),
                description: rule.description,
                remediation: rule.remediation,
              });
            }
          }
        }
      } catch {
        // Skip unreadable files or binary assets
      }
    }

    const summary = {
      critical: findings.filter((f) => f.severity === "critical").length,
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
    };

    // Calculate score out of 100
    const deductions =
      summary.critical * 30 + summary.high * 15 + summary.medium * 5 + summary.low * 2;
    const score = Math.max(0, 100 - deductions);
    const isSecure = summary.critical === 0 && summary.high === 0;

    return {
      targetDir,
      scannedFilesCount: files.length,
      findings,
      score,
      isSecure,
      summary,
    };
  }

  /**
   * Generates production AgentShield Zero-Leak parameter sanitizer middleware for MCP tools
   */
  public static generateSanitizerMiddleware(
    language: "typescript" | "python" = "typescript",
  ): string {
    if (language === "typescript") {
      return `
/**
 * AgentShield Zero-Leak Parameter & Path Sanitizer Middleware
 */
export function sanitizeMcpParam<T>(param: T): T {
  if (typeof param === "string") {
    // Prevent directory traversal escapes
    if (param.includes("../") || param.includes("..\\\\")) {
      throw new Error("Security Violation: Path traversal escape sequence blocked by AgentShield");
    }
    // Prevent command injection characters in path / tool arguments
    if (/[;&|$\`><]/.test(param)) {
      throw new Error("Security Violation: Unsafe shell meta-characters detected in MCP tool arguments");
    }
  }
  return param;
}
`.trim();
    }

    return `
# AgentShield Zero-Leak Parameter & Path Sanitizer Middleware
import re

def sanitize_mcp_param(param):
    if isinstance(param, str):
        if "../" in param or "..\\\\" in param:
            raise ValueError("Security Violation: Path traversal escape sequence blocked by AgentShield")
        if re.search(r"[;&|$\`><]", param):
            raise ValueError("Security Violation: Unsafe shell meta-characters detected in MCP tool arguments")
    return param
`.trim();
  }

  private static getFilesToScan(dir: string): string[] {
    const results: string[] = [];
    if (!existsSync(dir)) return results;

    const ignoreDirs = new Set(["node_modules", "dist", ".git", ".venv", "venv", ".pytest_cache"]);

    function walk(current: string): void {
      const entries = readdirSync(current);
      for (const entry of entries) {
        if (ignoreDirs.has(entry)) continue;
        const fullPath = join(current, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (
          entry.endsWith(".ts") ||
          entry.endsWith(".js") ||
          entry.endsWith(".py") ||
          entry.endsWith(".json") ||
          entry.endsWith(".env")
        ) {
          results.push(fullPath);
        }
      }
    }

    walk(dir);
    return results;
  }
}
