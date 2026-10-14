import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { main, validateSkillFile } from "../scripts/validate-skill.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VALIDATOR = path.join(REPO_ROOT, "scripts", "validate-skill.mjs");
const SKILLS = [
  "commons/skills/general/summary-with-evidence/SKILL.md",
  "commons/skills/general/bilingual-translation/SKILL.md",
];

function writeFixture(dirName, frontmatter, body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ax-skill-fixture-"));
  const skillDir = path.join(dir, dirName);
  fs.mkdirSync(skillDir, { recursive: true });
  const file = path.join(skillDir, "SKILL.md");
  fs.writeFileSync(file, `${frontmatter}\n\n${body}`);
  return { dir, file, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const VALID_FRONTMATTER = `---
name: fixture-skill
description: "A fixture skill for validation tests."
license: CC-BY-4.0
metadata:
  purpose: "fixture purpose"
  reference_sources: "fixture source"
  reviewer: "pending: operator-appointed domain reviewer"
  version: "1.0.0"
  sunset: "full"
  issue_report_path: "https://github.com/halla-ai/ax-commons/issues/new"
  languages: "ko,en"
---`;

const VALID_BODY = "Do the task. If the ax-commons MCP server is available, call log_task at the end; the skill works without the server.";

test("AC4: both general skills pass schema validation", () => {
  for (const skill of SKILLS) {
    const errors = validateSkillFile(path.join(REPO_ROOT, skill));
    assert.deepEqual(errors, [], `${skill} should validate: ${errors.join("; ")}`);
  }
});

test("AC4: the validator CLI exits 0 on commons/skills", () => {
  const out = execFileSync(process.execPath, [VALIDATOR, path.join(REPO_ROOT, "commons", "skills")], { encoding: "utf8" });
  assert.match(out, /^(\d+)\/\1 skill file\(s\) valid$/m);
});

test("AC4: a valid fixture passes", () => {
  const { file, cleanup } = writeFixture("fixture-skill", VALID_FRONTMATTER, VALID_BODY);
  try {
    assert.deepEqual(validateSkillFile(file), []);
  } finally {
    cleanup();
  }
});

test("AC4: missing required metadata fields fail", () => {
  const broken = VALID_FRONTMATTER.replace('  reviewer: "pending: operator-appointed domain reviewer"\n', "");
  const { file, cleanup } = writeFixture("fixture-skill", broken, VALID_BODY);
  try {
    const errors = validateSkillFile(file);
    assert.ok(errors.some((e) => e.includes("reviewer")), `expected a reviewer error, got: ${errors.join("; ")}`);
  } finally {
    cleanup();
  }
});

test("AC4: an invalid sunset rule fails", () => {
  const broken = VALID_FRONTMATTER.replace('sunset: "full"', 'sunset: "whenever"');
  const { file, cleanup } = writeFixture("fixture-skill", broken, VALID_BODY);
  try {
    const errors = validateSkillFile(file);
    assert.ok(errors.some((e) => e.includes("sunset")), `expected a sunset error, got: ${errors.join("; ")}`);
  } finally {
    cleanup();
  }
});

test("AC4: a name that differs from the directory fails", () => {
  const { file, cleanup } = writeFixture("other-dir", VALID_FRONTMATTER, VALID_BODY);
  try {
    const errors = validateSkillFile(file);
    assert.ok(errors.some((e) => e.includes("directory name")), `expected a name error, got: ${errors.join("; ")}`);
  } finally {
    cleanup();
  }
});

test("AC4: a missing log_task step fails", () => {
  const { file, cleanup } = writeFixture("fixture-skill", VALID_FRONTMATTER, "Do the task and stop.");
  try {
    const errors = validateSkillFile(file);
    assert.ok(errors.some((e) => e.includes("log_task")), `expected a log_task error, got: ${errors.join("; ")}`);
  } finally {
    cleanup();
  }
});

test("AC4: log_task mentioned only before the last section fails", () => {
  const body = "## Intro\nThis skill ends with log_task.\n\n## Procedure\nDo the task and stop.";
  const { file, cleanup } = writeFixture("fixture-skill", VALID_FRONTMATTER, body);
  try {
    const errors = validateSkillFile(file);
    assert.ok(errors.some((e) => e.includes("log_task")), `expected a log_task error, got: ${errors.join("; ")}`);
  } finally {
    cleanup();
  }
});

test("AC4: a final log_task section without the no-server fallback fails", () => {
  const { file, cleanup } = writeFixture("fixture-skill", VALID_FRONTMATTER, "## Logging\nCall log_task.");
  try {
    const errors = validateSkillFile(file);
    assert.ok(errors.some((e) => e.includes("without the MCP server")), `expected a fallback error, got: ${errors.join("; ")}`);
  } finally {
    cleanup();
  }
});

test("AC4: an unsupported language in the list fails", () => {
  const broken = VALID_FRONTMATTER.replace('languages: "ko,en"', 'languages: "ko,en,fr"');
  const { file, cleanup } = writeFixture("fixture-skill", broken, VALID_BODY);
  try {
    const errors = validateSkillFile(file);
    assert.ok(errors.some((e) => e.includes("languages")), `expected a languages error, got: ${errors.join("; ")}`);
  } finally {
    cleanup();
  }
});

test("AC4: a non-semver version fails", () => {
  const broken = VALID_FRONTMATTER.replace('version: "1.0.0"', 'version: "v1"');
  const { file, cleanup } = writeFixture("fixture-skill", broken, VALID_BODY);
  try {
    const errors = validateSkillFile(file);
    assert.ok(errors.some((e) => e.includes("version")), `expected a version error, got: ${errors.join("; ")}`);
  } finally {
    cleanup();
  }
});

test("AC4: the validator reports failure for a directory containing a broken skill", () => {
  const { dir, cleanup } = writeFixture("fixture-skill", VALID_FRONTMATTER.replace('sunset: "full"', 'sunset: "bad"'), VALID_BODY);
  try {
    assert.equal(main([dir]), 1);
  } finally {
    cleanup();
  }
});
