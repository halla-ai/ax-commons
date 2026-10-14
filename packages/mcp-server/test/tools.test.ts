import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Ledger, CORRECTION_TYPES, ERROR_TYPES, MAX_MINUTES, MAX_SHORT_TEXT, TASK_TYPES } from "../src/ledger.ts";
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
    const out = handlers.declare_intent({ work_summary: "weekly newsletter", reason: "save drafting time" });
    assert.equal(out.recorded, true);
    const rows = readAllRows(ledgerPath);
    assert.equal(rows.intents[0]?.work_summary, "weekly newsletter");
  });
});

// AC2 boundary, stated explicitly: declare_intent labels are user-written and
// stored as given up to the cap. The no-conversation-text guarantee covers the
// enum/boolean/integer fields and the no-echo of rejected values, not this label.
test("declare_intent stores a label up to the cap verbatim", () => {
  withHandlers((handlers, ledgerPath) => {
    const label = "y".repeat(MAX_SHORT_TEXT);
    handlers.declare_intent({ work_summary: label, reason: label });
    const rows = readAllRows(ledgerPath);
    assert.equal(rows.intents[0]?.work_summary, label);
    assert.equal(rows.intents[0]?.reason, label);
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
  withHandlers((handlers) => {
    const out = handlers.consent_status({}) as { items: unknown[]; transmissionHistory: unknown[] };
    assert.ok(Array.isArray(out.items) && out.items.length >= 2);
    assert.deepEqual(out.transmissionHistory, []);
  });
});

test("string fields reject values over the length cap", () => {
  withHandlers((handlers) => {
    const tooLong = "x".repeat(MAX_SHORT_TEXT + 1);
    assert.throws(() => handlers.declare_intent({ work_summary: tooLong, reason: "ok" }), /Invalid declare_intent/);
    assert.throws(() => handlers.declare_intent({ work_summary: "ok", reason: tooLong }), /Invalid declare_intent/);
  });
});

test("string fields reject empty values and non-strings", () => {
  withHandlers((handlers) => {
    assert.throws(() => handlers.declare_intent({ work_summary: "", reason: "ok" }));
    assert.throws(() => handlers.declare_intent({ work_summary: 42, reason: "ok" }));
  });
});

test("enum fields reject unknown values", () => {
  withHandlers((handlers) => {
    assert.throws(() => handlers.log_task({ task_type: "chatting", human_reviewed: true, reused: false }));
    assert.throws(() => handlers.report_issue({ error_type: "hallucination", correction_type: "manual-fix" }));
    assert.throws(() => handlers.report_issue({ error_type: "wrong-facts", correction_type: "ignored" }));
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

test("unexpected extra fields are rejected (strict objects)", () => {
  withHandlers((handlers) => {
    assert.throws(() =>
      handlers.log_task({ task_type: "coding", human_reviewed: true, reused: true, transcript: "free text" }),
    );
    assert.throws(() => handlers.consent_status({ notes: "free text" }));
  });
});

test("missing required fields are rejected", () => {
  withHandlers((handlers) => {
    assert.throws(() => handlers.declare_intent({ work_summary: "only one field" }));
    assert.throws(() => handlers.log_task({ task_type: "coding" }));
    assert.throws(() => handlers.report_issue({}));
  });
});

test("tool surface is exactly the four P1 tools with allowlisted fields", () => {
  assert.deepEqual(Object.keys(toolInputSchemas).sort(), ["consent_status", "declare_intent", "log_task", "report_issue"]);
  assert.deepEqual(Object.keys(toolInputSchemas.declare_intent.shape).sort(), ["reason", "work_summary"]);
  assert.deepEqual(Object.keys(toolInputSchemas.log_task.shape).sort(), ["human_reviewed", "minutes", "reused", "task_type"]);
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
    assert.deepEqual(tools.map((t) => t.name).sort(), ["consent_status", "declare_intent", "log_task", "report_issue"]);
    const declared: Record<string, string[]> = {
      declare_intent: ["reason", "work_summary"],
      log_task: ["human_reviewed", "minutes", "reused", "task_type"],
      report_issue: ["correction_type", "error_type"],
      consent_status: [],
    };
    for (const tool of tools) {
      assert.deepEqual(Object.keys(tool.inputSchema.properties ?? {}).sort(), declared[tool.name as keyof typeof declared]);
    }

    const result = await client.callTool({
      name: "log_task",
      arguments: { task_type: "translation", human_reviewed: true, reused: true, minutes: 12 },
    });
    assert.equal(result.isError, undefined);
    const text = (result.content as { type: string; text: string }[])[0]?.text ?? "";
    const parsed = JSON.parse(text) as { recorded: boolean; taskLogId: number };
    assert.equal(parsed.recorded, true);
    assert.ok(parsed.taskLogId >= 1);
  } finally {
    await client.close();
    await server.close();
    ledger.close();
    const rows = readAllRows(ledgerPath);
    assert.equal(rows.task_logs.length, 1);
    cleanup();
  }
});
