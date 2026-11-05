// Package the REPORTA WordPress theme into an installable ZIP.
// Usage: node scripts/package-wordpress.mjs
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const themeSrc = path.join(repo, "wordpress", "reporta-theme");
const outDir = path.join(repo, "release", "wordpress");
const zipPath = path.join(outDir, "REPORTA-WordPress-Theme.zip");

// Validate required theme files before packaging
const required = ["style.css", "index.php", "functions.php", "app-shell.php"];
for (const f of required) {
  if (!existsSync(path.join(themeSrc, f))) {
    console.error(`[package-wordpress] MISSING required theme file: ${f}`);
    process.exit(1);
  }
}

// Verify the compiled asset referenced by functions.php exists
const fnSource = readFileSync(path.join(themeSrc, "functions.php"), "utf8");
const jsMatch = fnSource.match(/define\(\s*'REPORTA_JS',\s*'([^']+)'\s*\)/);
if (!jsMatch) {
  console.error("[package-wordpress] cannot find REPORTA_JS in functions.php");
  process.exit(1);
}
const assetPath = path.join(themeSrc, "assets", jsMatch[1]);
if (!existsSync(assetPath)) {
  console.error(`[package-wordpress] JS asset referenced but missing: ${jsMatch[1]}`);
  console.error("[package-wordpress] Run scripts/stage-theme.ps1 after building apps/web first.");
  process.exit(1);
}
console.log(`[package-wordpress] asset verified: ${jsMatch[1]} (${statSync(assetPath).size} bytes)`);

mkdirSync(outDir, { recursive: true });
if (existsSync(zipPath)) rmSync(zipPath, { force: true });

// Package via PowerShell script file (avoids inline quoting issues)
const psScript = path.join(repo, "scripts", "zip-theme.ps1");
execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScript}"`, { stdio: "inherit" });

const size = statSync(zipPath).size;
console.log(`[package-wordpress] created ${zipPath} (${(size / 1024).toFixed(1)} KB)`);
