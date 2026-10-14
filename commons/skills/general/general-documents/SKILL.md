---
name: general-documents
description: Mark evidence and structure ordinary business documents from supplied facts, preserving proposals, decisions and unknowns. Route summaries and translations to the dedicated general skills.
license: CC-BY-4.0
metadata:
  languages: "ko,en"
  purpose: "Staff marking evidence and structuring reviewed general documents from supplied facts."
  reference_sources: "docs/pilot/fictional-exercises.md; user-supplied document facts"
  reviewer: "Young Joon Lee (interim; operator domain review pending)"
  version: "1.0.2"
  sunset: "scope-limited"
  sunset_rule: "Retire organization-specific format guidance when its approved template changes."
  issue_report_path: "https://github.com/halla-ai/ax-commons/issues"
---

# General documents / 일반 문서

- Establish the requested document purpose from the supplied facts. For training use the fictional meeting card in `docs/pilot/fictional-exercises.md`. Route summaries to `summary-with-evidence` and translations to `bilingual-translation`, under `commons/skills/general/`, when installed. If those skills are unavailable, disclose that limit and complete only evidence marking and document structure.
- 제공 사실에서 문서 목적을 확인합니다. 교육에는 `docs/pilot/fictional-exercises.md`의 가상 회의 카드를 사용합니다. 요약은 `commons/skills/general/`의 `summary-with-evidence`, 번역은 `bilingual-translation`이 설치돼 있으면 해당 스킬로 넘깁니다. 없으면 제한을 알리고 근거 표시·문서 구조화만 수행합니다.
- Separate proposals, confirmed decisions, assigned actions and unknowns. Do not invent approval, owners, deadlines, signatures or completed actions. Keep an unspecified meeting date or approver pending.
- 제안·확정 결정·배정 조치·미확인을 구분합니다. 승인·담당자·마감·서명·완료 사실을 만들지 않습니다. 지정되지 않은 회의 날짜·승인자는 미정으로 둡니다.
- Structure the document in the requested language using purpose, supplied facts, confirmed decisions, actions and unresolved questions as appropriate. Mark each substantive statement as supplied evidence, inference or unknown, and point to its supplied fact or source. Put confirmation questions outside the final-copy block; do not convert an inference into a confirmed decision.
- 요청 언어로 목적·제공 사실·확정 결정·조치·미해결 질문을 필요한 구조로 배치합니다. 주요 문장은 제공 근거·추론·미확인으로 표시하고 해당 사실·출처를 연결합니다. 확인 질문은 최종 카피 밖에 두며 추론을 확정 결정으로 바꾸지 않습니다.
- Ask for human review of the unresolved parts before treating the document as final. Do not submit, sign, email or register actions from the document unless separately authorized.
- 미해결 항목은 사람이 검토한 뒤 최종본으로 판단합니다. 별도 승인 없이 제출·서명·메일 발송·조치 등록을 실행하지 않습니다.
- If `log_task` exists, record only the advertised general-document category and actual review/reuse flags. Never include the document, conversation, project names or identifiers. Without MCP, finish the draft and state no local MCP log was made.
- `log_task`가 있으면 공개된 일반 문서 분류와 실제 검토·재사용 상태만 기록합니다. 문서·대화·프로젝트명·식별정보는 넣지 않습니다. MCP가 없으면 초안을 완성하고 로컬 MCP 기록을 하지 않았다고 알립니다.
