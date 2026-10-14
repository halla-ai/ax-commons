import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { deleteLedger, Ledger, CORRECTION_TYPES, ERROR_TYPES, INTENT_REASONS, MAX_MINUTES, TASK_TYPES } from "../src/ledger.ts";
import { createServer } from "../src/server.ts";
import { createToolHandlers, toolInputSchemas } from "../src/tools.ts";
import { readAllRows, tempLedgerPath } from "./helpers.ts";

function withHandlers(fn: (handlers: ReturnType<typeof createToolHandlers>, ledgerPath: string) => void): void {
  const { ledgerPath, cleanup } = tempLedgerPath();
  const ledger = new Ledger(ledgerPath);
  try {
    fn(createToolHandlers(ledger), ledgerPath);
  } finally {
    ledger.close();
    cleanup();
  }
}

test("declare_intent records valid input", () => {
  withHandlers((handlers, ledgerPath) => {
    for (const reason of INTENT_REASONS) {
      const out = handlers.declare_intent({ work_type: "writing", reason });
      assert.equal(out.recorded, true);
    }
    const rows = readAllRows(ledgerPath);
    assert.equal(rows.intents.length, INTENT_REASONS.length);
    assert.equal(rows.intents[0]?.work_type, "writing");
  });
});

test("a ledger deleted while the server runs is recreated on the next write", () => {
  withHandlers((handlers, ledgerPath) => {
    handlers.log_task({ task_type: "coding", human_reviewed: true, reused: true });
    assert.equal(deleteLedger(ledgerPath), true);
    const out = handlers.log_task({ task_type: "data", human_reviewed: false, reused: false });
    assert.equal(out.recorded, true);
    const rows = readAllRows(ledgerPath);
    assert.equal(rows.task_logs.length, 1);
    assert.equal(rows.task_logs[0]?.task_type, "data");
  });
});

test("log_task records valid input for every task type", () => {
  withHandlers((handlers, ledgerPath) => {
    for (const taskType of TASK_TYPES) {
      handlers.log_task({ task_type: taskType, human_reviewed: true, reused: true, minutes: 10 });
    }
    const rows = readAllRows(ledgerPath);
    assert.equal(rows.task_logs.length, TASK_TYPES.length);
  });
});

test("report_issue records valid input for every enum combination", () => {
  withHandlers((handlers, ledgerPath) => {
    for (const errorType of ERROR_TYPES) {
      handlers.report_issue({ error_type: errorType, correction_type: CORRECTION_TYPES[0] as string });
    }
    const rows = readAllRows(ledgerPath);
    assert.equal(rows.issue_reports.length, ERROR_TYPES.length);
  });
});

test("consent_status returns items and empty transmission history", () => {
  withHandlers((handlers, ledgerPath) => {
    const out = handlers.consent_status({}) as { items: unknown[]; transmissionHistory: unknown[] };
    // The result reaches the hosted model; the local path embeds the OS account name.
    assert.ok(!JSON.stringify(out).includes(ledgerPath), "consent_status must not return the ledger path");
    assert.ok(Array.isArray(out.items) && out.items.length >= 2);
    assert.deepEqual(out.transmissionHistory, []);
  });
});

test("enum fields reject unknown values", () => {
  withHandlers((handlers) => {
    assert.throws(() => handlers.log_task({ task_type: "chatting", human_reviewed: true, reused: false }));
    assert.throws(() => handlers.report_issue({ error_type: "hallucination", correction_type: "manual-fix" }));
    assert.throws(() => handlers.report_issue({ error_type: "wrong-facts", correction_type: "ignored" }));
    assert.throws(() => handlers.declare_intent({ work_type: "weekly newsletter", reason: "save-time" }), /Invalid declare_intent/);
    assert.throws(() => handlers.declare_intent({ work_type: "writing", reason: "save drafting time" }), /Invalid declare_intent/);
    assert.throws(() => handlers.declare_intent({ work_type: 42, reason: "save-time" }));
  });
});

test("log_task validates booleans and the minutes range", () => {
  withHandlers((handlers) => {
    assert.throws(() => handlers.log_task({ task_type: "coding", human_reviewed: "yes", reused: true }));
    assert.throws(() => handlers.log_task({ task_type: "coding", human_reviewed: true, reused: true, minutes: -1 }));
    assert.throws(() => handlers.log_task({ task_type: "coding", human_reviewed: true, reused: true, minutes: MAX_MINUTES + 1 }));
    assert.throws(() => handlers.log_task({ task_type: "coding", human_reviewed: true, reused: true, minutes: 1.5 }));
  });
});

// .strict() guards direct handler calls (tests, future non-SDK callers). Over
// the MCP protocol the SDK strips unknown keys before the handler runs, so an
// extra field can never reach the ledger either way; privacy.test.ts covers
// the protocol path.
test("unexpected extra fields are rejected on direct handler calls (strict objects)", () => {
  withHandlers((handlers) => {
    assert.throws(() =>
      handlers.log_task({ task_type: "coding", human_reviewed: true, reused: true, transcript: "free text" }),
    );
    assert.throws(() => handlers.consent_status({ notes: "free text" }));
  });
});

test("missing required fields are rejected", () => {
  withHandlers((handlers) => {
    assert.throws(() => handlers.declare_intent({ work_type: "writing" }));
    assert.throws(() => handlers.log_task({ task_type: "coding" }));
    assert.throws(() => handlers.report_issue({}));
  });
});

test("tool surface is exactly the four P1 tools with allowlisted fields", () => {
  assert.deepEqual(Object.keys(toolInputSchemas).sort(), ["consent_status", "declare_intent", "log_task", "report_issue"]);
  assert.deepEqual(Object.keys(toolInputSchemas.declare_intent.shape).sort(), ["reason", "work_type"]);
  assert.deepEqual(Object.keys(toolInputSchemas.log_task.shape).sort(), ["human_reviewed", "minutes", "reused", "skill_id", "task_type"]);
  assert.deepEqual(Object.keys(toolInputSchemas.report_issue.shape).sort(), ["correction_type", "error_type"]);
  assert.deepEqual(Object.keys(toolInputSchemas.consent_status.shape), []);
});

test("MCP protocol: tools/list advertises only the allowlisted fields, and a call works end to end", async () => {
  const { ledgerPath, cleanup } = tempLedgerPath();
  const ledger = new Ledger(ledgerPath);
  const server = createServer(ledger);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ["consent_status", "declare_intent", "log_task", "report_issue", "revoke", "submit_contribution", "sync_metrics"]);
    const declared: Record<string, string[]> = {
      declare_intent: ["reason", "work_type"],
      log_task: ["human_reviewed", "minutes", "reused", "skill_id", "task_type"],
      report_issue: ["correction_type", "error_type"],
      consent_status: [],
      revoke: ["id", "kind", "period"],
      submit_contribution: ["action", "approved", "candidate", "expiresAt", "hash", "id", "previewId", "scope"],
      sync_metrics: ["approved", "period"],
    };
    for (const tool of tools) {
      assert.deepEqual(Object.keys(tool.inputSchema.properties ?? {}).sort(), declared[tool.name as keyof typeof declared]);
    }

    const result = await client.callTool({
      name: "log_task",
      arguments: { task_type: "translation", human_reviewed: true, reused: true, minutes: 12, skill_id: "general/bilingual-translation" },
    });
    assert.equal(result.isError, undefined);
    const text = (result.content as { type: string; text: string }[])[0]?.text ?? "";
    const parsed = JSON.parse(text) as Record<string, unknown>;
    assert.equal(parsed.recorded, true);
    assert.deepEqual(Object.keys(parsed).sort(), ["recorded", "stored"]);
    const blocked = await client.callTool({name:"sync_metrics", arguments:{period:"2026-10", approved:false}});
    assert.equal(blocked.isError, true);
    const status = await client.callTool({name:"consent_status", arguments:{}});
    assert.ok(JSON.stringify(status).includes("remote"));
  } finally {
    await client.close();
    await server.close();
    ledger.close();
    const rows = readAllRows(ledgerPath);
    assert.equal(rows.task_logs.length, 1);
    assert.equal(rows.task_logs[0]?.skill_id, "general/bilingual-translation");
    cleanup();
  }
});
