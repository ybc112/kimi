import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const indexPath = path.join(distDir, "index.html");
const html = await readFile(indexPath, "utf8");

// Render serves this repository as a static site. Creating real directory
// entrypoints makes direct visits and mobile-browser refreshes work even when
// the hosting dashboard has no catch-all rewrite configured.
const routes = [
  "chat",
  "vault",
  "meme-launch",
  "deploy",
  "flap-launch",
  "issued-tokens",
  "docs",
  "logs",
  "trending",
  "page-builder",
];

await Promise.all(
  routes.map(async (route) => {
    const routeDir = path.join(distDir, route);
    await mkdir(routeDir, { recursive: true });
    await writeFile(path.join(routeDir, "index.html"), html, "utf8");
  })
);

await writeFile(path.join(distDir, "404.html"), html, "utf8");
console.log(`Generated static SPA entrypoints for ${routes.length} routes.`);
