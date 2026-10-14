import { resolve } from "node:path";
import { McpProjectScaffolder } from "./scaffolder.js";
import type { McpLanguage, McpTransport } from "./types.js";

function printHelp(): void {
  console.log(`
🚀 mcp-builder-kit - Production Model Context Protocol (MCP) Scaffolding CLI

Usage:
  mcp-builder init <project-name> [options]
  mcp-builder --help
  mcp-builder --version

Options:
  --lang, -l       Language: 'typescript' (default) or 'python'
  --transport, -t  Transport: 'stdio' (default), 'sse', or 'both'
  --dir, -d        Target output directory (defaults to ./<project-name>)
  --desc           Short project description
  --author         Project author name / organization

Examples:
  npx @ritualdev_lab/mcp-builder-kit init my-sqlite-server
  npx @ritualdev_lab/mcp-builder-kit init weather-mcp --lang python
  npx @ritualdev_lab/mcp-builder-kit init devops-mcp --transport sse --desc "DevOps automation MCP server"
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
