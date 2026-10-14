---
name: work-logs-and-settlements
description: Turn supplied farm or fishery quantities and unit prices into draft work logs and checked settlement tables. Use for arithmetic drafts, not tax filings or payment confirmation.
license: CC-BY-4.0
metadata:
  languages: "ko,en"
  purpose: "Farm and fishery operators preparing checked work-log and settlement drafts."
  reference_sources: "docs/pilot/fictional-exercises.md; user-supplied quantities and prices"
  reviewer: "pending: operator-appointed domain reviewer"
  version: "1.0.1"
  sunset: "purpose-limited"
  sunset_rule: "Keep only arithmetic drafting; retire any local form mapping when its operator replaces the form."
  issue_report_path: "https://github.com/halla-ai/ax-commons/issues"
---

# Farm and fishery records / 농수산 작업일지·정산 초안

- Use supplied activity, quantity, unit, currency, unit price and cost facts. During training use the separate farm and fishery cards in `docs/pilot/fictional-exercises.md`. Do not add actual names, account numbers or workplace records.
- 제공된 작업·수량·단위·통화·단가·비용을 사용합니다. 교육에는 `docs/pilot/fictional-exercises.md`의 별도 농장·어장 카드를 사용합니다. 실명·계좌번호·현장 기록은 넣지 않습니다.
- Build one row per activity: quantity, unit, unit price, quantity times unit price and supplied costs. Show the multiplication and total so a person can recompute it. Keep unlike units, currencies and unrelated enterprises separate.
- 작업별로 수량·단위·단가·수량×단가·제공 비용을 한 행에 둡니다. 사람이 재계산할 수 있게 산식과 합계를 표시합니다. 서로 다른 단위·통화·사업장은 분리합니다.
- Missing values remain unknown. Do not replace missing costs with zero, infer tax rates, label a before-tax remainder as profit or mark amounts as paid. If a tax/legal decision is requested, obtain authoritative current guidance outside this arithmetic skill.
- 누락값은 미확인으로 남깁니다. 비용 누락을 0원으로 바꾸거나 세율을 추정하거나 세금 반영 전 잔액을 이익·지급완료로 표시하지 않습니다. 세무·법률 판단은 이 산술 스킬 밖에서 현행 정본으로 확인합니다.
- Produce a Korean draft record and an English equivalent with matching units and totals. Recompute the arithmetic independently before presenting it for human review; identify missing information before finalization. Never create a payment instruction or submit an official settlement.
- 단위·합계가 일치하는 한국어 초안과 영어 대응문을 작성합니다. 제시 전에 산술을 별도로 재계산하고 최종화 전 누락을 알립니다. 지급 지시·공식 정산 제출은 실행하지 않습니다.
- If `log_task` exists, log only the advertised farm/fishery category and actual review/reuse flags. Do not log quantities, prices, document text or identifiers. Without MCP, finish the draft and state no local MCP log was made.
- `log_task`가 있으면 공개된 농수산 분류와 실제 검토·재사용 상태만 기록합니다. 수량·가격·문서 본문·식별정보는 기록하지 않습니다. MCP가 없으면 초안을 완성하고 로컬 MCP 기록을 하지 않았다고 알립니다.
