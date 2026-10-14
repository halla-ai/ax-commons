import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Ledger } from "./ledger.ts";
import { defaultLedgerPath } from "./paths.ts";
import { createServer } from "./server.ts";

export async function startServer(ledgerPath?: string): Promise<void> {
  const ledger = new Ledger(ledgerPath ?? defaultLedgerPath());
  const server = createServer(ledger);
  await server.connect(new StdioServerTransport());
  console.error(`ax-commons MCP server running on stdio; ledger at ${ledger.path}`);
}
