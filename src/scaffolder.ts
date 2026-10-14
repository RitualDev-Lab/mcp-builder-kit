import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

    let files: GeneratedFile[] = [];
    if (language === "typescript") {
      files = generateTypeScriptTemplate(options);
    } else if (language === "python") {
      files = generatePythonTemplate(options);
    } else {
      throw new Error(`Unsupported language: ${language}. Supported languages: typescript, python`);
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
