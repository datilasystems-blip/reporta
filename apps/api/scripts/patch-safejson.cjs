// Re-add safeJson helper and fix remaining type issues
const fs = require("node:fs");
const path = "src/index.ts";
let src = fs.readFileSync(path, "utf8");

// 1. Re-add safeJson
if (!src.includes("function safeJson")) {
  const marker = "async function audit(";
  if (src.includes(marker)) {
    src = src.replace(marker, "function safeJson(s: string): unknown {\n  try { return JSON.parse(s); } catch { return s; }\n}\n\n" + marker);
  }
}

fs.writeFileSync(path, src);
console.log("patched safeJson:", src.includes("function safeJson"));
