import { startServer } from "./serve.ts";

// This module is the MCP server entry point (the desktop extension runs it
// directly). Nothing imports it, so it always starts the server.
startServer().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
