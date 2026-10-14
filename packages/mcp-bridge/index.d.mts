import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
export interface BridgeOptions {
  endpoint?: string;
  metricsToken?: string;
  contributionToken?: string;
  programId?: string;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  crypto?: Crypto;
}
export declare function registerRemoteTools(server: McpServer, ledger: {path: string; consentStatus(): unknown}, options?: BridgeOptions): {consentStatus(): unknown};
