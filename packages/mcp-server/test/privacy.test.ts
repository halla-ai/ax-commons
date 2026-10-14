import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Ledger, MAX_SHORT_TEXT } from "../src/ledger.ts";
import { createServer } from "../src/server.ts";
import { ledgerContains, readAllRows, tempLedgerPath } from "./helpers.ts";

// A marker that stands in for conversation text: long, sentence-like, unique.
const SENTINEL_MARKER = "SENTINEL-CONVERSATION-7f3a9b2e";
const SENTINEL =
  `${SENTINEL_MARKER}: user said "please rewrite my resignation letter because my manager ` +
  `yelled at me yesterday" and the assistant replied "I am sorry to hear that, here is a draft". ` +
  "x".repeat(MAX_SHORT_TEXT);

async function withClient(
  ledgerPath: string,
  fn: (client: Client) => Promise<string[]>,
): Promise<string[]> {
  const ledger = new Ledger(ledgerPath);
  const server = createServer(ledger);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "sentinel-client", version: "0.0.1" });
  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    return await fn(client);
  } finally {
    await client.close();
    await server.close();
    ledger.close();
  }
}

function resultText(result: unknown): string {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  return content.map((c) => c.text ?? "").join("\n");
}

test("AC2: the sentinel conversation string never reaches the ledger or any tool output", async () => {
  const { ledgerPath, dir, cleanup } = tempLedgerPath();
  try {
    const outputs = await withClient(ledgerPath, async (client) => {
      const seen: string[] = [];
      const attempts = [
        { name: "declare_intent", arguments: { work_summary: SENTINEL, reason: SENTINEL } },
        { name: "log_task", arguments: { task_type: SENTINEL, human_reviewed: true, reused: true, minutes: 5 } },
        { name: "report_issue", arguments: { error_type: SENTINEL, correction_type: SENTINEL } },
        // Unknown extra fields must never be stored either.
        { name: "log_task", arguments: { task_type: "writing", human_reviewed: true, reused: false, transcript: SENTINEL } },
        { name: "consent_status", arguments: { notes: SENTINEL } },
      ];
      for (const attempt of attempts) {
        const result = await client.callTool(attempt);
        seen.push(resultText(result));
      }
      return seen;
    });

    for (const output of outputs) {
      assert.ok(!output.includes(SENTINEL_MARKER), "tool output must not echo the sentinel");
    }
    assert.ok(!ledgerContains(ledgerPath, SENTINEL_MARKER), "ledger must not contain the sentinel");

    // The export file is also part of the surface that must stay clean.
    const ledger = new Ledger(ledgerPath);
    const exportPath = path.join(dir, "export.json");
    ledger.exportTo(exportPath);
    ledger.close();
    assert.ok(!fs.readFileSync(exportPath, "utf8").includes(SENTINEL_MARKER), "export must not contain the sentinel");
  } finally {
    cleanup();
  }
});

test("AC2: a ledger filled through the whole tool surface contains only structured allowlisted values", async () => {
  const { ledgerPath, cleanup } = tempLedgerPath();
  try {
    await withClient(ledgerPath, async (client) => {
      await client.callTool({ name: "declare_intent", arguments: { work_summary: "grant report", reason: "deadline friday" } });
      await client.callTool({ name: "log_task", arguments: { task_type: "writing", human_reviewed: true, reused: true, minutes: 30 } });
      await client.callTool({ name: "report_issue", arguments: { error_type: "format", correction_type: "retry" } });
      await client.callTool({ name: "consent_status", arguments: {} });
      return [];
    });

    const rows = readAllRows(ledgerPath);
    for (const row of rows.intents) {
      assert.deepEqual(Object.keys(row).sort(), ["created_at", "id", "reason", "work_summary"]);
    }
    for (const row of rows.task_logs) {
      assert.deepEqual(Object.keys(row).sort(), ["created_at", "human_reviewed", "id", "minutes", "reused", "task_type"]);
    }
    for (const row of rows.issue_reports) {
      assert.deepEqual(Object.keys(row).sort(), ["correction_type", "created_at", "error_type", "id"]);
    }
    // Timestamps and ids aside, every stored value must be an enum member,
    // a boolean flag, a bounded number, or a capped short string.
    for (const row of [...rows.intents, ...rows.task_logs, ...rows.issue_reports]) {
      for (const [key, value] of Object.entries(row)) {
        if (key === "id" || key === "created_at") continue;
        if (typeof value === "string") {
          assert.ok(value.length <= MAX_SHORT_TEXT, `stored string in ${key} exceeds the cap`);
        } else {
          assert.ok(typeof value === "number" || value === null, `unexpected stored type in ${key}`);
        }
      }
    }
  } finally {
    cleanup();
  }
});

test("AC2: no tool input schema exposes a free-text content field", async () => {
  const { ledgerPath, cleanup } = tempLedgerPath();
  try {
    await withClient(ledgerPath, async (client) => {
      const { tools } = await client.listTools();
      const bannedFieldNames = /text|content|transcript|conversation|message|prompt|notes?|detail|body|free/i;
      for (const tool of tools) {
        const properties = (tool.inputSchema.properties ?? {}) as Record<string, { type?: string; enum?: unknown[]; maxLength?: number }>;
        for (const [field, schema] of Object.entries(properties)) {
          assert.ok(!bannedFieldNames.test(field), `${tool.name}.${field} looks like a free-text field`);
          if (schema.type === "string" && !schema.enum) {
            assert.ok(
              typeof schema.maxLength === "number" && schema.maxLength <= MAX_SHORT_TEXT,
              `${tool.name}.${field} is an unbounded string`,
            );
          }
        }
      }
      return [];
    });
  } finally {
    cleanup();
  }
});
