import { execFileSync } from "node:child_process";

/**
 * Resolves the available Python executable ('python' or 'python3') across platforms.
 * Returns null if Python is not present in PATH.
 */
export function getPythonCommand(): string | null {
  for (const cmd of ["python", "python3"]) {
    try {
      execFileSync(cmd, ["--version"], { stdio: "ignore" });
      return cmd;
    } catch {
      // Continue to next candidate
    }
  }
  return null;
}
