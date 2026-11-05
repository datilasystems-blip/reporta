// Build REPORTA Android APKs (user + admin) via Capacitor.
// Prerequisites: JDK 17+, Android SDK (ANDROID_HOME set), Gradle.
// Usage: node scripts/build-android.mjs [--app=user|admin|both] [--release]
//
// If the Android SDK is not installed this script prints a clear setup guide
// and exits non-zero without fabricating artifacts.

import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const args = process.argv.slice(2);
const appArg = args.find((a) => a.startsWith("--app="))?.split("=")[1] ?? "both";
const release = args.includes("--release");

const APPS = {
  user: {
    dist: path.join(repo, "apps", "web", "dist"),
    appId: "gh.gov.reporta.user",
    appName: "REPORTA User",
    project: path.join(repo, "android", "user"),
  },
  admin: {
    dist: path.join(repo, "apps", "admin", "dist"),
    appId: "gh.gov.reporta.admin",
    appName: "REPORTA Admin",
    project: path.join(repo, "android", "admin"),
  },
  officer: {
    dist: path.join(repo, "apps", "officer", "dist"),
    appId: "gh.gov.reporta.officer",
    appName: "REPORTA Officer",
    project: path.join(repo, "android", "officer"),
  },
};

function checkAndroidSdk() {
  const home = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!home || !existsSync(home)) {
    console.error(`
[android:build] Android SDK not found (ANDROID_HOME is not set).

To build APKs on this machine:
  1. Install Android Studio (https://developer.android.com/studio)
  2. Set ANDROID_HOME to the SDK path (e.g. C:\\Users\\<you>\\AppData\\Local\\Android\\Sdk)
  3. Run this script again.

Alternatively the GitHub Actions workflow at .github/workflows/android-build.yml
builds both APKs on every push — no local SDK required.
`);
    process.exit(1);
  }
  return home;
}

async function buildApp(name) {
  const cfg = APPS[name];
  if (!cfg) { console.error(`Unknown app: ${name}`); process.exit(1); }
  if (!existsSync(cfg.dist)) {
    console.error(`[android:${name}] dist missing — run 'npm run build' in apps/${name} first.`);
    process.exit(1);
  }

  // Scaffold the Capacitor project on first run
  if (!existsSync(cfg.project)) {
    console.log(`[android:${name}] scaffolding Capacitor project…`);
    mkdirSync(cfg.project, { recursive: true });
    writeFileSync(path.join(cfg.project, "package.json"), JSON.stringify({
      name: `reporta-android-${name}`,
      version: "1.0.0",
      private: true,
      scripts: { capacitor: "capacitor" },
      devDependencies: { "@capacitor/cli": "^6.1.2" },
      dependencies: { "@capacitor/core": "^6.1.2", "@capacitor/android": "^6.1.2" },
    }, null, 2));
    writeFileSync(path.join(cfg.project, "capacitor.config.json"), JSON.stringify({
      appId: cfg.appId,
      appName: cfg.appName,
      webDir: "www",
      server: { androidScheme: "https" },
      android: { allowMixedContent: false },
    }, null, 2));
    execSync("npm install --no-audit --no-fund", { cwd: cfg.project, stdio: "inherit" });
  }

  // Sync the web build into www/
  const www = path.join(cfg.project, "www");
  rmSync(www, { recursive: true, force: true });
  mkdirSync(www, { recursive: true });
  cpSync(cfg.dist, www, { recursive: true });

  execSync("npx cap add android 2>npx cap sync android", { cwd: cfg.project, stdio: "inherit", shell: "cmd.exe" });

  // Gradle build
  const gradle = release ? "assembleRelease" : "assembleDebug";
  console.log(`[android:${name}] running gradle ${gradle}…`);
  const gradlew = path.join(cfg.project, "android", "gradlew.bat");
  if (!existsSync(gradlew)) {
    console.error(`[android:${name}] gradlew not scaffolded — Capacitor add failed?`);
    process.exit(1);
  }
  const res = spawnSync(gradlew, [gradle], { cwd: path.join(cfg.project, "android"), stdio: "inherit", shell: true });
  if (res.status !== 0) { console.error(`[android:${name}] gradle build failed`); process.exit(1); }

  const outDir = path.join(repo, "release", "android", name);
  mkdirSync(outDir, { recursive: true });
  const buildDir = path.join(cfg.project, "android", "app", "build", "outputs", "apk", release ? "release" : "debug");
  for (const f of existsSync(buildDir) ? await import("node:fs").promises.readdir(buildDir) : []) {
    if (f.endsWith(".apk")) {
      const dst = path.join(outDir, `REPORTA-${name}-${release ? "release" : "debug"}.apk`);
      cpSync(path.join(buildDir, f), dst);
      console.log(`[android:${name}] APK: ${dst}`);
    }
  }
}

checkAndroidSdk();
const targets = appArg === "both" ? ["user", "admin"] : [appArg];
for (const t of targets) await buildApp(t);
