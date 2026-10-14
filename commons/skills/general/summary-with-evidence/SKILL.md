---
name: summary-with-evidence
description: Summarize a document so that every claim is tagged with the exact quote or span it comes from. Use when a user needs a summary they can verify against the original, such as reports, contracts, notices, or meeting minutes.
license: CC-BY-4.0
metadata:
  purpose: "Help non-expert users get a document summary they can check claim by claim against the source, for reports, contracts, notices, and minutes."
  reference_sources: "ax-commons design spec (docs/specs/2026-10-14-ax-commons-design.md); evidence-marking practice from citation-required summarization workflows"
  reviewer: "pending: operator-appointed domain reviewer"
  version: "1.0.0"
  sunset: "scope-limited"
  issue_report_path: "https://github.com/halla-ai/ax-commons/issues/new"
  languages: "ko,en"
---

# Summary with evidence / 근거 표시 요약

## 한국어

### 목적

문서를 요약하되, 모든 주장에 원문의 어느 부분에서 나왔는지 근거를 표시한다. 사용자가 원문을 처음부터 끝까지 읽지 않고도 요약이 맞는지 항목별로 확인할 수 있게 하는 것이 목표다.

### 절차

1. 문서 전체를 읽고 섹션을 파악한다. 문서가 길면 섹션별로 나누어 진행한다.
2. 각 섹션에서 핵심 주장을 뽑아 한 문장으로 요약한다.
3. 각 요약 문장 끝에 근거 태그를 붙인다. 예: `[근거 1]`
4. 문서 맨 아래에 근거 목록을 만든다. 각 근거는 원문에서 그대로 발췌한 인용문이다.
   - `[근거 1] "2026년 예산은 전년 대비 12% 증가한 3억 원이다." (3. 예산안)`
5. 원문에서 근거를 찾을 수 없는 문장은 요약에 넣지 않는다. 추측이나 일반 상식을 보태지 않는다.
6. 요약 끝에 원문에는 없지만 사용자가 확인해야 할 사항이 있으면 "확인 필요" 항목으로 분리한다.

### 형식

- 요약은 5개 이내의 항목으로 제한한다.
- 각 항목은 한 문장, 근거 태그 필수.
- 근거 인용문은 원문을 바꾸지 않고 그대로 옮긴다.

### 작업 기록

작업이 끝나면, ax-commons MCP 서버가 연결되어 있는 경우에만 `log_task`를 호출한다. `task_type`은 `document-summary`, 사람이 결과를 검토했는지(`human_reviewed`), 결과를 실제로 사용했는지(`reused`), 걸린 시간(`minutes`, 선택)을 기록한다. 서버가 없으면 이 단계는 건너뛴다. 이 스킬은 서버 없이도 일반 지시문으로 그대로 동작한다.

## English

### Purpose

Summarize a document with every claim tagged to the exact quote or span it comes from, so the user can verify each item without reading the whole original.

### Procedure

1. Read the whole document and identify its sections. For long documents, work section by section.
2. Extract the key claims of each section and condense each into one sentence.
3. Tag every summary sentence with an evidence marker, for example `[E1]`.
4. At the end, list the evidence. Each entry is a verbatim quote from the source.
   - `[E1] "The 2026 budget is 300 million won, up 12 percent year over year." (Section 3, Budget)`
5. Never include a claim you cannot ground in a quote. Do not add guesses or general knowledge.
6. If the user should verify something the document does not answer, list it separately under "Needs verification".

### Format

- Limit the summary to at most 5 items.
- Each item is one sentence with a mandatory evidence tag.
- Evidence quotes are copied verbatim, never paraphrased.

### Task logging

When finished, and only if the ax-commons MCP server is available, call `log_task` with `task_type` set to `document-summary`, whether a human reviewed the output (`human_reviewed`), whether the output was reused (`reused`), and an optional time estimate (`minutes`). Skip this step when the server is not present. This skill works as plain instructions without the server.
