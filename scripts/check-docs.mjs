import { execSync } from "node:child_process";

function getChangedFiles() {
  const output = execSync("git diff --name-only HEAD", { encoding: "utf8" }).trim();
  if (!output) {
    return [];
  }
  return output.split(/\r?\n/).filter(Boolean);
}

function main() {
  let files = [];
  try {
    files = getChangedFiles();
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "EPERM") {
      console.warn("[docs-check] skipped: git diff not permitted in this environment.");
      return;
    }
    console.error("[docs-check] git diff failed. Ensure you're in a git repo.");
    throw error;
  }

  if (files.length === 0) {
    return;
  }

  const touchesSrc = files.some((path) => path.startsWith("src/") || path.startsWith("src-tauri/"));
  const touchesDocs = files.some((path) => path.startsWith("docs/"));

  if (touchesSrc && !touchesDocs) {
    console.error("[docs-check] Detected changes under src/ or src-tauri/ without docs updates.");
    console.error("[docs-check] Update docs/现状扫描.md and any related docs per docs/开发规范.md.");
    process.exit(1);
  }
}

main();
