---
name: promotion-and-replies
description: Draft small-business promotional copy and customer replies using supplied offer facts. Use for copy drafts, with no publication or customer messaging.
license: CC-BY-4.0
metadata:
  languages: "ko,en"
  purpose: "Small-business operators preparing factual promotion and customer-response drafts."
  reference_sources: "docs/pilot/fictional-exercises.md; user-supplied offer facts"
  reviewer: "Young Joon Lee (interim; operator domain review pending)"
  version: "1.0.3"
  sunset: "scope-limited"
  sunset_rule: "Retire offer-dependent instructions when price, stock or promotion terms change."
  issue_report_path: "https://github.com/halla-ai/ax-commons/issues"
---

# Promotion and customer replies / 홍보·고객 답변

- Use confirmed product, price, stock, pickup/delivery and promotion terms. For training use the small-business fictional fact card in `docs/pilot/fictional-exercises.md`.
- 확정 제품·가격·재고·수령·배송·홍보 조건을 사용합니다. 교육에는 `docs/pilot/fictional-exercises.md`의 소상공인 가상 사실 카드를 사용합니다.
- Draft the requested promotion and customer reply in Korean and English, or the user's selected pair of languages. Keep amounts, exclusions and availability consistent. Put missing terms in a separate operator checklist.
- 홍보문과 고객 답변을 한국어·영어 또는 사용자가 고른 언어 쌍으로 작성합니다. 금액·제외 조건·제공 범위를 일치시키고 누락 조건은 운영자 확인 목록으로 둡니다.
- Never invent discounts, testimonials, performance/environmental claims or scarcity deadlines. If a customer asks for a refund or exception without supplied policy, flag the decision for the operator instead of making a commitment.
- 할인·후기·성능·환경 효과·희소성 마감을 만들지 않습니다. 규정이 없는 환불·예외 요청은 운영자 판단 사항으로 표시하고 약속하지 않습니다.
- Compare every factual claim against the fact card and have the operator review the draft. Do not post, send, schedule a campaign, issue a discount or change stock as part of this skill.
- 각 사실 주장을 사실 카드와 대조하고 운영자 검토를 받습니다. 이 스킬로 게시·발송·캠페인 예약·할인 발급·재고 변경을 실행하지 않습니다.
- If `log_task` exists, record only the available small-business category and actual review/reuse flags using its advertised schema. Keep customer text, copy and identifiers out. Without MCP, deliver the drafts and state that no local MCP log was made.
- `log_task`가 있으면 공개된 스키마에 맞춰 지원되는 소상공인 분류와 실제 검토·재사용 상태만 기록합니다. 고객 본문·카피·식별정보는 제외합니다. MCP가 없으면 초안을 제공하고 로컬 MCP 기록을 하지 않았다고 알립니다.

- `log_task` 스키마에 `skill_id`가 있으면 `small-business/promotion-and-replies`를 전달합니다. 필드가 없으면 생략합니다.
- When the advertised `log_task` schema includes `skill_id`, pass `small-business/promotion-and-replies`; otherwise omit this field.
