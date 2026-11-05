const check = async (name, url) => {
  try {
    const r = await fetch(url);
    const t = await r.text();
    console.log(`${name.padEnd(16)} ${r.status}  ${url}`);
  } catch (e) {
    console.log(`${name.padEnd(16)} DOWN  ${url}  (${e.message})`);
  }
};
await check("Public app", "http://localhost:5173");
await check("Admin portal", "http://localhost:5174");
await check("Officer portal", "http://localhost:5175");
await check("API", "http://localhost:4400/health");
