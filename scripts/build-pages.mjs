import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
const root = process.cwd();
const vite = spawnSync(process.execPath, [path.join(root,"node_modules/vite/bin/vite.js"), "build", "--config", "cloudflare-pages/vite.config.ts"], { stdio: "inherit" });
if (vite.status !== 0) process.exit(vite.status || 1);
await build({ entryPoints: [path.join(root,"cloudflare-pages/worker.ts")], outfile: path.join(root,"cloudflare-pages/dist/_worker.js"), bundle: true, platform: "browser", format: "esm", target: "es2022", external: ["cloudflare:workers"], conditions: ["worker","browser"], minify: true });
await writeFile(path.join(root,"cloudflare-pages/dist/_routes.json"), JSON.stringify({ version: 1, include: ["/api/*","/admin/dashboard*","/admin/submissions/*"], exclude: [] }));
