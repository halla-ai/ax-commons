import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Ledger } from "./ledger.ts";
import { createToolHandlers, toolDescriptions, toolInputSchemas, type ToolName } from "./tools.ts";

export const SERVER_NAME = "ax-commons";
export const SERVER_VERSION = "0.1.0";

export function createServer(ledger: Ledger): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  const handlers = createToolHandlers(ledger);
  for (const name of Object.keys(toolInputSchemas) as ToolName[]) {
    server.registerTool(
      name,
      { description: toolDescriptions[name], inputSchema: toolInputSchemas[name].shape },
      async (args: Record<string, unknown>) => ({
        content: [{ type: "text" as const, text: JSON.stringify(handlers[name](args), null, 2) }],
      }),
    );
  }
  return server;
}
