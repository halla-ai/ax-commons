---
name: multilingual-replies
description: Draft multilingual hospitality replies from supplied policy facts. Use for guest questions; escalate refunds, safety and missing policy to a human.
license: CC-BY-4.0
metadata:
  languages: "ko,en"
  purpose: "Hospitality staff drafting reviewed multilingual guest replies."
  reference_sources: "docs/pilot/fictional-exercises.md; user-supplied approved policy facts"
  reviewer: "claude (technical review); domain reviewer pending operator assignment"
  version: "1.0.0"
  sunset: "scope-limited"
  sunset_rule: "Retire policy-dependent sections when the referenced policy changes; use only the current supplied policy."
  issue_report_path: "https://github.com/halla-ai/ax-commons/issues"
---

# Multilingual hospitality replies / 다국어 숙박·관광 답변

- Use supplied policy facts, the customer's requested language and the intended reply channel. For training, use only the hospitality fact card in `docs/pilot/fictional-exercises.md` or another explicitly fictional card.
- 제공된 규정·사실, 요청 언어, 답변 채널을 사용합니다. 교육에는 `docs/pilot/fictional-exercises.md`의 숙박 사실 카드나 명시적인 가상 카드만 사용합니다.
- Distinguish confirmed policy, missing policy and a requested exception. Do not invent availability, prices, accessibility arrangements, cancellation rights or compensation. Escalate emergency/safety concerns and exceptions to staff; never promise a remedy without authority.
- 확정 규정·누락 규정·예외 요청을 구분합니다. 예약 가능 여부·가격·접근성 지원·취소 권리·보상을 만들지 않습니다. 안전 문제와 예외는 담당자에게 넘기고 권한 없는 해결책을 약속하지 않습니다.
- Produce a Korean staff note and the requested-language draft. Preserve times, amounts and policy uncertainty across translations. Put internal questions in the staff note, outside the customer draft.
- 한국어 직원 메모와 요청 언어 답변 초안을 만듭니다. 시각·금액·규정의 불확실성을 번역에서도 유지합니다. 내부 확인 질문은 고객 초안과 분리해 직원 메모에 둡니다.
- Ask the user to confirm policy-sensitive parts before treating the response as ready. Drafting does not authorize sending a guest message or changing a reservation.
- 규정 관련 부분을 사용자가 확인한 뒤 사용 가능 상태로 판단합니다. 초안 작성은 고객 발송·예약 변경 승인으로 취급하지 않습니다.
- At completion, if `log_task` is available, use its advertised schema to record the hospitality category and actual human-review/reuse flags. Do not include the guest message, reply, policy text or identifiers; do not infer that the draft was sent. Without MCP, complete the draft normally and say no local MCP log was made.
- 완료 시 `log_task`가 있으면 공개된 입력 스키마에 맞춰 숙박 분류와 실제 사람 검토·재사용 여부만 기록합니다. 고객 메시지·답변·규정 본문·식별정보를 넣거나 발송을 추정하지 않습니다. MCP가 없으면 초안을 완성하고 로컬 MCP 기록을 하지 않았다고 알립니다.
