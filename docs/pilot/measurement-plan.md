# Pilot measurement plan / 파일럿 측정 계획

Status: definitions prepared; no observed pilot data.

## Units and outcomes / 단위와 결과

| Metric | Numerator | Denominator | Evidence |
| --- | --- | --- | --- |
| Install failure rate / 설치 실패율 | Attempts that did not reach the first successful local task log during the session | Supported-app participants who actually attempted installation | Observer timer and local tool confirmation; count one initial attempt per participant |
| Install within five minutes / 5분 이내 설치 | Initial attempts reaching the first successful task log in at most 300 seconds | The same initial installation attempts | Observed duration; not a developer smoke test |
| MCP logging rate / MCP 기록률 | Eligible exercise attempts with a confirmed local `log_task` entry | Exercise attempts on a working local MCP route | Local ledger confirmation plus facilitator's aggregate exercise tally |
| Standalone completion rate / 독립 실행 완료율 | Completed exercises on the no-MCP route | Exercises attempted on that route | Manual aggregate tally, separate from MCP logs |
| Contribution rate / 기여율 | Participants with at least one approved submission with a verified receipt | Participants offered a functioning P2 contribution flow | On-device aggregate observation; a draft or approval click without a receipt is not a submission |

- Count repeated task attempts as attempts for logging metrics. Count each participant once for installation and contribution metrics. An observer keeps these distinctions during the session without a retained identifier list.
- 기록률에는 반복 작업을 시도 단위로 셉니다. 설치율과 기여율은 참가자당 한 번 셉니다. 관찰자가 수업 중 단위를 구분하고 식별자 명단은 보관하지 않습니다.
- Use only counts, coarse task categories, actual review/reuse flags and optional duration estimates. Keep all observations on the operator's device, under the retention period disclosed in the notice. Do not collect conversations, output text, names, email addresses, device IDs or participant timestamps.
- 건수, 넓은 작업 분류, 실제 검토·재사용 상태, 선택적 시간 추정치만 사용합니다. 관찰값은 안내한 보관 기간 동안 운영자 기기에 둡니다. 대화·산출물 본문, 실명·이메일·기기 ID·개인별 시각은 수집하지 않습니다.
- The observer may inspect a confirmation on a participant's device with permission, but must not copy the ledger or its records. Keep aggregate manual counts separate from ledger-derived counts; reconcile missing/duplicate logs locally before reporting. Never add the two populations together blindly.
- 허락을 받아 참가자 기기의 성공 확인을 볼 수 있으나 기록장이나 개별 기록을 복사하지 않습니다. 수기 집계와 기록장 집계를 구분하고 누락·중복은 보고 전 로컬에서 대조합니다.

## Unavailable and unknown / 미제공·미확인

- Zero denominator: rate is `not applicable`, never 0%. Missing observation: `unknown`, never zero.
- 분모가 0이면 비율은 `해당 없음`입니다. 관찰값 누락은 `미확인`이며 0건이 아닙니다.
- No released P1: installation and MCP logging outcomes are `not measured`. No P2: contribution rate is `not applicable`; local drafts may be described as a process step, not as verified contributions.
- P1이 배포되지 않았으면 설치·MCP 기록은 `미측정`입니다. P2가 없으면 기여율은 `해당 없음`입니다. 로컬 초안은 절차 진행으로만 설명하며 검증된 기여물로 세지 않습니다.
- Notice delivery precedes measurement. If the notice was missing or incomplete, report the process failure and do not claim AC2 passed. Partner approval and individual sharing approval are different facts.
- 안내는 측정보다 먼저 제공합니다. 누락·불완전한 안내가 있으면 절차 실패로 기록하고 AC2 통과를 주장하지 않습니다. 기관 승인과 개인의 기여물 공유 승인은 별개 사실입니다.

## Publication / 외부 보고

- Minimum cell size is 5. Keep raw counts local. External reports contain only aggregates keyed by a pseudonymous program identifier, with no participant-level data or identifying institution details.
- 최소 셀 크기는 5입니다. 원시 건수는 로컬에 둡니다. 외부 보고에는 가명 프로그램 식별자의 집계만 사용하며 개인별 자료나 기관 식별정보를 넣지 않습니다.
- Suppress every count below five and its rate. Also suppress complementary counts and rates when they would reveal the hidden cell through subtraction. Publish a binary outcome rate only when numerator and its complement are both at least five.
- 5건 미만 건수와 비율은 비공개 처리합니다. 뺄셈으로 숨긴 셀을 알 수 있는 보완 건수·비율도 숨깁니다. 이진 결과 비율은 분자와 그 보완 건수가 모두 5 이상일 때만 보고합니다.
- Do not publish overlapping totals, app/task cross-tabs, successive snapshots, or exact timing summaries that reconstruct suppressed cells. If this cannot be checked, suppress the affected table. A small pilot may therefore yield a fully suppressed external report; it still yields local operational evidence.
- 겹치는 합계, 앱·작업 교차표, 연속 스냅샷, 정확한 시간 요약으로 숨긴 셀을 복원하지 못하게 합니다. 확인할 수 없으면 해당 표 전체를 비공개 처리합니다. 소규모 파일럿의 외부 보고가 전부 비공개 처리돼도 로컬 운영 근거는 남습니다.
- P3 transmission and hosted dashboards remain outside P4 delivery. Do not send local measurements through messaging, repository issues or a web form to replace the unimplemented receiver.
- P3 전송·대시보드는 P4 산출 범위 밖입니다. 미구현 수신기를 대신해 메시지·저장소 이슈·웹 폼으로 로컬 측정값을 보내지 않습니다.
