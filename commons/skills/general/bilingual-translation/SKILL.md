---
name: bilingual-translation
description: Translate text between Korean and English with a project glossary step that fixes key terms before translating. Use when consistent terminology matters, such as program documents, notices, product pages, or customer replies.
license: CC-BY-4.0
metadata:
  purpose: "Give users a translation workflow where key terms stay consistent across documents through an explicit glossary step, for Korean-English program and business documents."
  reference_sources: "ax-commons design spec (docs/specs/2026-10-14-ax-commons-design.md); standard translation workflow practice (terminology extraction before translation)"
  reviewer: "Young Joon Lee (interim; operator domain review pending)"
  version: "1.0.1"
  sunset: "scope-limited"
  issue_report_path: "https://github.com/halla-ai/ax-commons/issues/new"
  languages: "ko,en"
---

# Bilingual translation with glossary / 용어집 기반 번역

## 한국어

### 목적

한영 또는 영한 번역에서 핵심 용어가 문서마다 다르게 번역되는 문제를 막는다. 번역 전에 용어집을 먼저 확정하는 것이 핵심이다.

### 절차

1. **용어 추출**: 원문에서 반복되거나 중요한 용어(고유명사, 기관명, 사업명, 전문 용어)를 10개 이내로 뽑는다.
2. **용어집 확정**: 각 용어의 번역안을 표로 제시한다. 기존 용어집이나 이전 번역이 있으면 그것을 우선 따른다.
   - 사용자에게 확인을 요청한다. 특히 기관명과 사업명은 공식 표기가 있을 수 있다.
   - 사용자가 응답하지 않으면 제시한 번역안을 그대로 사용하고, 그 사실을 결과 앞에 한 줄로 표시한다.
3. **번역**: 확정된 용어집을 적용해 전체를 번역한다. 용어집에 없는 표현은 문맥에 맞게 번역한다.
4. **검토 목록**: 번역이 확실하지 않은 문장이나 원문이 모호한 부분은 "확인 필요" 목록으로 분리한다.

### 규칙

- 숫자, 날짜, 이름은 바꾸지 않는다.
- 원문에 없는 내용을 추가하지 않는다.
- 용어집의 표기를 본문 전체에서 일관되게 유지한다.

### 작업 기록

작업이 끝나면, ax-commons MCP 서버가 연결되어 있는 경우에만 `log_task`를 호출한다. `task_type`은 `translation`, 사람이 결과를 검토했는지(`human_reviewed`), 결과를 실제로 사용했는지(`reused`), 걸린 시간(`minutes`, 선택)을 기록한다. 서버가 없으면 이 단계는 건너뛴다. 이 스킬은 서버 없이도 일반 지시문으로 그대로 동작한다.

## English

### Purpose

Keep key terms consistent across Korean-English translations by fixing a glossary before translating, instead of letting each document drift.

### Procedure

1. **Extract terms**: pull up to 10 repeated or important terms (proper nouns, organization names, program names, technical terms) from the source.
2. **Fix the glossary**: present a translation candidate for each term in a table. If a project glossary or earlier translation exists, follow it first.
   - Ask the user to confirm. Organization and program names may have official spellings.
   - If the user does not respond, use the proposed candidates and note that in one line before the result.
3. **Translate**: translate the full text applying the confirmed glossary. Translate expressions not in the glossary according to context.
4. **Review list**: separate sentences where the translation is uncertain or the source is ambiguous into a "Needs verification" list.

### Rules

- Never change numbers, dates, or names.
- Do not add content that is not in the source.
- Keep glossary spellings consistent throughout.

### Task logging

When finished, and only if the ax-commons MCP server is available, call `log_task` with `task_type` set to `translation`, whether a human reviewed the output (`human_reviewed`), whether the output was reused (`reused`), and an optional time estimate (`minutes`). Skip this step when the server is not present. This skill works as plain instructions without the server.

- `log_task` 스키마에 `skill_id`가 있으면 `general/bilingual-translation`를 전달합니다. 필드가 없으면 생략합니다.
- When the advertised `log_task` schema includes `skill_id`, pass `general/bilingual-translation`; otherwise omit this field.
