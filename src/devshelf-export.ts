/**
 * Direct DevShelf Catalog Export
 *
 * Automatically formats newly generated Model Context Protocol (MCP) servers
 * into ready-to-merge DevShelf catalog entries, GitHub issue submissions, and pull requests.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface DevShelfCatalogItem {
  name: string;
  repo: string;
  category: string;
  description: string;
  language: string;
  license: string;
  featured?: boolean;
  goodFirstIssues?: string;
  statusTags: string[];
}

export interface DevShelfExportOptions {
  serverName: string;
  description?: string;
  category?: string;
  repoUrl?: string;
  language?: string;
  license?: string;
  freeTier?: string;
  tags?: string[];
  outputDir?: string;
}

export interface DevShelfExportResult {
  entry: DevShelfCatalogItem;
  filePath: string;
  submissionMarkdown: string;
  submissionUrl: string;
}

/**
 * DevShelf Catalog Exporter
 */
// biome-ignore lint/complexity/noStaticOnlyClass: DevShelf export utility
export class DevShelfExporter {
  public static readonly DEVSHELF_REPO_URL = "https://github.com/RitualDev-Lab/DevShelf";

  /**
   * Creates a structured DevShelf catalog entry conforming to DevShelf's JSON schema
   */
  public static createCatalogItem(options: DevShelfExportOptions): DevShelfCatalogItem {
    const name = options.serverName.trim();
    const defaultRepo = `https://github.com/RitualDev-Lab/${name}`;
    const repo = options.repoUrl || defaultRepo;

    const baseTags = ["MCP Server", "Model Context Protocol", "AI Tooling", "Verified Ready"];
    const customTags = (options.tags || []).filter((t) => !baseTags.includes(t));
    const statusTags = [...baseTags, ...customTags].slice(0, 6);

    let cleanRepo = repo;
    while (cleanRepo.endsWith("/")) {
      cleanRepo = cleanRepo.slice(0, -1);
    }

    return {
      name,
      repo,
      category: options.category || "AI Agent Tools & Protocols",
      description:
        options.description ||
        `Production Model Context Protocol (MCP) server for ${name}, auto-scaffolded with mcp-builder-kit.`,
      language: options.language || "TypeScript / Node.js",
      license: options.license || "Apache-2.0",
      featured: false,
      goodFirstIssues: `${cleanRepo}/issues`,
      statusTags,
    };
  }

  /**
   * Generates a GitHub issue submission body matching DevShelf's auto-add-submission action
   */
  public static formatSubmissionMarkdown(
    item: DevShelfCatalogItem,
    options: { freeTier?: string } = {},
  ): string {
    const freeTier = options.freeTier || "100% Free & Open Source (Self-Hosted / Apache-2.0)";

    return `### Resource Name
${item.name}

### Repository URL
${item.repo}

### Category
${item.category}

### Description
${item.description}

### Language / Runtime
${item.language}

### License
${item.license}

### Free Tier / Pricing Model
${freeTier}

### Status & Feature Tags
${item.statusTags.join(", ")}

---
*Generated automatically by [@ritualdev-lab/mcp-builder-kit](https://github.com/RitualDev-Lab/mcp-builder-kit)*
`.trim();
  }

  /**
   * Generates a 1-click prefilled GitHub Issue submission URL for DevShelf
   */
  public static generateDevShelfSubmissionUrl(
    item: DevShelfCatalogItem,
    options: { freeTier?: string } = {},
  ): string {
    const title = `[Resource Submission]: ${item.name}`;
    const body = DevShelfExporter.formatSubmissionMarkdown(item, options);
    const params = new URLSearchParams({
      title,
      body,
      labels: "submission,community,automated",
    });

    return `${DevShelfExporter.DEVSHELF_REPO_URL}/issues/new?${params.toString()}`;
  }

  /**
   * Exports catalog JSON file and ready-to-merge submission markdown
   */
  public static exportToFiles(
    options: DevShelfExportOptions,
    targetDir?: string,
  ): DevShelfExportResult {
    const destDir = resolve(targetDir || options.outputDir || process.cwd());
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    const item = DevShelfExporter.createCatalogItem(options);
    const submissionMarkdown = DevShelfExporter.formatSubmissionMarkdown(item, {
      freeTier: options.freeTier,
    });
    const submissionUrl = DevShelfExporter.generateDevShelfSubmissionUrl(item, {
      freeTier: options.freeTier,
    });

    const catalogJsonPath = join(destDir, "devshelf-entry.json");
    const submissionMdPath = join(destDir, ".devshelf-submission.md");

    writeFileSync(catalogJsonPath, JSON.stringify(item, null, 2), "utf8");
    writeFileSync(submissionMdPath, submissionMarkdown, "utf8");

    return {
      entry: item,
      filePath: catalogJsonPath,
      submissionMarkdown,
      submissionUrl,
    };
  }
}
