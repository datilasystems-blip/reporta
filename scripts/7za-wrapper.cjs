// Wrapper around 7za.exe that removes the `-snld` flag so symlinks inside
// winCodeSign.7z are extracted as real files (no symlink privilege needed).
// electron-builder invokes: <7za-bin>/7za.exe x -snld -bd <archive> -o<dir>
import { spawnSync } from "node:child_process";
import path from "node:path";

const real7za = "C:\\Users\\HP\\AppData\\Local\\electron-builder\\Cache\\7za-real.exe";
const args = process.argv.slice(2).filter((a) => a !== "-snld");
const res = spawnSync(real7za, args, { stdio: "inherit" });
process.exit(res.status ?? 1);
