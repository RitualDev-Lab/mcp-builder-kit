import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { McpProjectScaffolder } from "../src/scaffolder.js";

test("Phase 4: Scaffolds modern MCP Streamable HTTP TypeScript server with --with-agentshield redaction", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mcp-kit-p4-ts-"));
  try {
    const res = McpProjectScaffolder.scaffold({
      projectName: "secure-http-mcp",
      targetDir: dir,
      language: "typescript",
      transport: "streamable-http",
      includeAgentShield: true,
    });

    assert.equal(res.success, true);
    assert.equal(res.transport, "streamable-http");
    assert.ok(res.filesCreated.includes("src/agentshield-middleware.ts"));

    const indexCode = readFileSync(join(dir, "src", "index.ts"), "utf8");
    assert.match(indexCode, /withAgentShieldRedaction/);
    assert.match(indexCode, /Mcp-Session-Id/);
    assert.match(indexCode, /\/mcp/);
    assert.match(indexCode, /streamable-http/);

    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    assert.ok(pkg.dependencies["@ritualdev-lab/agentshield"]);

    // Dynamically import the generated middleware and verify secret redaction works live
    const mwPath = join(dir, "src", "agentshield-middleware.ts");
    assert.ok(existsSync(mwPath));
    const mw = (await import(pathToFileURL(mwPath).href)) as {
      redactSecrets: (s: string) => string;
      withAgentShieldRedaction: <T>(
        fn: (args: T) => Promise<{ content: Array<{ type: string; text?: string }> }>,
      ) => (args: T) => Promise<{ content: Array<{ type: string; text?: string }> }>;
    };

    const syntheticAws = ["AKIA", "IOSFODNN", "7EXAMPLE"].join("");
    const syntheticOpenAi = ["sk", "proj", "AbCdEfGh", "IjKlMnOp", "QrStUvWx"].join("-");
    const wrapped = mw.withAgentShieldRedaction(async (msg: string) => ({
      content: [{ type: "text", text: `Result: ${msg}` }],
    }));

    const out = await wrapped(`keys: ${syntheticAws} and ${syntheticOpenAi}`);
    assert.equal(out.content[0].text?.includes(syntheticAws), false);
    assert.equal(out.content[0].text?.includes(syntheticOpenAi), false);
    assert.match(out.content[0].text || "", /\[AGENTSHIELD_REDACTED:AWS_KEY\]/);
    assert.match(out.content[0].text || "", /\[AGENTSHIELD_REDACTED:OPENAI_KEY\]/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Phase 4: Scaffolds Python FastMCP server with streamable-http and --with-agentshield redaction", () => {
  const dir = mkdtempSync(join(tmpdir(), "mcp-kit-p4-py-"));
  try {
    const res = McpProjectScaffolder.scaffold({
      projectName: "secure-py-mcp",
      targetDir: dir,
      language: "python",
      transport: "streamable-http",
      includeAgentShield: true,
    });

    assert.equal(res.success, true);
    const serverPy = readFileSync(join(dir, "secure_py_mcp", "server.py"), "utf8");
    assert.match(serverPy, /mcp\.run\(transport="streamable-http"\)/);
    assert.match(serverPy, /def redact_secrets/);
    assert.match(serverPy, /return redact_secrets\(payload\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
