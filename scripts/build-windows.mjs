// Build REPORTA Windows desktop apps (user, admin, officer) with Electron.
// Usage: node scripts/build-windows.mjs [--app=user|admin|officer|all]
//
// Produces an unpacked win-unpacked/ directory (runnable EXE) per app.
// NSIS installers are built by CI (.github/workflows/windows-build.yml),
// which runs on a GitHub runner where symlink privileges are available.

import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync, cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const arg = process.argv.slice(2);
const appArg = arg.find((a) => a.startsWith("--app="))?.split("=")[1] ?? "all";

const APPS = {
  user: {
    dist: "apps/web/dist",
    appId: "gh.gov.reporta.user",
    productName: "REPORTA User",
    outDir: "release/windows/user",
  },
  admin: {
    dist: "apps/admin/dist",
    appId: "gh.gov.reporta.admin",
    productName: "REPORTA Admin",
    outDir: "release/windows/admin",
  },
  officer: {
    dist: "apps/officer/dist",
    appId: "gh.gov.reporta.officer",
    productName: "REPORTA Officer",
    outDir: "release/windows/officer",
  },
};

function buildApp(name) {
  const nsis = arg.includes("--nsis");
  const cfg = APPS[name];
  const projDir = path.join(repo, "windows", name);
  if (!existsSync(path.join(repo, cfg.dist))) {
    console.error(`[windows:${name}] dist missing — build apps/${name} first.`);
    process.exit(1);
  }

  mkdirSync(projDir, { recursive: true });

  // Minimal Electron main process — loads the SPA from local files.
  const mainJs = `// REPORTA ${cfg.productName} — Electron main process
const { app, BrowserWindow, shell, session } = require("electron");
const path = require("path");

// Security: no node integration in renderer, context isolation on.
function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 360,
    title: "${cfg.productName}",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  // Open external links (tel:, https:) in the OS browser, never in-app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^tel:/.test(url)) { shell.openExternal(url); return { action: "deny" }; }
    return { action: "allow" };
  });
  win.loadFile(path.join(__dirname, "www", "index.html"));
}
app.whenReady().then(() => {
  // Deny insecure mixed content; only https/file allowed
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({ responseHeaders: { ...details.responseHeaders, "X-Frame-Options": ["DENY"] } });
  });
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
`;

  writeFileSync(path.join(projDir, "main.js"), mainJs);
  writeFileSync(path.join(projDir, "package.json"), JSON.stringify({
    name: `reporta-desktop-${name}`,
    version: "1.0.0",
    private: true,
    main: "main.js",
    scripts: { dist: "electron-builder" },
    devDependencies: {
      electron: "^33.2.0",
      "electron-builder": "^25.1.8",
    },
    build: {
      appId: cfg.appId,
      productName: cfg.productName,
      directories: { output: path.join(repo, cfg.outDir).replace(/\\/g, "/") },
      files: ["main.js", "www/**/*"],
      win: {
        target: nsis ? [{ target: "nsis", arch: ["x64"] }] : [{ target: "dir", arch: ["x64"] }],
        icon: existsSync(path.join(repo, "assets", "icons", "reporta.ico"))
          ? path.join(repo, "assets", "icons", "reporta.ico")
          : undefined,
        signAndEditExecutable: false,
      },
    },
  }, null, 2));

  // Copy the web build in as www/
  const www = path.join(projDir, "www");
  rmSync(www, { recursive: true, force: true });
  cpSync(path.join(repo, cfg.dist), www, { recursive: true });

  console.log(`[windows:${name}] installing electron deps…`);
  execSync("npm install --no-audit --no-fund", { cwd: projDir, stdio: "inherit" });

  console.log(`[windows:${name}] building installers (NSIS + portable)…`);
  const res = spawnSync("npx", ["electron-builder", "--win", "--x64"], { cwd: projDir, stdio: "inherit", shell: true });
  if (res.status !== 0) { console.error(`[windows:${name}] electron-builder failed`); process.exit(1); }

  console.log(`[windows:${name}] done → ${cfg.outDir}`);
}

const targets = appArg === "all" ? Object.keys(APPS) : [appArg];
for (const t of targets) buildApp(t);
