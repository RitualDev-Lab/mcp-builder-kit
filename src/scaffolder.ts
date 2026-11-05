import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { generateEnterpriseRagTemplate } from "./templates/enterprise-rag.js";
import { generateFinancialLedgerTemplate } from "./templates/financial-ledger.js";
import { generateK8sOpsAgentTemplate } from "./templates/k8s-ops-agent.js";
import { generatePythonTemplate } from "./templates/python.js";
import { generateTypeScriptTemplate } from "./templates/typescript.js";
import type { GeneratedFile, McpScaffoldOptions, ScaffoldResult } from "./types.js";

/**
 * Scaffolds a complete MCP server project from scratch
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Scaffolder utility class
export class McpProjectScaffolder {
  public static scaffold(options: McpScaffoldOptions): ScaffoldResult {
    const language = options.language || "typescript";
    const transport = options.transport || "stdio";
    const targetDir = resolve(options.targetDir);
    const force = Boolean(options.force);

    let files: GeneratedFile[] = [];
    if (options.template === "enterprise-rag") {
      files = generateEnterpriseRagTemplate(options);
    } else if (options.template === "k8s-ops-agent") {
      files = generateK8sOpsAgentTemplate(options);
    } else if (options.template === "financial-ledger") {
      files = generateFinancialLedgerTemplate(options);
    } else if (language === "typescript") {
      files = generateTypeScriptTemplate(options);
    } else if (language === "python") {
      files = generatePythonTemplate(options);
    } else {
      throw new Error(`Unsupported language: ${language}. Supported languages: typescript, python`);
    }

    // Safety check: Prevent accidental destructive overwrite unless explicitly forced
    if (!force) {
      const conflictingFiles: string[] = [];
      for (const file of files) {
        const fullPath = join(targetDir, file.path);
        if (existsSync(fullPath)) {
          conflictingFiles.push(file.path);
        }
      }

      if (conflictingFiles.length > 0) {
        throw new Error(
          `Scaffolding aborted: target directory '${targetDir}' already contains existing files:\n${conflictingFiles.map((f) => `  - ${f}`).join("\n")}\nPass --force to overwrite existing files.`,
        );
      }
    }

    const filesCreated: string[] = [];

    for (const file of files) {
      const fullPath = join(targetDir, file.path);
      const dir = dirname(fullPath);

      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(fullPath, file.content, "utf8");
      filesCreated.push(file.path);
    }

    return {
      success: true,
      projectName: options.projectName,
      targetDir,
      language,
      transport,
      filesCreated,
    };
  }
}
