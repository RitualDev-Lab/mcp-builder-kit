import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { McpCodeGenerator } from "./generator.js";
import { OpenApiToMcpConverter } from "./openapi.js";
import { McpProjectScaffolder } from "./scaffolder.js";
import type {
  McpBadgeTier,
  McpLanguage,
  McpTransport,
  ToolDefinition,
  ToolParameter,
} from "./types.js";

function getPackageVersion(): string {
  try {
    const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), "../package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      if (pkg.version) return pkg.version;
    }
  } catch {
    // fallback
  }
  return "1.2.3";
}

function printHelp(): void {
  console.log(`
🚀 mcp-builder-kit - Production Model Context Protocol (MCP) Scaffolding CLI

Usage:
  npx @ritualdev-lab/mcp-builder-kit <command> [options]
  mcp-builder init [project-name] [options]
  mcp-kit init [project-name] [options]
  mcp-builder-kit init [project-name] [options]

Commands:
  init [project-name] [options]
  add-tool <tool-name> [options]
  from-openapi <openapi-spec-path> [options]
  inspect "<server-command>" [--ci]
  deploy [--target cloudflare-workers|cloud-run]
  ui [--port 4100]
  benchmark [--iterations 25]
  audit [target-dir]
  package [target-dir] [options]
  packs [list|install] [pack-id] [options]
  badge <server-name> [options]
  spotlight <server-name> [options]
  turnkey [starter|pro|enterprise] [options]
  grants [grant-id]
  bounties
  --help
  --version

Commands:
  init [name]              Scaffolds a new MCP server project (interactive wizard if omitted)
  add-tool <name>          Generates typed MCP tool code and JSON schema snippet
  from-openapi <path>      Converts an OpenAPI / Swagger spec into production MCP tools
  inspect <command>        Connects headless inspector to verify MCP JSON-RPC protocol conformance (--ci)
  deploy                   Generates serverless Cloudflare Workers or Cloud Run container deployment
  ui                       Launches lightweight local Visual Inspector Web UI & live testing studio
  audit [dir]              Runs AgentShield Zero-Leak security audit on MCP server source code
  package [dir]            Generates Dockerfile, client configs (Claude/Cursor) & registry manifest
  packs [list|install]     Browse or install enterprise connector packs (Postgres, K8s, Stripe)
  badge <server-name>      Generates cryptographically verified AgentShield badge & checkout URL
  spotlight <server-name>  Generates DevShelf Featured Spotlight placement and Dodo checkout link
  turnkey [tier]           Initiates B2B turnkey custom MCP server development inquiry & deposit link
  grants [id]              Browse foundation ecosystem grants ($1k-$25k) and generate grant pitch
  bounties                 Browse funded open-source bounties with Polar.sh rewards

Options for 'init':
  --lang, -l               Language: 'typescript' (default) or 'python'
  --transport, -t          Transport: 'stdio' (default), 'sse', or 'both'
  --dir, -d                Target output directory (defaults to ./<project-name>)
  --desc                   Short project description
  --author                 Project author name / organization
  --force, -f              Overwrite existing files in target directory without aborting
  --interactive, -i        Launch interactive step-by-step TUI wizard

Options for 'inspect':
  --ci                     Exit with status code 1 if any conformance check fails

Options for 'deploy':
  --target                 Deployment target: 'cloudflare-workers' (default) or 'cloud-run'
  --dir, -d                Target output directory (defaults to current directory)

Options for 'ui':
  --port, -p               Local port for Visual Inspector UI (default: 4100)

Options for 'add-tool':
  --lang, -l               Output language: 'typescript' (default) or 'python'
  --desc                   Tool description
  --params                 Comma-separated list of paramName:type (e.g. "query:string,limit:number")

Options for 'from-openapi':
  --lang, -l               Output language: 'typescript' (default) or 'python'

Examples:
  npx @ritualdev-lab/mcp-builder-kit init my-sqlite-server
  npx @ritualdev-lab/mcp-builder-kit add-tool search_documents --desc "Searches internal knowledge" --params "query:string,limit:number"
  npx @ritualdev-lab/mcp-builder-kit from-openapi ./petstore.json --lang typescript
`);
}

export async function runCli(args: string[] = process.argv.slice(2)): Promise<void> {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(`mcp-builder-kit v${getPackageVersion()}`);
    return;
  }

  const command = args[0];

  // 1. mcp-builder init
  if (command === "init") {
    let projectName = args[1];
    const isInteractiveFlag =
      args.includes("--interactive") ||
      args.includes("-i") ||
      !projectName ||
      projectName.startsWith("-");

    let language: McpLanguage = "typescript";
    let transport: McpTransport = "stdio";
    let targetDir = "";
    let description = "High-performance Model Context Protocol (MCP) server";
    let author = "RitualDev Lab";

    if (
      isInteractiveFlag &&
      (!projectName ||
        projectName.startsWith("-") ||
        args.includes("--interactive") ||
        args.includes("-i"))
    ) {
      console.log("\n🧙 Welcome to the Interactive MCP Server Wizard!\n");
      const rl = readline.createInterface({ input, output });
      try {
        if (!projectName || projectName.startsWith("-")) {
          const ansName = await rl.question("? Project name (e.g. my-mcp-server): ");
          projectName = ansName.trim() || "my-mcp-server";
        }

        const ansLang = await rl.question("? Language [1: TypeScript (default), 2: Python]: ");
        language =
          ansLang.trim() === "2" || ansLang.toLowerCase().includes("python")
            ? "python"
            : "typescript";

        const ansTrans = await rl.question("? Transport [1: stdio (default), 2: sse, 3: both]: ");
        const transTrim = ansTrans.trim();
        if (transTrim === "2" || transTrim.toLowerCase() === "sse") transport = "sse";
        else if (transTrim === "3" || transTrim.toLowerCase() === "both") transport = "both";
        else transport = "stdio";

        const ansDesc = await rl.question("? Short description (optional): ");
        if (ansDesc.trim()) description = ansDesc.trim();

        const ansAuthor = await rl.question("? Author / Organization (default: RitualDev Lab): ");
        if (ansAuthor.trim()) author = ansAuthor.trim();
      } finally {
        rl.close();
      }
    }

    targetDir = resolve(process.cwd(), projectName);

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
      } else if (arg === "--template" && args[i + 1]) {
        if (args[i + 1].toLowerCase() === "devshelf") {
          description = "DevShelf Public Directory & Verified Free Tools MCP Provider";
        }
        i++;
      }
    }

    console.log(`\n📦 Scaffolding new MCP server: ${projectName}`);
    console.log(`   • Language:  ${language}`);
    console.log(`   • Transport: ${transport}`);
    const force = args.includes("--force") || args.includes("-f");

    try {
      const result = McpProjectScaffolder.scaffold({
        projectName,
        targetDir,
        language,
        transport,
        description,
        author,
        force,
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
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ ${errMsg}\n`);
      process.exit(1);
    }
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
          const [pNameRaw, pTypeRaw] = p.split(":");
          if (pNameRaw) {
            let pName = pNameRaw.trim();
            let isRequired = true;
            if (pName.endsWith("?")) {
              pName = pName.slice(0, -1);
              isRequired = false;
            }
            const rawType = pTypeRaw?.trim().toLowerCase();
            const isOptionalType = rawType?.includes("optional") || rawType?.endsWith("?");
            if (isOptionalType) {
              isRequired = false;
            }
            const cleanType = rawType?.replace(/[\s?]|optional/g, "");
            const validType =
              cleanType === "number" ||
              cleanType === "boolean" ||
              cleanType === "object" ||
              cleanType === "array"
                ? cleanType
                : "string";
            parameters.push({
              name: pName,
              type: validType,
              required: isRequired,
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

    const isCi = args.includes("--ci");
    const commandArgs = args.slice(2).filter((a) => a !== "--ci");
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
      let hasFailedCheck = false;
      for (const check of report.conformanceChecks) {
        if (!check.passed) hasFailedCheck = true;
        console.log(`   ${check.passed ? "✅" : "❌"} ${check.name}: ${check.details || ""}`);
      }

      console.log(`\nDiscovered Tools (${report.discoveredTools.length}):`);
      for (const t of report.discoveredTools) {
        console.log(`   🛠️  ${t.name} — ${t.description || "No description"}`);
      }

      console.log("=======================================================\n");

      if (isCi && hasFailedCheck) {
        console.error("❌ MCP Conformance Check Failed under CI gate!");
        process.exit(1);
      }
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
      console.log(`   👉 Run: npx @ritualdev-lab/mcp-builder-kit badge ${serverSlug}\n`);
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
      console.error(
        "❌ Error: Missing server name. Run: mcp-builder badge <server-name> [--tier verified|sponsor]",
      );
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

    console.log(
      `\n🛡️  AgentShield Verified MCP Server Badge for: '${serverName}' (${tier.toUpperCase()})`,
    );
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

  // 9. mcp-builder spotlight (DevShelf Featured MCP Directory Spotlight via Dodo Payments)
  if (command === "spotlight") {
    const serverName = args[1];
    if (!serverName || serverName.startsWith("-")) {
      console.error(
        "❌ Error: Missing server name. Run: mcp-builder spotlight <server-name> [--tier monthly|takeover]",
      );
      process.exit(1);
    }

    let tierId = "mcp-featured-monthly";
    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--tier" && args[i + 1]) {
        const rawTier = args[i + 1].toLowerCase();
        if (rawTier === "takeover" || rawTier === "mcp-category-takeover") {
          tierId = "mcp-category-takeover";
        }
        i++;
      }
    }

    const { DevShelfSpotlightService } = await import("./spotlight.js");
    const spotlight = DevShelfSpotlightService.generateSpotlightSubmission(serverName, tierId);

    console.log(`\n🌟 DevShelf Featured MCP Directory Spotlight: '${serverName}'`);
    console.log("========================================================================\n");
    console.log(
      `Tier:             ${spotlight.tier.name} ($${spotlight.tier.priceUsd} / ${spotlight.tier.billingPeriod})`,
    );
    console.log(`Description:      ${spotlight.tier.description}`);
    console.log("\nIncluded Growth & Visibility Features:");
    for (const feat of spotlight.tier.features) {
      console.log(`   • ${feat}`);
    }
    console.log("\nFeatured on DevShelf Badge for README.md:");
    console.log(spotlight.featuredBadgeMarkdown);
    console.log("\n🛒 Complete Self-Serve Checkout via Dodo Payments:");
    console.log(`👉 ${spotlight.checkoutUrl}`);
    console.log("\n📬 Submit Tool to DevShelf Directory:");
    console.log(`👉 ${spotlight.directorySubmitUrl}\n`);
    console.log("========================================================================\n");
    return;
  }

  if (command === "turnkey") {
    let tierId: "starter" | "pro" | "enterprise" = "starter";
    let clientName: string | undefined;
    let companyName: string | undefined;
    let projectOverview: string | undefined;

    const rawTier = (args[1] ?? "").toLowerCase();
    if (rawTier === "pro") {
      tierId = "pro";
    } else if (rawTier === "enterprise") {
      tierId = "enterprise";
    } else if (rawTier === "starter") {
      tierId = "starter";
    }

    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--client" && args[i + 1]) {
        clientName = args[i + 1];
        i++;
      } else if (args[i] === "--company" && args[i + 1]) {
        companyName = args[i + 1];
        i++;
      } else if (args[i] === "--overview" && args[i + 1]) {
        projectOverview = args[i + 1];
        i++;
      } else if (args[i] === "--tier" && args[i + 1]) {
        const val = args[i + 1].toLowerCase();
        if (val === "pro" || val === "enterprise" || val === "starter") {
          tierId = val;
        }
        i++;
      }
    }

    const { TurnkeyMcpService } = await import("./turnkey.js");
    const inquiry = TurnkeyMcpService.generateInquiry({
      tierId,
      clientName,
      companyName,
      projectOverview,
    });

    console.log("\n========================================================================");
    console.log(inquiry.intakeSummaryMarkdown);
    console.log("\n========================================================================");
    console.log("\n💳 50% Milestone Deposit Checkout (Dodo Payments):");
    console.log(`👉 ${inquiry.depositCheckoutUrl}`);
    console.log("\n📅 Architecture Discovery Booking:");
    console.log(`👉 ${inquiry.consultationUrl}\n`);
    console.log("========================================================================\n");
    return;
  }

  if (command === "grants") {
    const grantId = args[1];
    const { GrantsAndBountiesService } = await import("./grants.js");

    if (grantId) {
      const pitch = GrantsAndBountiesService.generatePitchSummary(grantId);
      console.log("\n========================================================================");
      console.log(pitch);
      console.log("========================================================================\n");
      return;
    }

    const grants = GrantsAndBountiesService.getGrants();
    console.log("\n🏛️ Active Open-Source & AI Foundation Grant Programs ($1k - $25k+):");
    console.log("========================================================================\n");
    for (const g of grants) {
      console.log(`• ${g.name} (${g.organization})`);
      console.log(`  Funding Range:  ${g.grantRangeUsd}`);
      console.log(`  Focus Area:     ${g.focusArea}`);
      console.log(`  Application:    👉 ${g.applicationUrl}\n`);
    }
    console.log(
      "Tip: Run 'mcp-builder grants <grant-id>' to generate a targeted narrative pitch.\n",
    );
    console.log("========================================================================\n");
    return;
  }

  if (command === "bounties") {
    const { GrantsAndBountiesService } = await import("./grants.js");
    const catalog = GrantsAndBountiesService.getCatalog();

    console.log("\n💰 Active Open-Source Developer Bounties & Community Rewards:");
    console.log("========================================================================\n");
    for (const b of catalog.bounties) {
      console.log(
        `• [${b.difficulty.toUpperCase()}] ${b.title} — $${b.rewardUsd.toLocaleString()}`,
      );
      console.log(`  Category:    ${b.category} | Sponsor: ${b.sponsor}`);
      console.log(`  Summary:     ${b.description}`);
      console.log(`  Claim Issue: 👉 ${b.claimUrl}\n`);
    }
    console.log("💜 GitHub Sponsors:");
    console.log(`👉 ${catalog.githubSponsorsUrl}`);
    console.log("\n⚡ Polar.sh Contributor Bounties:");
    console.log(`👉 ${catalog.polarBountiesUrl}\n`);
    console.log("========================================================================\n");
    return;
  }

  // 12. mcp-builder deploy
  if (command === "deploy") {
    let target: "cloudflare-workers" | "cloud-run" = "cloudflare-workers";
    let targetDir = process.cwd();

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg === "--target" && args[i + 1]) {
        const tVal = args[i + 1].toLowerCase();
        if (tVal === "cloudflare-workers" || tVal === "cloud-run") {
          target = tVal;
        } else {
          console.error(
            `❌ Error: Invalid target '${args[i + 1]}'. Choose 'cloudflare-workers' or 'cloud-run'.`,
          );
          process.exit(1);
        }
        i++;
      } else if ((arg === "--dir" || arg === "-d") && args[i + 1]) {
        targetDir = resolve(process.cwd(), args[i + 1]);
        i++;
      }
    }

    console.log("\n🚀 Generating Serverless MCP Deployment Configuration");
    console.log(`   • Target Platform: ${target}`);
    console.log(`   • Output Dir:      ${targetDir}\n`);

    const { McpServerDeployer } = await import("./deployer.js");
    const result = McpServerDeployer.generateDeployment({
      target,
      outputDir: targetDir,
    });

    console.log("✅ Created Serverless Deployment Manifests:");
    for (const f of result.filesCreated) {
      console.log(`   + ${f}`);
    }

    console.log("\n📦 Deployment Instructions:");
    for (const step of result.deployInstructions) {
      console.log(`   ${step}`);
    }
    console.log("");
    return;
  }

  // 13. mcp-builder ui
  if (command === "ui") {
    let port = 4100;
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if ((arg === "--port" || arg === "-p") && args[i + 1]) {
        const p = Number.parseInt(args[i + 1], 10);
        if (!Number.isNaN(p)) port = p;
        i++;
      }
    }

    const { McpVisualInspectorServer } = await import("./dashboard.js");
    const server = new McpVisualInspectorServer({ port });
    const instance = await server.start();

    console.log("\n⚡ MCP Visual Inspector & Studio started!");
    console.log(`👉 Open in browser: \x1b[36m${instance.url}\x1b[0m`);
    console.log("Press Ctrl+C to stop.\n");

    // Keep process alive unless terminated
    await new Promise(() => {});
    return;
  }

  // 14. mcp-builder benchmark
  if (command === "benchmark") {
    let iterations = 25;
    for (let i = 1; i < args.length; i++) {
      if ((args[i] === "--iterations" || args[i] === "-i") && args[i + 1]) {
        const iter = Number.parseInt(args[i + 1], 10);
        if (!Number.isNaN(iter) && iter > 0) iterations = iter;
        i++;
      }
    }

    console.log(
      `\n⚡ [mcp-builder-kit] Running OpenAPI conversion & scaffolding benchmark (${iterations} iterations)...`,
    );
    const { McpBenchmarkEngine } = await import("./benchmark.js");
    const metrics = McpBenchmarkEngine.runBenchmark(iterations);

    console.log("┌──────────────────────────────────────────────────────────────┐");
    console.log("│ 📊 Performance Benchmark Metrics:                            │");
    console.log(
      `│   Total Endpoints Converted:   ${String(metrics.openApiEndpointsConverted).padEnd(29)} │`,
    );
    console.log(`│   Total Benchmark Time:        ${`${metrics.totalTimeMs}ms`.padEnd(29)} │`);
    console.log(
      `│   Avg Conversion Latency:      ${`${metrics.avgConversionMs.toFixed(2)}ms`.padEnd(29)} │`,
    );
    console.log(
      `│   Avg Tool Gen Latency:        ${`${metrics.avgToolGenMs.toFixed(3)}ms`.padEnd(29)} │`,
    );
    console.log(
      `│   Conversion Throughput:       ${`${metrics.throughputEndpointsPerSec} endpoints/s`.padEnd(29)} │`,
    );
    console.log("└──────────────────────────────────────────────────────────────┘");

    if (metrics.passed) {
      console.log("🎉 Benchmark passed within performance SLO targets (<50ms conversion).\n");
      return;
    }

    console.warn("⚠️ Warning: Benchmark exceeded execution budget target.\n");
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
