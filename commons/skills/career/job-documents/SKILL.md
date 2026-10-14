---
name: job-documents
description: Draft resumes and motivation statements from supplied experience and a job description. Use for factual document drafts; do not invent credentials or submit applications.
license: CC-BY-4.0
metadata:
  languages: "ko,en"
  purpose: "Job seekers preparing factual, reviewed application-document drafts."
  reference_sources: "docs/pilot/fictional-exercises.md; user-supplied experience and job description"
  reviewer: "pending: operator-appointed domain reviewer"
  version: "1.0.1"
  sunset: "purpose-limited"
  sunset_rule: "Keep factual drafting only; retire employer-specific guidance when that listing closes or changes."
  issue_report_path: "https://github.com/halla-ai/ax-commons/issues"
---

# Job documents / 구직 문서

- Use the supplied experience and requirements. For training use the fictional applicant and listing in `docs/pilot/fictional-exercises.md`; use placeholders for identity and contact fields.
- 제공 경력과 요건을 사용합니다. 교육에는 `docs/pilot/fictional-exercises.md`의 가상 지원자·공고를 사용하며 신원·연락처 항목은 자리표시자로 둡니다.
- Map each relevant requirement to supplied evidence. Mark gaps as questions for the applicant; do not turn a class, volunteer shift or interest into a certification, paid role or quantified achievement.
- 관련 요건마다 제공 근거를 연결합니다. 빈 부분은 지원자 확인 질문으로 두며 수업·봉사·관심을 자격증·유급 직무·정량 성과로 바꾸지 않습니다.
- Produce the requested resume bullets and motivation statement in Korean and English, preserving the same factual claims in both. Avoid sensitive personal details not needed for the draft and do not guess protected attributes.
- 요청한 이력서 항목과 지원 동기를 한국어·영어로 작성하고 두 언어에서 동일한 사실 주장을 유지합니다. 불필요한 민감정보를 넣거나 개인 특성을 추정하지 않습니다.
- Have the applicant verify all experience and dates. Drafting does not authorize application submission, employer contact or account creation; use no external lookup about the applicant without a separate request.
- 지원자가 모든 경력·날짜를 검토하게 합니다. 초안 작성은 지원 제출·고용주 연락·계정 생성 승인으로 취급하지 않습니다. 별도 요청 없이 지원자의 외부 정보를 조회하지 않습니다.
- If `log_task` exists, record only the advertised job-seeking category and actual review/reuse flags. Keep the resume, listing, identity and contact data out of the ledger. Without MCP, provide the draft and state no local MCP log was made.
- `log_task`가 있으면 공개된 구직 분류와 실제 검토·재사용 상태만 기록합니다. 이력서·공고·신원·연락처는 기록장에서 제외합니다. MCP가 없으면 초안을 제공하고 로컬 MCP 기록을 하지 않았다고 알립니다.
