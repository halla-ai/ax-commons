import { z } from "zod";
import type { Ledger } from "./ledger.ts";
import { CORRECTION_TYPES, ERROR_TYPES, MAX_MINUTES, MAX_SHORT_TEXT, TASK_TYPES } from "./ledger.ts";

// Every tool input is a short structured value: a fixed enum member, a boolean,
// a bounded integer, or a capped string. There is intentionally no field that
// accepts free-form conversation text.
//
// Enum schemas carry an error map that never echoes the received value:
// the default zod message embeds it, which would put rejected free text into
// tool error output.
function fixedEnum<T extends readonly [string, ...string[]]>(values: T, label: string) {
  return z.enum(values, {
    errorMap: () => ({ message: `${label} must be one of: ${values.join(", ")}` }),
  });
}

export const toolInputSchemas = {
  declare_intent: z
    .object({
      work_summary: z
        .string()
        .min(1)
        .max(MAX_SHORT_TEXT)
        .describe(`Short label for the one piece of work to change with AI (max ${MAX_SHORT_TEXT} chars, not conversation text)`),
      reason: z
        .string()
        .min(1)
        .max(MAX_SHORT_TEXT)
        .describe(`Short label for why this work matters (max ${MAX_SHORT_TEXT} chars, not conversation text)`),
    })
    .strict(),
  log_task: z
    .object({
      task_type: fixedEnum(TASK_TYPES, "task_type").describe("Fixed task category tag"),
      human_reviewed: z.boolean().describe("A human checked the AI output before use"),
      reused: z.boolean().describe("The output was reused (in whole or adapted)"),
      minutes: z.number().int().min(0).max(MAX_MINUTES).optional().describe("Optional estimate of minutes spent"),
    })
    .strict(),
  report_issue: z
    .object({
      error_type: fixedEnum(ERROR_TYPES, "error_type").describe("Fixed error category tag"),
      correction_type: fixedEnum(CORRECTION_TYPES, "correction_type").describe("How the user corrected it"),
    })
    .strict(),
  consent_status: z.object({}).strict(),
} as const;

export type ToolName = keyof typeof toolInputSchemas;

export const toolDescriptions: Record<ToolName, string> = {
  declare_intent:
    "Record the one piece of work the user wants to change with AI, and why. " +
    "Both fields are short structured labels, never conversation text. Stored only on this device.",
  log_task:
    "Record a completed AI task: fixed task-type tag, whether a human reviewed the output, " +
    "whether the output was reused, and an optional time estimate. Called at the end of a skill. Stored only on this device.",
  report_issue:
    "Record a wrong or unhelpful AI result as a fixed error type plus the correction type. " +
    "Failure reports count as contributions. Stored only on this device.",
  consent_status:
    "Show consent items with their scope and period, and the transmission history of this ledger " +
    "(empty: this version transmits nothing).",
};

type ToolArgs<T extends ToolName> = z.infer<(typeof toolInputSchemas)[T]>;

export type ToolHandler = (args: Record<string, unknown>) => Record<string, unknown>;

function parse<T extends ToolName>(name: T, args: Record<string, unknown>): ToolArgs<T> {
  const result = toolInputSchemas[name].safeParse(args);
  if (!result.success) {
    // Messages are assembled from the issue code and path only, so a rejected
    // value is never echoed back into tool output.
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.code === "invalid_enum_value" ? i.message : i.code}`)
      .join("; ");
    throw new Error(`Invalid ${name} input: ${issues}`);
  }
  return result.data as ToolArgs<T>;
}

export function createToolHandlers(ledger: Ledger): Record<ToolName, ToolHandler> {
  return {
    declare_intent: (args) => {
      const input = parse("declare_intent", args);
      const intentId = ledger.declareIntent(input.work_summary, input.reason);
      return { recorded: true, intentId, stored: "on-device ledger only" };
    },
    log_task: (args) => {
      const input = parse("log_task", args);
      const taskLogId = ledger.logTask(input.task_type, input.human_reviewed, input.reused, input.minutes);
      return { recorded: true, taskLogId, stored: "on-device ledger only" };
    },
    report_issue: (args) => {
      const input = parse("report_issue", args);
      const issueReportId = ledger.reportIssue(input.error_type, input.correction_type);
      return { recorded: true, issueReportId, stored: "on-device ledger only" };
    },
    consent_status: (args) => {
      parse("consent_status", args);
      return ledger.consentStatus() as unknown as Record<string, unknown>;
    },
  };
}
