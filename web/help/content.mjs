const release = "https://github.com/halla-ai/ax-commons/releases/latest";
const skills = "https://github.com/halla-ai/ax-commons/tree/main/commons/skills";
const install = "https://github.com/halla-ai/ax-commons/blob/main/docs/install.md";
const support = "https://github.com/halla-ai/ax-commons/blob/main/docs/support-matrix.md";
const issue = "https://github.com/halla-ai/ax-commons/issues/new";

export const helpContent = {
  ko: {
    title: "설치와 사용 안내",
    description: "AX Commons를 시작하고, 기록과 선택적 공유를 관리하는 방법입니다.",
    nav: { dashboard: "대시보드", contribute: "기여물 제출", help: "도움말", language: "언어" },
    intro: "작업 기록은 기기에 남습니다. 서비스 설정만으로 전송하지 않으며, 기여물 공유와 월별 집계 전송에는 각각 명시적 승인이 필요합니다.",
    quickStart: {
      title: "처음 시작하기",
      steps: ["앱에서 로컬 MCP를 지원하는지 확인합니다. 지원하지 않아도 스킬을 일반 지침으로 사용할 수 있습니다.", "Claude Desktop에서는 최신 릴리스의 ax-commons.mcpb를 설치합니다. 공유 코드 없이 로컬 기록부터 시작할 수 있습니다.", "스킬로 작업하고 결과를 직접 검토합니다. 로컬 MCP가 있으면 log_task로 분류와 상태만 기록합니다."],
    },
    sections: [
      {
        id: "install", title: "로컬 MCP 설치",
        paragraphs: ["최신 릴리스에서 ax-commons.mcpb를 다운로드하고 Claude Desktop의 확장 설치 흐름으로 엽니다. 실행에는 Node 22.13 이상이 필요합니다. 실제 설치 화면과 비개발자의 5분 설치 목표는 아직 실측하지 않았습니다.", "접속 코드는 선택 사항입니다. 로컬 전용으로 쓰려면 비워 둡니다. 공유할 때만 운영자가 발급한 서비스 주소, 가명 프로그램 ID와 별도의 측정·기여 코드를 입력합니다. 프로그램 ID에 이름이나 이메일을 쓰지 않습니다."],
        steps: ["확장 설명과 기록 항목을 읽고 설치합니다.", "consent_status로 로컬 기록, 설정된 경로와 전송 이력을 확인합니다.", "도구가 보이지 않으면 앱의 연결 설정과 확장 활성화 상태를 확인합니다."],
        links: [{ label: "최신 릴리스", href: release }, { label: "상세 설치 안내", href: install }, { label: "앱 지원표", href: support }],
      },
      {
        id: "usage", title: "작업과 기록",
        paragraphs: ["스킬의 한국어 또는 영어 지침을 따라 작업하고 사용 전에 결과를 검토합니다. declare_intent에는 정해진 작업·이유 분류를, log_task에는 작업 분류, 검토·재사용 여부와 선택적인 시간·승인된 skill_id를 넣습니다. report_issue는 정해진 오류·수정 분류를 기록합니다. 기록 도구에 결과물이나 대화문을 붙여 넣지 않습니다.", "ChatGPT 등에서 로컬 MCP를 사용할 수 없다면 스킬을 일반 지침으로 사용하고 기록 호출은 생략합니다. 원격 커넥터 지원만으로 로컬 MCP도 지원한다고 판단하지 않습니다. 기록이 없다는 이유로 작업 실패나 활동 0건으로 세지 않습니다."],
        links: [{ label: "스킬 모음", href: skills }, { label: "앱별 지원 범위", href: support }],
      },
      {
        id: "sharing", title: "선택적 공유",
        paragraphs: ["submit_contribution의 preview로 선택한 내용과 해시를 확인한 뒤 submit에서 별도로 승인합니다. 공개 범위만 지원하며 reviewers-only는 거절됩니다. 만료일은 90일 이내로 정합니다. 제출은 검토 PR을 만들며 접수증이 머지 완료를 뜻하지 않습니다. 공유를 거절해도 지원에 영향이 없습니다.", "운영자가 발급한 참여 코드가 있다면 웹 기여 폼도 사용할 수 있습니다. 미리보기 뒤 별도의 승인 클릭이 필요합니다. 제출 기록에는 철회 인증정보가 있으므로 비공개로 보관합니다. 응답을 잃었다면 기존 기록으로 상태를 확인하고 새 제출을 반복하지 않습니다.", "sync_metrics는 달력 월별 승인 후 가명 프로그램 ID에 연결한 집계만 전송합니다. 5건 미만 셀은 제외합니다. 이는 활동 건수 보호이며 참가자 익명성을 보장하지 않습니다. 공개 월별 보고서는 다음 달 8일부터 고정되므로 공개 후 집계 철회로 수정되지 않습니다."],
        links: [{ label: "기여 폼", href: "/contribute/" }],
      },
      {
        id: "records", title: "내보내기, 삭제와 철회",
        paragraphs: ["최신 릴리스의 ax-commons-cli.mjs로 로컬 기록 경로를 확인하고 내보내거나 삭제합니다. 내보내기는 철회 인증정보를 제외합니다. 내보낼 위치는 원장과 SQLite 보조 파일과 다른 곳으로 정합니다.", "원격 공유를 철회하려면 인증정보를 삭제하기 전에 revoke를 사용합니다. 지표 철회는 해당 출처·월의 추후 업로드를 차단합니다. 이미 머지된 기여물은 관리자가 제거 PR을 머지하고 실제 제거를 확인할 때까지 대기 상태입니다.", "로컬 삭제나 확장 제거는 원격 철회가 아닙니다. 내보낸 파일, 백업과 비공개 저장소 이력은 별도 관리가 필요합니다. 이미 배포된 CC BY 4.0 사본과 일반 Git 이력은 회수할 수 없습니다."],
        commands: [{ label: "원장 위치", code: "node ax-commons-cli.mjs path" }, { label: "내보내기", code: "node ax-commons-cli.mjs export --out ./ledger-export.json" }, { label: "로컬 삭제", code: "node ax-commons-cli.mjs delete --confirm" }],
        links: [{ label: "CLI 다운로드", href: release }],
      },
      {
        id: "cautions", title: "사용 전 주의사항",
        paragraphs: ["실습에는 가상 자료를 사용합니다. 실제 고객·직원 정보, 식별자, 비밀번호, 토큰과 대화문을 기록 도구나 공개 기여물에 넣지 않습니다. 패턴 검사는 모든 개인정보나 위험한 문맥을 찾아내지 못하므로 사람이 검토해야 합니다.", "파일럿 측정 전 운영자의 프로그램명, 일정, 연락처와 보관·삭제 안내를 확인합니다. 안내가 비어 있으면 측정을 시작하지 않습니다. 설치 성공률이나 파일럿 효과는 아직 측정하지 않았습니다.", "문제를 알릴 때는 도구 이름, 안전한 오류 분류와 재현 단계만 씁니다. 공개 이슈에 개인자료, 실제 내용, 토큰 또는 철회 인증정보를 붙이지 않습니다. 민감한 문제는 운영자의 비공개 연락 경로로 알립니다."],
        links: [{ label: "안전하게 문제 보고", href: issue }],
      },
    ],
    faq: {
      title: "자주 묻는 질문",
      items: [
        { question: "공유 코드를 반드시 입력해야 하나요?", answer: "아닙니다. 비워 두고 로컬 전용으로 사용할 수 있습니다. 코드 설정만으로도 전송하지 않습니다." },
        { question: "ChatGPT에서도 쓸 수 있나요?", answer: "스킬을 일반 지침으로 사용할 수 있습니다. 로컬 MCP를 사용할 수 없으면 기록 호출을 생략합니다. 앱별 연결 기능은 지원표를 확인합니다." },
        { question: "설치 후 도구가 보이지 않습니다.", answer: "앱의 확장 활성화와 MCP 연결 설정을 확인하고 설치 안내의 실행 조건을 확인합니다. 공개 도움 요청에 접속 코드를 넣지 않습니다." },
        { question: "대시보드가 비어 있으면 활동이 없다는 뜻인가요?", answer: "아닙니다. 공개 가능한 셀이 없거나 아직 공개 시점이 아닐 수 있습니다. 5건 미만 셀은 숨기며 0건으로 해석하지 않습니다." },
        { question: "제출했는데 응답을 받지 못했습니다.", answer: "기존 접수증의 ID와 철회 인증정보로 상태를 확인합니다. 웹에서는 저장한 제출 기록을 복원합니다. 확인 없이 새 제출을 만들지 않습니다." },
        { question: "비공개로 기여할 수 있나요?", answer: "현재는 공개 범위만 지원하며 reviewers-only는 거절됩니다. 비공개 자료를 공개 폼에 넣지 않습니다." },
        { question: "삭제하면 공유한 자료도 없어지나요?", answer: "로컬 삭제는 원격 철회가 아닙니다. 먼저 revoke로 철회하고 제거 상태를 확인합니다. 공개 사본과 일반 Git 이력은 회수할 수 없습니다." },
        { question: "운영자에게 어떤 정보를 보내야 하나요?", answer: "도구 이름, 안전한 오류 분류와 재현 단계만 전달합니다. 개인정보와 인증정보는 공개 이슈에 올리지 않습니다." },
      ],
    },
    footer: "실제 사용자 설치와 파일럿 검증은 별도 절차입니다. 자동 테스트나 서비스 응답은 그 결과를 대신하지 않습니다.",
  },
  en: {
    title: "Installation and help",
    description: "Start using AX Commons and manage local records and optional sharing.",
    nav: { dashboard: "Dashboard", contribute: "Contribute", help: "Help", language: "Language" },
    intro: "Activity records stay on your device. Configuration alone sends nothing. Contributions and monthly aggregate uploads each require explicit approval.",
    quickStart: {
      title: "Get started",
      steps: ["Check whether your app supports local MCP. Skills also work as plain instructions without it.", "For Claude Desktop, install ax-commons.mcpb from the latest release. Start with local records without sharing codes.", "Use a skill and review the result. With local MCP, record only categories and flags through log_task."],
    },
    sections: [
      {
        id: "install", title: "Install local MCP",
        paragraphs: ["Download ax-commons.mcpb from the latest release and open it through Claude Desktop's extension installation flow. Runtime requires Node 22.13 or later. Native installation screens and the five-minute non-developer installation target have not been measured.", "Access codes are optional; leave them empty for local-only use. For sharing, use the operator-issued service URL, program pseudonym and separate measurement and contribution codes. Never use a name or email as the program ID."],
        steps: ["Read the extension description and recorded fields before installing.", "Run consent_status to inspect local records, configured routes and transmission history.", "If tools are missing, check connection settings and whether the extension is enabled."],
        links: [{ label: "Latest release", href: release }, { label: "Detailed installation guide", href: install }, { label: "App support matrix", href: support }],
      },
      {
        id: "usage", title: "Work and logging",
        paragraphs: ["Follow a skill in Korean or English and review results before use. declare_intent takes fixed task and reason categories. log_task takes task category, review and reuse flags, optional minutes and an approved skill_id. report_issue records fixed failure and correction categories. Never paste results or conversations into logging tools.", "In ChatGPT or another app without local MCP, use skills as plain instructions and omit logging calls. Remote connector support does not imply local MCP support. Missing logs do not mean failed tasks or zero activity."],
        links: [{ label: "Skill collection", href: skills }, { label: "App capabilities", href: support }],
      },
      {
        id: "sharing", title: "Optional sharing",
        paragraphs: ["Use submit_contribution preview to inspect selected content and its hash, then approve separately through submit. Only public scope is supported; reviewers-only is rejected. Choose expiry within 90 days. Submission opens a review PR; a receipt does not mean it was merged. Declining sharing does not affect support.", "The web contribution form accepts operator-issued participation codes and requires a separate approval click after preview. Keep the downloaded submission record private; it contains a withdrawal credential. After a lost response, check that record's status instead of creating another submission.", "sync_metrics requires approval for a calendar month and sends only program-keyed aggregates. Cells below five are omitted. This protects activity counts, not participant anonymity. Public monthly reports freeze from the next month's eighth day and remain unchanged after aggregate withdrawal."],
        links: [{ label: "Contribution form", href: "/contribute/" }],
      },
      {
        id: "records", title: "Export, delete and withdraw",
        paragraphs: ["Use ax-commons-cli.mjs from the latest release to locate, export or delete local records. Exports exclude withdrawal credentials. Choose an export destination different from the ledger and its SQLite sidecars.", "Use revoke before deleting credentials when remote withdrawal is needed. Metric withdrawal blocks later uploads for that source and month. Merged contributions remain pending until a maintainer merges the removal PR and confirms actual removal.", "Local deletion or extension removal is not remote withdrawal. Exports, backups and private storage history need separate management. Existing CC BY 4.0 copies and ordinary Git history cannot be recalled."],
        commands: [{ label: "Locate ledger", code: "node ax-commons-cli.mjs path" }, { label: "Export", code: "node ax-commons-cli.mjs export --out ./ledger-export.json" }, { label: "Delete local data", code: "node ax-commons-cli.mjs delete --confirm" }],
        links: [{ label: "Download CLI", href: release }],
      },
      {
        id: "cautions", title: "Before you use it",
        paragraphs: ["Use fictional exercise data. Never put real customer or employee information, identifiers, passwords, tokens or conversation text into logging tools or public contributions. Pattern checks cannot detect all identifying or unsafe context; human review is required.", "Before pilot measurement, check the operator's program name, dates, contact and retention/deletion notice. Do not start measurement with missing notice fields. Installation success and pilot effectiveness have not been measured.", "Report only tool names, safe error categories and reproduction steps. Never paste personal data, actual content, tokens or withdrawal credentials into public issues. Use the operator's private contact for sensitive problems."],
        links: [{ label: "Report a problem safely", href: issue }],
      },
    ],
    faq: {
      title: "Frequently asked questions",
      items: [
        { question: "Are sharing codes required?", answer: "No. Leave them empty for local-only use. Configuring codes alone sends nothing." },
        { question: "Can I use this in ChatGPT?", answer: "Use skills as plain instructions. Omit logging calls without local MCP, and check the support matrix for app connection capabilities." },
        { question: "Why are tools missing after installation?", answer: "Check extension activation, MCP connection settings and the installation guide's runtime requirements. Never include access codes in a public help request." },
        { question: "Does an empty dashboard mean no activity?", answer: "No. There may be no publishable cells or the month may not be released yet. Cells below five are hidden, not counted as zero." },
        { question: "What if submission returns no response?", answer: "Check status using the existing receipt ID and withdrawal credential. Restore the saved submission record in the web form. Do not create another submission without checking." },
        { question: "Can I contribute privately?", answer: "Only public scope is available; reviewers-only is rejected. Never put private material into the public form." },
        { question: "Does deletion remove shared material?", answer: "Local deletion is not remote withdrawal. Use revoke first and check removal status. Public copies and ordinary Git history cannot be recalled." },
        { question: "What should I send to the operator?", answer: "Send only tool names, safe error categories and reproduction steps. Keep personal data and credentials out of public issues." },
      ],
    },
    footer: "Real-user installation and pilot validation are separate steps. Automated tests and service responses do not establish those outcomes.",
  },
};
