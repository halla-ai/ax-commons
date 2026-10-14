import { build } from "esbuild";

// Bundle the server and the CLI into single self-contained files so the
// desktop extension (.mcpb) needs no bundled node_modules directory.
await build({
  entryPoints: {
    server: "src/index.ts",
    cli: "src/cli.ts",
  },
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: false,
  logLevel: "info",
});
