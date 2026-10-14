import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpCodeGenerator } from "./generator.js";
import { OpenApiToMcpConverter } from "./openapi.js";
import { McpProjectScaffolder } from "./scaffolder.js";
import type {
  McpLanguage,
  McpTransport,
  ToolDefinition,
  ToolParameter,
  McpBadgeTier,
} from "./types.js";

function printHelp(): void {
  console.log(`
🚀 mcp-builder-kit - Production Model Context Protocol (MCP) Scaffolding CLI

Usage:
  mcp-builder init <project-name> [options]
  mcp-builder add-tool <tool-name> [options]
  mcp-builder from-openapi <openapi-spec-path> [options]
  mcp-builder inspect "<server-command>"
  mcp-builder audit [target-dir]
  mcp-builder package [target-dir] [options]
  mcp-builder packs [list|install] [pack-id] [options]
  mcp-builder badge <server-name> [options]
  mcp-builder --help
  mcp-builder --version

Commands:
  init <name>              Scaffolds a new MCP server project
  add-tool <name>          Generates typed MCP tool code and JSON schema snippet
  from-openapi <path>      Converts an OpenAPI / Swagger spec into production MCP tools
  inspect <command>        Connects headless inspector to verify MCP JSON-RPC protocol conformance
  audit [dir]              Runs AgentShield Zero-Leak security audit on MCP server source code
  package [dir]            Generates Dockerfile, client configs (Claude/Cursor) & registry manifest
  packs [list|install]     Browse or install enterprise connector packs (Postgres, K8s, Stripe)
  badge <server-name>      Generates cryptographically verified AgentShield badge & checkout URL

Options for 'init':
  --lang, -l               Language: 'typescript' (default) or 'python'
  --transport, -t          Transport: 'stdio' (default), 'sse', or 'both'
  --dir, -d                Target output directory (defaults to ./<project-name>)
  --desc                   Short project description
  --author                 Project author name / organization

Options for 'add-tool':
  --lang, -l               Output language: 'typescript' (default) or 'python'
  --desc                   Tool description
  --params                 Comma-separated list of paramName:type (e.g. "query:string,limit:number")

Options for 'from-openapi':
  --lang, -l               Output language: 'typescript' (default) or 'python'

Examples:
  npx @ritualdev_lab/mcp-builder-kit init my-sqlite-server
  npx @ritualdev_lab/mcp-builder-kit add-tool search_documents --desc "Searches internal knowledge" --params "query:string,limit:number"
  npx @ritualdev_lab/mcp-builder-kit from-openapi ./petstore.json --lang typescript
`);
}

export async function runCli(args: string[] = process.argv.slice(2)): Promise<void> {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log("mcp-builder-kit v0.1.0");
    return;
  }

  const command = args[0];

  // 1. mcp-builder init
  if (command === "init") {
    const projectName = args[1];
    if (!projectName || projectName.startsWith("-")) {
      console.error("❌ Error: Missing project name. Run: mcp-builder init <project-name>");
      process.exit(1);
    }

    let language: McpLanguage = "typescript";
    let transport: McpTransport = "stdio";
    let targetDir = resolve(process.cwd(), projectName);
    let description = "High-performance Model Context Protocol (MCP) server";
    let author = "RitualDev Lab";

    for (let i = 2; i < args.length; i++) {
      const arg = args[i];
      if ((arg === "--lang" || arg === "-l") && args[i + 1]) {
        const langVal = args[i + 1].toLowerCase();
        if (langVal === "typescript" || langVal === "python") {
          language = langVal;
        } else {
          console.error(
            `❌ Error: Invalid language '${args[i + 1]}'. Choose 'typescript' or 'python'.`,
          );
          process.exit(1);
        }
        i++;
      } else if ((arg === "--transport" || arg === "-t") && args[i + 1]) {
        const transVal = args[i + 1].toLowerCase();
        if (transVal === "stdio" || transVal === "sse" || transVal === "both") {
          transport = transVal;
        } else {
          console.error(
            `❌ Error: Invalid transport '${args[i + 1]}'. Choose 'stdio', 'sse', or 'both'.`,
          );
          process.exit(1);
        }
        i++;
      } else if ((arg === "--dir" || arg === "-d") && args[i + 1]) {
        targetDir = resolve(process.cwd(), args[i + 1]);
        i++;
      } else if (arg === "--desc" && args[i + 1]) {
        description = args[i + 1];
        i++;
      } else if (arg === "--author" && args[i + 1]) {
        author = args[i + 1];
        i++;
      }
    }

    console.log(`\n📦 Scaffolding new MCP server: ${projectName}`);
    console.log(`   • Language:  ${language}`);
    console.log(`   • Transport: ${transport}`);
    console.log(`   • Target:    ${targetDir}\n`);

    const result = McpProjectScaffolder.scaffold({
      projectName,
      targetDir,
      language,
      transport,
      description,
      author,
    });

    console.log("✅ Successfully created files:");
    for (const f of result.filesCreated) {
      console.log(`   + ${f}`);
    }

    console.log("\n🎉 Next steps:");
    console.log(`   cd ${projectName}`);
    if (language === "typescript") {
      console.log("   pnpm install  # (or npm install)");
      console.log("   pnpm run build");
      console.log("   pnpm test");
    } else {
      console.log("   python -m venv .venv");
      console.log("   pip install -e .");
      console.log("   pytest");
    }
    console.log("\n👉 Connect to Claude Desktop or Antigravity via instructions in README.md\n");
    return;
  }

  // 2. mcp-builder add-tool
  if (command === "add-tool") {
    const toolName = args[1];
    if (!toolName || toolName.startsWith("-")) {
      console.error("❌ Error: Missing tool name. Run: mcp-builder add-tool <tool-name> [options]");
      process.exit(1);
    }

    let language: McpLanguage = "typescript";
    let description = `Executes ${toolName} operations`;
    const parameters: ToolParameter[] = [];

    for (let i = 2; i < args.length; i++) {
      const arg = args[i];
      if ((arg === "--lang" || arg === "-l") && args[i + 1]) {
        const langVal = args[i + 1].toLowerCase();
        if (langVal === "typescript" || langVal === "python") {
          language = langVal;
        }
        i++;
      } else if (arg === "--desc" && args[i + 1]) {
        description = args[i + 1];
        i++;
      } else if (arg === "--params" && args[i + 1]) {
        const parts = args[i + 1].split(",");
        for (const p of parts) {
          const [pName, pType] = p.split(":");
          if (pName) {
            const rawType = pType?.trim().toLowerCase();
            const validType =
              rawType === "number" ||
              rawType === "boolean" ||
              rawType === "object" ||
              rawType === "array"
                ? rawType
                : "string";
            parameters.push({
              name: pName.trim(),
              type: validType,
              required: true,
            });
          }
        }
        i++;
      }
    }

    const toolDef: ToolDefinition = {
      name: toolName,
      description,
      parameters,
    };

    console.log(`\n🛠️ Generated MCP Tool: '${toolName}' (${language})\n`);
    const code =
      language === "typescript"
        ? McpCodeGenerator.generateTypeScriptTool(toolDef)
        : McpCodeGenerator.generatePythonTool(toolDef);

    console.log(code);
    console.log("\n📋 Copy and paste the snippet above into your MCP server handlers.\n");
    return;
  }

  // 3. mcp-builder from-openapi
  if (command === "from-openapi") {
    const specPath = args[1];
    if (!specPath || specPath.startsWith("-")) {
      console.error(
        "❌ Error: Missing OpenAPI spec file path. Run: mcp-builder from-openapi <spec-path>",
      );
      process.exit(1);
    }

    const fullPath = resolve(process.cwd(), specPath);
    if (!existsSync(fullPath)) {
      console.error(`❌ Error: OpenAPI specification file not found at: ${fullPath}`);
      process.exit(1);
    }

    let language: McpLanguage = "typescript";
    for (let i = 2; i < args.length; i++) {
      const arg = args[i];
      if ((arg === "--lang" || arg === "-l") && args[i + 1]) {
        const langVal = args[i + 1].toLowerCase();
        if (langVal === "typescript" || langVal === "python") {
          language = langVal;
        }
        i++;
      }
    }

    try {
      const content = readFileSync(fullPath, "utf8");
      const spec = JSON.parse(content);

      console.log(`\n🔄 Converting OpenAPI specification to MCP Tools (${language})...`);
      const result = OpenApiToMcpConverter.convert({
        spec,
        language,
      });

      console.log(`✅ Converted ${result.tools.length} endpoints to MCP tools:`);
      for (const t of result.tools) {
        console.log(`   + ${t.name} (${t.parameters.length} parameters)`);
      }

      console.log("\n📦 Generated MCP Code:\n");
      console.log(result.generatedCode);
      return;
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : "Failed to parse spec";
      console.error(`❌ Failed to convert OpenAPI spec: ${errorMsg}`);
      process.exit(1);
    }
  }

  // 4. mcp-builder inspect
  if (command === "inspect") {
    const targetCommand = args[1];
    if (!targetCommand || targetCommand.startsWith("-")) {
      console.error(
        '❌ Error: Missing server command. Run: mcp-builder inspect "node ./dist/index.js"',
      );
      process.exit(1);
    }

    const commandArgs = args.slice(2);
    console.log(`\n🔍 Inspecting MCP Server: ${targetCommand} ${commandArgs.join(" ")}`);
    console.log("   • Connecting via stdio transport...");

    const { McpServerInspector } = await import("./inspector.js");
    const inspector = new McpServerInspector({
      command: targetCommand,
      args: commandArgs,
    });

    try {
      const report = await inspector.inspect();
      console.log("\n================ MCP INSPECTION REPORT ================");
      console.log(
        `Server:           ${report.serverInfo ? `${report.serverInfo.name} (v${report.serverInfo.version})` : "Anonymous"}`,
      );
      console.log(`Protocol Version: ${report.protocolVersion}`);
      console.log(`Latency:          ${report.latencyMs}ms`);
      console.log("\nCapabilities:");
      console.log(`   • Tools:     ${report.capabilities.tools ? "✅ Supported" : "❌ Disabled"}`);
      console.log(
        `   • Resources: ${report.capabilities.resources ? "✅ Supported" : "❌ Disabled"}`,
      );
      console.log(
        `   • Prompts:   ${report.capabilities.prompts ? "✅ Supported" : "❌ Disabled"}`,
      );

      console.log("\nConformance Checks:");
      for (const check of report.conformanceChecks) {
        console.log(`   ${check.passed ? "✅" : "❌"} ${check.name}: ${check.details || ""}`);
      }

      console.log(`\nDiscovered Tools (${report.discoveredTools.length}):`);
      for (const t of report.discoveredTools) {
        console.log(`   🛠️  ${t.name} — ${t.description || "No description"}`);
      }

      console.log("=======================================================\n");
      return;
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : "Inspection failed";
      console.error(`❌ Inspection error: ${errorMsg}`);
      process.exit(1);
    }
  }

  // 5. mcp-builder audit
  if (command === "audit") {
    const targetDir = resolve(process.cwd(), args[1] || ".");
    console.log(`\n🛡️  Running AgentShield Security Audit on: ${targetDir}`);
    console.log("   • Scanning for hardcoded secrets, injection vectors & traversal risks...\n");

    const { AgentShieldMcpAuditor } = await import("./security.js");
    const report = AgentShieldMcpAuditor.auditDirectory(targetDir);

    console.log("================ AGENTSHIELD MCP AUDIT REPORT ================");
    console.log(`Target Directory:   ${report.targetDir}`);
    console.log(`Scanned Files:      ${report.scannedFilesCount}`);
    console.log(
      `Security Score:     ${report.score} / 100 (${report.isSecure ? "✅ SECURE" : "⚠️ VULNERABLE"})`,
    );
    console.log(
      `Findings Summary:   Critical: ${report.summary.critical} | High: ${report.summary.high} | Medium: ${report.summary.medium} | Low: ${report.summary.low}`,
    );

    if (report.findings.length === 0) {
      console.log(
        "\n✨ 0 Vulnerabilities detected! Your MCP server conforms to Zero-Leak standards.",
      );
      const serverSlug = targetDir.split(/[\\/]/).pop() || "my-mcp-server";
      console.log(`\n🏆 Claim your Official "Verified Secure MCP Server" Badge & Certification:`);
      console.log(`   👉 Run: npx @ritualdev_lab/mcp-builder-kit badge ${serverSlug}\n`);
    } else {
      console.log("\nDetected Security Findings:");
      for (const f of report.findings) {
        console.log(`\n[${f.severity.toUpperCase()}] ${f.id}: ${f.description}`);
        console.log(`   File:   ${f.file}${f.line ? `:${f.line}` : ""}`);
        if (f.snippet) {
          console.log(`   Match:  ${f.snippet}`);
        }
        console.log(`   Fix:    ${f.remediation}`);
      }
    }
    if (!report.isSecure) {
      process.exit(1);
    }
    return;
  }

  // 6. mcp-builder package
  if (command === "package") {
    const targetDir = resolve(process.cwd(), args[1] || ".");
    let language: McpLanguage = "typescript";
    let port = 8080;
    const envVars: string[] = [];

    for (let i = 2; i < args.length; i++) {
      const arg = args[i];
      if ((arg === "--lang" || arg === "-l") && args[i + 1]) {
        const langVal = args[i + 1].toLowerCase();
        if (langVal === "typescript" || langVal === "python") {
          language = langVal;
        }
        i++;
      } else if (arg === "--port" && args[i + 1]) {
        port = Number.parseInt(args[i + 1], 10) || 8080;
        i++;
      } else if (arg === "--env" && args[i + 1]) {
        envVars.push(...args[i + 1].split(",").map((s) => s.trim()));
        i++;
      }
    }

    const serverName = targetDir.split(/[\\/]/).pop() || "my-mcp-server";
    console.log(`\n📦 Packaging MCP Server: ${serverName} (${language})`);
    console.log(`   • Target Directory: ${targetDir}`);
    console.log(`   • Port:             ${port}\n`);

    const { McpServerPackager } = await import("./packager.js");
    const result = McpServerPackager.package({
      serverName,
      targetDir,
      language,
      port,
      envVars,
    });

    console.log("✅ Successfully generated configuration & container artifacts:");
    for (const f of result.writtenFiles) {
      console.log(`   + ${f}`);
    }

    console.log("\n📋 Sample Claude Desktop Configuration (claude_desktop_config.json):");
    console.log(JSON.stringify(result.claudeDesktopConfig, null, 2));

    console.log("\n🐳 Multi-arch Docker build command:");
    console.log(`   docker build -t ${serverName}:latest ${targetDir}\n`);
    return;
  }

  // 7. mcp-builder packs (Self-serve enterprise connectors via Dodo Payments)
  if (command === "packs") {
    const subCommand = args[1] || "list";
    const { EnterprisePackManager } = await import("./packs.js");

    if (subCommand === "list") {
      const packs = EnterprisePackManager.getAvailablePacks();
      console.log("\n💎 Enterprise MCP Connector Packs & Starters (Powered by Dodo Payments):");
      console.log("========================================================================\n");

      for (const p of packs) {
        console.log(`📦 ${p.name} ($${p.priceUsd} ${p.type === "one_time" ? "one-time" : "/mo"})`);
        console.log(`   ID:          ${p.id}`);
        console.log(`   Description: ${p.description}`);
        console.log("   Features:");
        for (const feat of p.features) {
          console.log(`     • ${feat}`);
        }
        console.log(`   🛒 Direct Checkout: ${p.checkoutUrl}`);
        console.log(`   ⚡ Install preview:  mcp-builder packs install ${p.id}\n`);
      }
      console.log("========================================================================\n");
      return;
    }

    if (subCommand === "install") {
      const packId = args[2];
      if (!packId) {
        console.error("❌ Error: Missing pack ID. Run: mcp-builder packs install <pack-id>");
        process.exit(1);
      }

      const targetDir = resolve(process.cwd(), args[3] || "./connectors");
      let licenseKey: string | undefined;

      for (let i = 4; i < args.length; i++) {
        if (args[i] === "--license" && args[i + 1]) {
          licenseKey = args[i + 1];
          i++;
        }
      }

      try {
        const result = EnterprisePackManager.installPack(packId, targetDir, licenseKey);
        console.log(`\n🎉 ${result.message}\n`);
        console.log("Generated Connector Stubs:");
        for (const f of result.filesCreated) {
          console.log(`   + ${f}`);
        }
        if (result.checkoutUrl && !licenseKey) {
          console.log(
            "\n🛒 Complete instant self-serve checkout via Dodo Payments to unlock the full connector:",
          );
          console.log(`   👉 ${result.checkoutUrl}\n`);
        }
        return;
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : "Failed to install pack";
        console.error(`❌ ${errorMsg}`);
        process.exit(1);
      }
    }

    console.error(
      `❌ Unknown sub-command '${subCommand}'. Use 'mcp-builder packs list' or 'mcp-builder packs install <pack-id>'`,
    );
    process.exit(1);
  }

  // 8. mcp-builder badge (AgentShield Verified MCP Server Audit Badge & Self-Serve Checkout)
  if (command === "badge") {
    const serverName = args[1];
    if (!serverName || serverName.startsWith("-")) {
      console.error("❌ Error: Missing server name. Run: mcp-builder badge <server-name> [--tier verified|sponsor]");
      process.exit(1);
    }

    let tier: McpBadgeTier = "verified";
    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--tier" && args[i + 1]) {
        const rawTier = args[i + 1].toLowerCase();
        if (rawTier === "verified" || rawTier === "sponsor" || rawTier === "enterprise") {
          tier = rawTier;
        }
        i++;
      }
    }

    const { VerifiedMcpBadgeService } = await import("./badge.js");
    const snippet = VerifiedMcpBadgeService.getBadgeSnippet(serverName, tier);

    console.log(`\n🛡️  AgentShield Verified MCP Server Badge for: '${serverName}' (${tier.toUpperCase()})`);
    console.log("========================================================================\n");
    console.log("Markdown Snippet for README.md:");
    console.log(snippet.markdown);
    console.log("\nHTML Snippet:");
    console.log(snippet.html);
    console.log("\nVerification URL:");
    console.log(`👉 ${snippet.verifyUrl}`);
    console.log("\n🛒 Claim / Certify Official Verified Status via Dodo Payments ($29 - $79):");
    console.log(`👉 ${snippet.checkoutUrl}\n`);
    console.log("========================================================================\n");
    return;
  }

  console.error(
    `❌ Unknown command: '${command}'. Run 'mcp-builder --help' for available commands.`,
  );
  process.exit(1);
}

// Execute when run directly as CLI
if (process.argv[1]?.endsWith("cli.js") || process.argv[1]?.endsWith("cli.ts")) {
  runCli().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
