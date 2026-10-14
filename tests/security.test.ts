import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe, after } from "node:test";
import { AgentShieldMcpAuditor } from "../src/security.js";

describe("Phase 4: AgentShield Security Audit & Zero-Leak Isolation Suite", () => {
  const tmpAuditDir = join(process.cwd(), ".tmp_test_security_audit");

  if (!existsSync(tmpAuditDir)) {
    mkdirSync(tmpAuditDir, { recursive: true });
  }

  // Create clean server file
  const cleanFilePath = join(tmpAuditDir, "clean-server.ts");
  writeFileSync(
    cleanFilePath,
    `
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
const apiKey = process.env.OPENAI_API_KEY;
console.log("Starting server cleanly");
`,
    "utf8",
  );

  // Create vulnerable server file
  const vulnFilePath = join(tmpAuditDir, "vulnerable-tool.ts");
  writeFileSync(
    vulnFilePath,
    `
import { exec } from "node:child_process";
import fs from "node:fs";

// Leaked hardcoded token
const secretKey = "sk-ant-api03-1234567890abcdef1234567890abcdef";

export function runQuery(cmd: string) {
  // Command injection vulnerability
  exec(\`bash -c \${cmd}\`);
}

export function readFileUnsafe(userPath: string) {
  // Path traversal hazard
  return fs.readFileSync(\`/var/data/\${userPath}\`, "utf8");
}
`,
    "utf8",
  );

  after(() => {
    if (existsSync(tmpAuditDir)) {
      rmSync(tmpAuditDir, { recursive: true, force: true });
    }
  });

  test("accurately flags hardcoded secrets, command injections, and traversal hazards", () => {
    const report = AgentShieldMcpAuditor.auditDirectory(tmpAuditDir);

    assert.ok(report);
    assert.strictEqual(report.isSecure, false);
    assert.ok(report.score < 100);

    // Verify critical secret finding
    const secretFinding = report.findings.find((f) => f.id === "SEC-001");
    assert.ok(secretFinding, "Should detect hardcoded Anthropic API key");
    assert.strictEqual(secretFinding.severity, "critical");

    // Verify command injection finding
    const cmdFinding = report.findings.find((f) => f.id === "SEC-004");
    assert.ok(cmdFinding, "Should detect unsafe exec template interpolation");
    assert.strictEqual(cmdFinding.severity, "critical");

    // Verify path traversal finding
    const traversalFinding = report.findings.find((f) => f.id === "SEC-006");
    assert.ok(traversalFinding, "Should detect unsafe template string in readFileSync");
    assert.strictEqual(traversalFinding.severity, "high");
  });

  test("generates AgentShield zero-leak parameter sanitizer middleware", () => {
    const tsMiddleware = AgentShieldMcpAuditor.generateSanitizerMiddleware("typescript");
    assert.ok(tsMiddleware.includes("sanitizeMcpParam"));
    assert.ok(tsMiddleware.includes("Path traversal escape sequence blocked"));
    assert.ok(tsMiddleware.includes("Unsafe shell meta-characters detected"));

    const pyMiddleware = AgentShieldMcpAuditor.generateSanitizerMiddleware("python");
    assert.ok(pyMiddleware.includes("def sanitize_mcp_param"));
    assert.ok(pyMiddleware.includes("Path traversal escape sequence blocked"));
  });
});
