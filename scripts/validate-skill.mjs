#!/usr/bin/env node
// Validates commons/skills/**/SKILL.md frontmatter against
// commons/schemas/skill.schema.json. Dependency-free so P2 CI can reuse it.
//
// Usage: node scripts/validate-skill.mjs <path...>
// Each path is a SKILL.md file or a directory scanned recursively for SKILL.md.
// Exit code 1 if any file fails.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_PATH = path.join(REPO_ROOT, "commons", "schemas", "skill.schema.json");

export function loadSchema(schemaPath = SCHEMA_PATH) {
  return JSON.parse(fs.readFileSync(schemaPath, "utf8"));
}

// Minimal frontmatter parser for the Agent Skills contract: flat top-level
// `key: value` scalars plus one `metadata:` block of indented string scalars.
// Lists and nested maps are rejected: metadata is string-to-string.
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!match) return { data: null, body: content, error: "missing frontmatter block (--- ... ---)" };
  const data = {};
  const lines = match[1].split(/\r?\n/);
  let inMetadata = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const indented = /^[ \t]/.test(line);
    const kv = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!kv) return { data: null, body: null, error: `frontmatter line ${i + 2} is not a key: value pair` };
    const [, key, rawValue] = kv;
    if (!indented) {
      inMetadata = key === "metadata";
      if (inMetadata) {
        if (rawValue !== "") return { data: null, body: null, error: "metadata must be a block of indented string values" };
        data.metadata = {};
      } else {
        data[key] = unquote(rawValue);
      }
    } else {
      if (!inMetadata) return { data: null, body: null, error: `frontmatter line ${i + 2}: only metadata may be indented` };
      if (rawValue === "") return { data: null, body: null, error: `metadata.${key} must be a string, not a list or map` };
      data.metadata[key] = unquote(rawValue);
    }
  }
  return { data, body: content.slice(match[0].length), error: null };
}

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
    return trimmed.slice(1, -1);
  }
  // An opening quote without its closing quote makes the whole file invalid YAML.
  if (/^["']/.test(trimmed)) return null;
  // YAML reads these unquoted scalars as booleans, null or numbers, not strings.
  if (/^(true|false|yes|no|on|off|null|~|[-+]?(\d[\d_]*)?\.?\d+([eE][-+]?\d+)?|0x[0-9a-fA-F]+|\.inf|\.nan)$/i.test(trimmed) || trimmed === "") {
    return trimmed === "" ? "" : null;
  }
  return trimmed;
}

function checkValue(label, value, rules, errors) {
  if (rules.const !== undefined && value !== rules.const) {
    errors.push(`${label} must be ${JSON.stringify(rules.const)}`);
    return;
  }
  if (typeof value !== "string") {
    errors.push(`${label} must be a string`);
    return;
  }
  if (rules.minLength !== undefined && value.length < rules.minLength) {
    errors.push(`${label} must not be empty`);
  }
  if (rules.pattern !== undefined && !new RegExp(rules.pattern).test(value)) {
    errors.push(`${label} must match ${rules.pattern}`);
  }
  if (rules.enum !== undefined && !rules.enum.includes(value)) {
    errors.push(`${label} must be one of: ${rules.enum.join(", ")}`);
  }
}

export function validateSkillFile(filePath, schema = loadSchema()) {
  const errors = [];
  const content = fs.readFileSync(filePath, "utf8");
  const { data, body, error } = parseFrontmatter(content);
  if (error) return [error];

  for (const key of schema.required ?? []) {
    if (data[key] === undefined) errors.push(`missing required frontmatter field: ${key}`);
  }
  for (const [key, rules] of Object.entries(schema.properties ?? {})) {
    if (key === "metadata" || data[key] === undefined) continue;
    checkValue(key, data[key], rules, errors);
  }

  const dirName = path.basename(path.dirname(filePath));
  if (typeof data.name === "string" && data.name !== dirName) {
    errors.push(`name "${data.name}" must equal the directory name "${dirName}"`);
  }

  const metadata = data.metadata ?? {};
  const metaSchema = schema.properties?.metadata ?? {};
  for (const key of metaSchema.required ?? []) {
    if (metadata[key] === undefined) errors.push(`missing required metadata field: ${key}`);
  }
  for (const [key, value] of Object.entries(metadata)) {
    const rules = metaSchema.properties?.[key] ?? metaSchema.additionalProperties ?? { type: "string" };
    checkValue(`metadata.${key}`, value, rules, errors);
  }

  // The last heading-delimited section must carry the log_task step.
  const sections = typeof body === "string" ? body.split(/^#{1,6} /m) : [];
  // Skip the heading line itself: "## Do not call log_task" is not an instruction.
  const lastSection = sections.length > 1 ? (sections.at(-1) ?? "").replace(/^.*\n?/, "") : (sections[0] ?? "");
  if (!lastSection.includes("log_task") || /\b(do not|don't|never|not)\s+(call|use|invoke)\s+`?log_task/i.test(lastSection)) {
    errors.push("body must end with a log_task step for when the ax-commons MCP server is available");
  } else if (
    !/works?\b[^.]*\bwithout (the |an? )?(ax-commons )?(MCP |local )?(server|MCP)|\bwithout (the |an? )?(ax-commons )?(MCP|server),|서버 없이도/i.test(lastSection) ||
    /\b(not|n't|cannot|never)\s+(work|function|run)\w*\s+without\b|없이는\s*(작동|동작|사용)/i.test(lastSection)
  ) {
    errors.push("the final log_task section must state that the skill works without the MCP server");
  }
  return errors;
}

function collectSkillFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  const found = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) found.push(...collectSkillFiles(child));
    else if (entry.name === "SKILL.md") found.push(child);
  }
  return found;
}

export function main(argv) {
  const targets = argv.length > 0 ? argv : [path.join(REPO_ROOT, "commons", "skills")];
  const schema = loadSchema();
  let failed = 0;
  let checked = 0;
  for (const target of targets) {
    for (const file of collectSkillFiles(path.resolve(target))) {
      checked += 1;
      const errors = validateSkillFile(file, schema);
      if (errors.length > 0) {
        failed += 1;
        console.error(`FAIL ${path.relative(REPO_ROOT, file)}`);
        for (const message of errors) console.error(`  - ${message}`);
      } else {
        console.log(`OK   ${path.relative(REPO_ROOT, file)}`);
      }
    }
  }
  if (checked === 0) {
    console.error("No SKILL.md files found.");
    return 1;
  }
  console.log(`${checked - failed}/${checked} skill file(s) valid`);
  return failed === 0 ? 0 : 1;
}

if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  process.exitCode = main(process.argv.slice(2));
}
