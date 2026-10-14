# Pilot participation notice / 파일럿 참여 안내

Status: preparation material, not a record of participant consent.

## Before the first exercise / 첫 실습 전

- The operator fills in the program name, dates, responsible contact and retention period before distributing this notice. If these are blank, do not start measurement.
- 운영자는 안내 전에 프로그램명, 일정, 담당 연락처, 보관 기간을 확정합니다. 빈 항목이 있으면 측정을 시작하지 않습니다.
- Program / 프로그램: [operator to complete]
- Dates / 일정: [operator to complete]
- Contact / 담당 연락처: [operator to complete]
- Local record retention and deletion date / 로컬 기록 보관 기간 및 삭제일: [operator to complete]
- Report period and recipient / 보고 기간 및 수신 대상: [operator to complete]

## What is recorded / 기록 항목

- The exercises use fictional data. Do not enter real customer, employee, applicant or business records, credentials, conversation transcripts, or identifiers.
- 실습에는 가상 자료만 사용합니다. 실제 고객·직원·지원자·사업 자료, 인증정보, 대화문, 식별정보를 입력하지 않습니다.
- Minimal measurement covers task categories, attempts, human-review and reuse flags, and optional time estimates. The local MCP ledger stays on your device. The exact input fields are shown by the installed tools; use only category tags and flags, never paste the work itself into a logging tool.
- 최소 측정 항목은 작업 종류, 시도 횟수, 사람이 검토했는지와 결과를 재사용했는지, 선택적인 시간 추정치입니다. MCP 기록장은 본인 기기에 남습니다. 설치된 도구의 실제 입력 항목을 확인하고, 기록 도구에는 분류 태그와 상태만 넣습니다.
- Version 0.2.1 supports optional transmission. Configuring the service or receiving this notice does not send data. Each `sync_metrics` upload requires approval for a calendar month and sends only aggregate counts keyed by a pseudonymous program ID, with cells below five omitted. Raw local observations and conversation text are not uploaded.
- 버전 0.2.1은 선택적 전송을 지원합니다. 서비스 설정이나 이 안내 수령만으로 전송하지 않습니다. `sync_metrics`는 달력 월별 승인을 받은 뒤 가명 프로그램 ID에 연결한 집계 건수만 전송하며 5건 미만 셀은 제외합니다. 로컬 원시 관찰값과 대화문은 업로드하지 않습니다.
- If your app cannot use the local server, you can complete the same exercises without logging through MCP. Report that route separately; do not count missing logs as failed tasks or zero activity.
- 로컬 서버를 사용할 수 없어도 같은 실습을 수행할 수 있습니다. 이 경로는 별도로 집계하며, 기록 누락을 작업 실패나 활동 0건으로 취급하지 않습니다.

## Optional sharing / 선택적인 기여물 공유

- Sharing a prompt, skill, success or failure case is optional and separate from minimal program measurement. Declining sharing does not affect training, support or participation.
- 프롬프트·스킬·성공 사례·실패 사례 공유는 최소 측정과 별개의 선택 사항입니다. 공유를 거절해도 교육·지원·참여에 불이익이 없습니다.
- Use the released MCP contribution tool or [web form](https://ax-commons.halla.ai/contribute/) only when the operator has configured access. Otherwise keep a local draft. Each submission requires preview of the exact content, separate explicit approval, public scope and an expiry within 90 days. It opens a review PR; a receipt does not mean the contribution was merged.
- 운영자가 접속을 설정한 경우에만 배포된 MCP 기여 도구나 [웹 폼](https://ax-commons.halla.ai/contribute/)을 사용합니다. 그 외에는 로컬 초안으로 보관합니다. 제출마다 정확한 내용의 미리보기, 별도의 명시적 승인, 공개 범위, 90일 이내 만료일이 필요합니다. 제출은 검토 PR을 만들며 접수증은 머지 완료를 뜻하지 않습니다.
- `reviewers-only` is unavailable and rejected. Do not publish a private contribution through a public repository or form. A facilitator may not approve on a participant's behalf.
- `reviewers-only`는 미지원으로 거절됩니다. 비공개 기여물을 공개 저장소나 폼으로 게시하지 않습니다. 진행자가 참가자 대신 승인할 수 없습니다.
- Retain the private submission receipt and withdrawal credential to check uncertain submissions and request removal. Already merged content remains pending until a maintainer merges its removal PR and repository readback confirms absence. Public content is licensed under CC BY 4.0. Withdrawal ends future project publication and use, but cannot recall licensed copies or erase normal Git history. Explain this before approval, together with the withdrawal contact and procedure in [CONTRIBUTING](../../CONTRIBUTING.md).
- 제출 결과 확인과 철회를 위해 비공개 접수증과 철회 인증정보를 보관합니다. 이미 머지된 콘텐츠는 관리자가 제거 PR을 머지하고 저장소에서 제거를 확인할 때까지 철회 대기 상태입니다. 공개 콘텐츠에는 CC BY 4.0이 적용됩니다. 철회는 향후 프로젝트 게시·사용을 중단하지만 이미 허가된 사본이나 일반적인 Git 이력을 회수하지 못합니다. 승인 전에 [기여 규칙](../../CONTRIBUTING.md)의 철회 연락·절차와 함께 설명합니다.

## Control of your local records / 로컬 기록 관리

- Follow the released [installation guide](../install.md) to inspect, export and delete your local ledger. Revoke remote sharing before deleting local withdrawal credentials when needed; local deletion does not remove remote data. Export files remain local and need separate deletion. Removing an extension alone is not proof that its ledger was deleted.
- 배포된 [설치 안내](../install.md)에 따라 로컬 기록장을 확인·내보내기·삭제할 수 있습니다. 원격 공유 철회가 필요하면 로컬 철회 인증정보를 삭제하기 전에 진행합니다. 로컬 삭제는 원격 자료를 제거하지 않습니다. 내보낸 파일은 별도로 삭제해야 합니다. 확장 삭제만으로 기록장 삭제를 확인했다고 판단하지 않습니다.
- Questions and refusal can be raised privately with the operator's named contact. The facilitator records notice delivery as an aggregate process count, not a signed consent claim or a list of participant names.
- 질문이나 거절 의사는 안내에 기재된 담당자에게 개별 전달할 수 있습니다. 진행자는 안내 전달을 집계한 절차 건수로 기록하며, 서명 동의 사실이나 실명 명단으로 만들지 않습니다.
