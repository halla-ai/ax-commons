---
name: general-documents
description: Draft bilingual action notes and ordinary business documents from supplied facts, preserving proposals, decisions and unknowns. Use for document composition rather than evidence-summary or glossary-translation tasks.
license: CC-BY-4.0
metadata:
  languages: "ko,en"
  purpose: "Staff composing reviewed general documents and action notes from supplied facts."
  reference_sources: "docs/pilot/fictional-exercises.md; user-supplied document facts"
  reviewer: "claude (technical review); domain reviewer pending operator assignment"
  version: "1.0.0"
  sunset: "scope-limited"
  sunset_rule: "Retire organization-specific format guidance when its approved template changes."
  issue_report_path: "https://github.com/halla-ai/ax-commons/issues"
---

# General documents / 일반 문서

- Establish the requested document purpose and language pair from the supplied facts. For training use the fictional meeting card in `docs/pilot/fictional-exercises.md`. If the task is solely evidence summarization or glossary translation, use the corresponding P1 general skill when available.
- 제공 사실에서 문서 목적과 언어 쌍을 확인합니다. 교육에는 `docs/pilot/fictional-exercises.md`의 가상 회의 카드를 사용합니다. 근거 요약·용어집 번역만 필요한 작업은 제공되는 경우 해당 P1 범용 스킬을 사용합니다.
- Separate proposals, confirmed decisions, assigned actions and unknowns. Do not invent approval, owners, deadlines, signatures or completed actions. Keep an unspecified meeting date or approver pending.
- 제안·확정 결정·배정 조치·미확인을 구분합니다. 승인·담당자·마감·서명·완료 사실을 만들지 않습니다. 지정되지 않은 회의 날짜·승인자는 미정으로 둡니다.
- Produce a concise Korean draft and English counterpart appropriate to the requested document. Preserve the same decision status, dates, quantities and uncertainty; place confirmation questions outside the final-copy block.
- 요청 문서에 맞는 간결한 한국어 초안과 영어 대응문을 작성합니다. 결정 상태·날짜·수량·불확실성을 동일하게 유지하고 확인 질문은 최종 카피 밖에 둡니다.
- Ask for human review of the unresolved parts before treating the document as final. Do not submit, sign, email or register actions from the document unless separately authorized.
- 미해결 항목은 사람이 검토한 뒤 최종본으로 판단합니다. 별도 승인 없이 제출·서명·메일 발송·조치 등록을 실행하지 않습니다.
- If `log_task` exists, record only the advertised general-document category and actual review/reuse flags. Never include the document, conversation, project names or identifiers. Without MCP, finish the draft and state no local MCP log was made.
- `log_task`가 있으면 공개된 일반 문서 분류와 실제 검토·재사용 상태만 기록합니다. 문서·대화·프로젝트명·식별정보는 넣지 않습니다. MCP가 없으면 초안을 완성하고 로컬 MCP 기록을 하지 않았다고 알립니다.
