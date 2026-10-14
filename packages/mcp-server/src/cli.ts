import path from "node:path";
import { deleteLedger, exportLedger } from "./ledger.ts";
import { defaultLedgerPath } from "./paths.ts";
import { startServer } from "./serve.ts";

const HELP = `ax-commons ledger CLI

Usage:
  ax-commons serve                 Start the MCP server on stdio (default action of the desktop extension)
  ax-commons export [--out FILE]   Export the ledger to a readable JSON file
  ax-commons delete                Delete the ledger file from this device
  ax-commons path                  Print the ledger file path
  ax-commons help                  Show this help

The ledger lives at ${defaultLedgerPath()}
Override with the ${"AX_COMMONS_LEDGER"} environment variable.
Nothing is transmitted by any command.
`;

function parseOutFlag(args: string[]): string {
  const index = args.indexOf("--out");
  if (index === -1 || args[index + 1] === undefined) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return path.resolve(`ax-commons-ledger-export-${stamp}.json`);
  }
  return args[index + 1] as string;
}

export function runCli(argv: string[]): number {
  const [command, ...rest] = argv;
  const ledgerPath = defaultLedgerPath();
  switch (command) {
    case undefined:
    case "help":
    case "--help":
    case "-h":
      process.stdout.write(HELP);
      return 0;
    case "path":
      console.log(ledgerPath);
      return 0;
    case "export": {
      const out = parseOutFlag(rest);
      const result = exportLedger(ledgerPath, out);
      console.log(`Exported ledger to ${result.outPath}`);
      for (const [table, count] of Object.entries(result.counts)) {
        console.log(`  ${table}: ${count} row(s)`);
      }
      return 0;
    }
    case "delete": {
      const removed = deleteLedger(ledgerPath);
      console.log(removed ? `Deleted ledger at ${ledgerPath}` : `No ledger found at ${ledgerPath}`);
      return 0;
    }
    case "serve":
      startServer().catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      });
      return 0;
    default:
      console.error(`Unknown command: ${command}\n`);
      process.stderr.write(HELP);
      return 1;
  }
}

const isMain = process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  try {
    process.exitCode = runCli(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
