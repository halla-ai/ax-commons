import os from "node:os";
import path from "node:path";

export const LEDGER_ENV_VAR = "AX_COMMONS_LEDGER";

export function defaultLedgerPath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): string {
  const override = env[LEDGER_ENV_VAR];
  if (override && override.trim().length > 0) {
    return path.resolve(override);
  }
  switch (platform) {
    case "darwin":
      return path.join(home, "Library", "Application Support", "ax-commons", "ledger.db");
    case "win32": {
      const base = env.APPDATA ?? path.join(home, "AppData", "Roaming");
      return path.join(base, "ax-commons", "ledger.db");
    }
    default: {
      const base = env.XDG_DATA_HOME ?? path.join(home, ".local", "share");
      return path.join(base, "ax-commons", "ledger.db");
    }
  }
}
