import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { McpProjectScaffolder } from "./scaffolder.js";
import { McpCodeGenerator } from "./generator.js";
import { OpenApiToMcpConverter } from "./openapi.js";
import type { McpLanguage, McpTransport, ToolDefinition, ToolParameter } from "./types.js";

function printHelp(): void {
  console.log(`
🚀 mcp-builder-kit - Production Model Context Protocol (MCP) Scaffolding CLI

Usage:
  mcp-builder init <project-name> [options]
  mcp-builder add-tool <tool-name> [options]
  mcp-builder from-openapi <openapi-spec-path> [options]
  mcp-builder --help
  mcp-builder --version

Commands:
  init <name>              Scaffolds a new MCP server project
  add-tool <name>          Generates typed MCP tool code and JSON schema snippet
  from-openapi <path>      Converts an OpenAPI / Swagger spec into production MCP tools

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
          console.error(`❌ Error: Invalid language '${args[i + 1]}'. Choose 'typescript' or 'python'.`);
          process.exit(1);
        }
        i++;
      } else if ((arg === "--transport" || arg === "-t") && args[i + 1]) {
        const transVal = args[i + 1].toLowerCase();
        if (transVal === "stdio" || transVal === "sse" || transVal === "both") {
          transport = transVal;
        } else {
          console.error(`❌ Error: Invalid transport '${args[i + 1]}'. Choose 'stdio', 'sse', or 'both'.`);
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
              rawType === "number" || rawType === "boolean" || rawType === "object" || rawType === "array"
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
      console.error("❌ Error: Missing OpenAPI spec file path. Run: mcp-builder from-openapi <spec-path>");
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

  console.error(`❌ Unknown command: '${command}'. Run 'mcp-builder --help' for available commands.`);
  process.exit(1);
}

// Execute when run directly as CLI
if (process.argv[1]?.endsWith("cli.js") || process.argv[1]?.endsWith("cli.ts")) {
  runCli().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
