import { build } from 'esbuild';
import path from 'path';

const viteModulePath = path.resolve('server/_core/vite.ts');

await build({
  entryPoints: ['server/_core/index.ts'],
  bundle: true,
  platform: 'node',
  outfile: 'dist/server.mjs',
  external: [
    'better-sqlite3', 'pg', 'mysql2', 'tedious', 'oracledb', 'pg-query-stream',
  ],
  format: 'esm',
  loader: { '.node': 'empty' },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  banner: {
    js: 'import { createRequire as __createRequire } from "module"; import { fileURLToPath as __fileURLToPath } from "url"; import { dirname as __dirname_fn } from "path"; const require = __createRequire(import.meta.url); const __filename = __fileURLToPath(import.meta.url); const __dirname = __dirname_fn(__filename);',
  },
  plugins: [{
    name: 'stub-vite-dev',
    setup(build) {
      // Intercept the actual vite.ts file path
      build.onLoad({ filter: /server\/_core\/vite\.ts$/ }, () => {
        return {
          contents: `
            import express from "express";
            import fs from "fs";
            import path from "path";
            import { fileURLToPath } from "url";

            const __vite_filename = fileURLToPath(import.meta.url);
            const __vite_dirname = path.dirname(__vite_filename);

            export async function setupVite() {
              throw new Error("Vite dev server not available in production");
            }

            export function serveStatic(app) {
              const distPath = path.resolve(__vite_dirname, "public");
              if (!fs.existsSync(distPath)) {
                console.error("Could not find the build directory: " + distPath);
              }
              app.use(express.static(distPath));
              app.use("*", (_req, res) => {
                res.sendFile(path.resolve(distPath, "index.html"));
              });
            }
          `,
          loader: 'ts',
          resolveDir: path.dirname(viteModulePath),
        };
      });
    },
  }],
});
console.log('Server build OK');
