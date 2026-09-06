# AgentStore FE 인수인계서

최종 갱신: 2026-09-06 — provider readiness 제거와 즉시 공개 UX

## AgentCode/OpenAPI HIGH_RISK failure matrix

| ID | 실패 경계·불변식 | 회귀 검증 |
|---|---|---|
| AC-FE-01 | generated client, adapter, form payload와 public JSON은 `slug`가 아닌 `code`/`agentCode`/`targetAgentCode` 계약만 사용한다. | `entities/agent/api.test.ts`, `entities/dependency/api.test.ts`, `npm run api:generate` 후 `rg` 계약 검사 |
| AC-FE-02 | `/agents/:code` route identity가 바뀌어도 이전 요청·lazy page 응답이 새 Agent 화면을 덮어쓰지 않는다. | `pages/RegistryPages.test.tsx`의 `keeps the next code page visible when the previous route request resolves late` deferred-route test |
| AC-FE-03 | Quote 발급·재확인·새 Version 전환·route unmount 중에는 owner/generation lock을 유지한다. 현재 identity의 유효 quote가 도착하면 쉬운 모드 실행 버튼을 활성화하고, 진행·만료 상태에는 이유와 재확인 경로를 표시하며 stale quote가 새 Version에 적용되지 않는다. | `features/dependencies/QuotePanel.test.tsx` request owner, reset, unmount, easy quote settle/recheck cases |
| AC-FE-06 | 새 Dependency와 Version별 Quote는 Python식 comparator를 전송하며 `^` 문법을 새로 만들지 않는다. | `features/dependencies/DependencyEditor.test.tsx`, `features/dependencies/QuotePanel.test.tsx` |
| AC-FE-04 | execution snapshot의 Root·dependency·provider candidate `agentCode`를 새로고침/SSE refetch 뒤에도 표시하며 stale replay가 되돌리지 않는다. | `pages/ExecutionPage.test.tsx`, `features/execution/ExecutionJourney.test.tsx`, `features/execution/useExecutionEvents.test.ts` |
| AC-FE-05 | atomic payment 값은 string으로 유지하고 code 전환이 금액·결제 UI 계산을 바꾸지 않는다. | `entities/agent/model.test.ts`, `features/execution/paymentPresentation.test.ts` |
| DA-FE-01 | 개발자 모드 진입은 랜딩의 bodyless `POST /api/demo/access` → localStorage Bearer → `/api/developer/me` 순서로 identity를 확정한다. 중복 클릭·실패 재시도·만료·unmount가 현재 dashboard identity를 덮지 않으며 오류 시 다음 행동을 안내한다. | `src/pages/LandingPage.test.tsx`, `src/shared/api/generatedClient.integration.test.ts`, `pages/DeveloperDashboardPage.test.tsx`, `e2e/public-browser.spec.ts`의 local HTTP API fixture 브라우저 검증 |
| DA-FE-02 | 개발자 화면은 DRAFT/ACTIVE/DISABLED 공개 상태만 보여 주며 DRAFT publish 뒤 Marketplace를 갱신한다. 공개 전 x402 결제·verification action은 없다. | `DeveloperDashboardPage.test.tsx`, `RegistryPages.test.tsx`, browser publish/Marketplace regression |
| DA-FE-03 | demo access 존재와 화면 모드는 분리한다. 새 데모 시작은 easy를 기본으로 하고, 공통 route는 선택 모드를 유지하되 개발자 전용 route는 access 뒤 developer로 열며 easy 전환 시 Marketplace로 이동한다. | `router.test.tsx`, `LandingPage.test.tsx`, `e2e/public-browser.spec.ts` |

## Function Contract Marketplace

- 개발자 navigation에 Function Contract 화면과 Agent Manifest import 화면을 추가했다. 계약 생성 시 input/output JSON Schema 문법을 먼저 검사하고 계약·ACTIVE 공급자를 조회하며, manifest는 현재 YAML 내용 검증 성공 후에만 import한다.
- Agent와 Version 등록에서 function contract를 선택할 수 있으며 선택한 계약의 response format을 그대로 사용한다.
- DRAFT dependency는 `pinned`·`allowlist`·`marketplace` 공급자 범위와 `lowest_price`·`latest_version`·`highest_reliability`·`fastest` 선택 전략을 지원한다.
- 개발자 Quote는 후보 상태, 관측 수·신뢰도·p95, 선택된 공급자·Version·가격·payTo를 보여주며 Execution API의 `quoteSnapshot`으로 새로고침 뒤에도 graph label을 복원한다.
- 쉬운 사용 모드는 function contract, Schema, 후보 정책과 wallet을 노출하지 않는다.
- 쉬운 사용 모드는 목적·비용·실행 전 확인을 먼저 보여 주고, 기술 증거는 개발자 모드에서만 펼친다.

## 저장소와 역할

- 경로: 이 저장소 루트
- 스택: React 19, Vite, TypeScript, React Router, TanStack Query
- API 계약 원본: `../agent-store-be/openapi/openapi.json`
- 생성 client는 `src/generated/`이며 직접 수정하지 않는다. `npm run api:generate`만 사용한다.

## 현재 구현 상태

- 실행 상세은 쉬운 사용·개발자 모드 모두 Quote snapshot의 예정 graph와 실제 execution step/SSE refetch를 합친 세로 카드 여정을 먼저 보여준다. 예정·준비·확인·완료·실패·결제 확인·미사용 상태를 구분하고 반복 호출은 횟수와 atomic 비용을 한 카드에 합친다.
- 완료 뒤 쉬운 사용 모드는 최종 답변 다음에 여정을 펼쳐 두며 기술 증거를 숨긴다. 개발자 모드는 Version·호출·결제 상태를 카드에 표시하고 기존 graph·provider proof·payment hash는 접힌 `거래 상세 보기`에 둔다.
- root step의 `output`이 `null` 또는 `undefined`이면 최종 결과 카드를 렌더링하지 않는다. 실제 완료된 output만 `ExecutionResult`로 전달하며 `executionOutput.ts` 순수 테스트로 null/구체값 경계를 검증한다.
- 현재 분석 경로의 root와 활성 하위 카드만 전용 progress ring을 움직이고, 준비 중인 sibling은 정적인 대기 상태로 둔다. 연결선은 관계만 표현하는 정적 요소다. 모션은 terminal·비가시 탭·reduced-motion에서 정지하며 700px 이하에서는 기술 graph를 렌더링하지 않고 세로 여정만 유지한다.
- SSE replay는 cursor/dedupe와 current execution query refetch만 담당한다. 화면은 영속된 `ExecutionDto + quoteSnapshot`을 유일한 상태 원본으로 사용한다.

- 밝은 상단 헤더와 모바일 접근성 drawer를 사용한다. `/`는 bodyless access 발급 데모 랜딩이고 Marketplace는 `/marketplace`이며 `/agents`는 `/marketplace`로 redirect한다.
- Marketplace는 검색, 정렬, cursor 기반 `더 보기`, loading/empty/error 상태를 갖는다.
- 쉬운 사용 Marketplace 카드에는 목적·예상 비용·Base Sepolia USDC (x402) 결제 방식을 표시하고, access 발급·만료·401 상태를 `aria-live`로 안내한다.
- Agent 등록은 기본 정보·실행/기능 계약·결제 정보·최종 확인 네 단계이며, 사람이 읽는 USDC 입력을 atomic 값으로 변환한다.
- Agent 상세의 Publish/Disable은 확인 dialog, query invalidation, 중복 action 차단을 갖는다.
- 실행 화면은 SSE 상태와 결제·복구 안내를 표시하며, 개발자 대시보드는 Bearer principal의 owned Agent/version,
  공개 상태와 revenue를 함께 표시한다.
- Agent 등록과 새 Version 생성에서 응답 형식(TEXT, MARKDOWN, STRUCTURED, JSON)을 선택하며 기본값은 JSON이다. Version 상세에도 선택값을 표시한다.
- 실행 결과는 step의 `responseFormat`으로 렌더링한다. Markdown은 `react-markdown`/GFM/rehype-sanitize를 사용하고, STRUCTURED만 제목·요약·섹션 카드로 해석하며 나머지 JSON은 generic viewer로 표시한다.
- public JSON 응답은 Spring `CommonResponse<T>` envelope을 entity adapter에서 unwrap한다.
- external invocation 상태 조회와 SSE는 `X-AgentStore-Invocation-Receipt` header가 필수이며, generated
  client 타입도 이 required 계약으로 동기화했다.

### 개발자 공개 화면 — 2026-09-06

- 현재 구현은 Bearer access만 사용하며 cookie credential, CSRF header, 이전 세션 경로는 존재하지 않는다.
- Dashboard는 owned Agent/version의 `초안`·`공개됨`·`비활성화됨` 상태와 수익을 보여 준다. DRAFT는 공개할 수 있고,
  실제 x402 결제는 실행을 승인할 때에만 발생한다.
- publish/disable 뒤 Agent, Marketplace, dashboard Agent/revenue query를 모두 invalidate한다. 최신 게이트 결과는 아래
  검증 명령과 `docs/capability-marketplace-failure-matrix.md`의 DA-FE 행을 기준으로 한다.
- 이번 readiness 제거 변경은 `npm run lint`, `npm run typecheck`, `npm run build`, unit test 122개와
  Playwright 45개(desktop/mobile/narrow)를 통과했다. browser publish 회귀는 DRAFT가 공개된 뒤에만
  Marketplace 카드가 나타나며 publish request가 정확히 한 번임을 local HTTP fixture로 확인한다.

### Bodyless landing·6시간 Bearer access — 2026-09-05

- `/`는 소개 랜딩이고 `/marketplace`가 catalog다. `데모 시작`은 bodyless `POST /api/demo/access`를 한 번 호출한다.
- access token과 expiry는 `agentstore.demo-access` localStorage record에만 보관한다. generated client와 legacy adapter는 유효 기간 내에만
  `Authorization: Bearer`를 붙이며 cookie/CSRF/credentials/Vite proxy를 사용하지 않는다. 401·만료는 record를 지우고 landing으로 돌린다.
- 헤더와 모바일 drawer에는 남은 이용 시간이나 데모 종료 컨트롤을 노출하지 않는다. access 정리는 만료·401 같은 시스템 이벤트로만 수행한다.
- 데모 시작은 easy mode의 `/marketplace`를 기본으로 열며, access 보유 중에는 header(모바일은 drawer)의 `쉬운 사용`/`개발자 모드`
  토글이 선택을 보관한다. 개발자 전용 route는 access 뒤 developer로 열고, 쉬운 사용을 선택하면 Marketplace로 이동한다.
- revenue query는 OpenAPI flat `cursor`/`limit` type으로 재생성했다. 수동 `request[limit]` serialization은 제거했다.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` (Playwright desktop/mobile·130%·키보드)를 이 전환 뒤 통과해야 한다.
  Playwright는 local HTTP API fixture로 bodyless access exchange를 결정적으로 검증한다.

실제 local Spring/Go fixture 실행 `59b32eb0-43a8-47aa-9163-55d6e543a43a`는 `/runs/:id`에서 4/4 단계 완료와 root Markdown 결과를 표시했다. 결제 확인 중 또는 reconciliation 상태에서는
최종 결과 영역을 숨기고 상태 안내를 표시한다.

이번 UX 변경은 `npm run lint`, `npm run typecheck`, `npm test` (34 files, 123 tests), `npm run build`, local fixture Playwright (42 tests, 1440/390/320px)와
전용 PostgreSQL + local x402 공급자 Spring browser gate를 실행했다. Spring `test`와 `integrationTest`도 통과했으며, 후자는 HTTP E2E 68개(그중 `PostgresMarketplaceHttpE2eIntegrationTest` 26개)를 실행했다. browser gate는 public browse → bodyless access → quote 승인 → 한 번의 execution → SSE → persisted result를 검증하고 Vite·provider를 `finally`에서 종료한다. 이후 fresh read-only verifier는 현재 diff·매트릭스·테스트 매핑을 독립 검토해 CAPTCHA/cookie/CSRF/proxy 재도입, mock framework 사용, generated client 수동 수정, access·quote·SSE·reconciliation·UNKNOWN 경계의 차단 결함이 없음을 확인하고 `PASS`를 기록했다.

## 현재 상태와 다음 순서

BE Flyway history checksum mismatch는 schema/data 변경 없이 Flyway `repair`로 해소됐고, Spring이 생성한 OpenAPI artifact에 `q`, `sort`, `dependencyCount`가 포함됨을 확인했다. `AGENTSTORE_OPENAPI=../agent-store-be/openapi/openapi.json npm run api:generate`로 client를 재생성했다.

`listMarketplaceAgents()`는 생성된 query type을 직접 사용해 `cursor`, `limit`, `q`, `sort`를 요청하며, Marketplace 카드는 API `dependencyCount`를 `의존성 수`로 표시한다. 카드는 ACTIVE Version의 기본 호출 가격을 표시하며, 중복되는 목록 내 `실행 준비` 링크는 제공하지 않는다. 의존성을 포함한 Maximum Cost는 상세 화면의 Quote 발급 뒤에 확정된다. 이번 응답 형식 계약 변경에 맞춰 생성 client를 다시 만들고 폼 payload, 실행 결과 renderer, Markdown sanitization, 과거 데이터 JSON fallback을 반영했다. npm audit의 기존 high 취약점 4건과 Vite chunk 경고는 기능 실패가 아니어서 별도 후속 작업으로 남긴다. BE V13 migration과 runtime output validator도 적용됐으며, 최신 최종 판정은 현재 작업의 fresh verifier 결과와 각 저장소 게이트를 기준으로 한다.

실행 상세는 SSE 이벤트 뒤 재조회된 execution snapshot을 실행 여정에 반영한다. 따라서 실행 도중 생성된 dependency step과 parent-child edge가 카드 흐름에 반영된다. terminal 상태, SSE cursor와 connection은 과거 snapshot으로 되돌리지 않으며, route execution ID가 바뀌면 이전 stream을 abort하고 늦게 도착한 이벤트를 무시한다.

## 주의사항

- `AGENTS.md`, `AI.md`, `CLAUDE.md`, `README.md`, `scripts/`, `skills/`에는 기존 하네스 문서 변경이 있을 수 있다. 작업 시작 시 dirty path를 기록하고 관련 없는 변경은 보존한다.
- DB, OpenAPI, SSE, 결제와 async lifecycle은 `HIGH_RISK`다. `AI.md`의 failure matrix와 developer → fresh verifier 절차를 지킨다.
- UI에서 가짜 client-side 검색·정렬, 가짜 health 상태, 가짜 실행 이력을 만들지 않는다. E2E의 fixture Agent/API는 실제 production 경로를 검증하기 위한 명시적 local HTTP fixture다.
- 일반 UI는 밝은 neutral + cobalt, 한국어 중심, 8px spacing grid를 유지한다. 불필요한 gradient, 장식 이미지, 중첩 card를 추가하지 않는다.

## 검증 명령

```powershell
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

최신 fresh verifier는 BE/FE/Go 변경과 local HTTP fixture 기반 브라우저 흐름을 재검증해야 한다.

### Vercel GitHub 배포 구성 — 2026-09-06

- 위험도는 `STANDARD`다. Spring API·OpenAPI·결제·SSE 계약은 변경하지 않고, Vite 배포 설정과
  production API 환경변수 검증만 추가한다.
- 개발자 소유 파일은 `vercel.json`, `vite.config.ts`, `src/shared/api/generatedClient.ts`,
  `README.md`, 이 인수인계서다. 기존 dirty path인 `src/app/router.test.tsx`,
  `src/app/router.tsx`, `src/app/styles/developer.css`, `src/app/styles/foundation.css`,
  삭제 상태의 `src/features/system/ConnectionStatus.test.tsx`,
  `src/features/system/ConnectionStatus.tsx`, `src/pages/SettingsPage.test.tsx`,
  `src/pages/SettingsPage.tsx`는 보존한다.
- Vercel은 저장소 루트에서 `npm ci` → `npm run build`를 실행하고 `dist`를 배포한다.
  `vercel.json`은 BrowserRouter의 `/marketplace`, `/agents/:code`, `/runs/:id` 직접 접근을
  `/index.html`로 rewrite한다. API proxy는 사용하지 않는다.
- `VITE_API_BASE_URL`은 production build에서 필수이며 개발 모드의 localhost 기본값은 유지한다.
  생성 OpenAPI client와 backend 계약 변경은 없다. `generatedClient.ts`는 공통
  `API_BASE_URL`만 사용해 URL fallback을 중복 소유하지 않는다.
- Vercel Production/Preview 환경에 public HTTPS Spring API 주소를 등록하고, 첫 Production
  배포 후 확인한 Vercel origin을 backend `application-prod.yaml`의
  `agent-store.cors-origins` 목록에 정확히 등록한다. Preview origin은 실제 사용 시에만
  같은 목록에 추가한다.
- 이번 검증은 `npm run lint`, `npm run typecheck`, `npm test`(32 files, 121 tests),
  `npm run build`(API URL 주입), API URL 없는 production build의 의도된 실패,
  `git diff --check`를 통과했다. `npm run test:e2e`는 기존 사용자 Vite 프로세스가
  `127.0.0.1:4173`을 점유해 시작되지 않았으며 해당 프로세스는 건드리지 않았다.
- 실제 Vercel 계정 Import/Production 배포와 배포 후 CORS 확인은 외부 계정과 실제 API·Vercel
  도메인이 필요하므로 아직 실행하지 않았다.

### 랜딩 문구·상세 가격 정보 정리 — 2026-09-06

- 위험도는 `STANDARD`다. 인증·quote·실행·결제 API와 lifecycle은 변경하지 않고 화면 문구와 정보 배치만 바꿨다.
- 랜딩 Hero는 `서비스는 AI가 고르는데, 결제는 왜 아직 사람이 해야 할까요?`로 교체했다.
- 개발자 Agent 상세의 중복 `실행 준비` 링크와 우측 가격 카드를 제거하고, 설명 아래 기본 호출 비용·근사 원화·활성 Version/네트워크를 배치했다. Version 행에는 가격을 반복하지 않는다.
- `formatApproximateKrw`는 결제에 사용하지 않는 표시 전용 값이며 `BigInt`와 `1 USDC ≈ 1,400원` 참고값만 사용한다. API/OpenAPI/generated client/DB 계약 변경은 없다.
- 회귀 매핑: `src/entities/agent/model.test.ts`의 atomic→원화 경계, `src/pages/RegistryPages.test.tsx`의 상세 정보·중복 액션 제거, `e2e/public-browser.spec.ts`의 desktop/mobile/narrow 상세 화면 검증.
- 검증 결과: `npm run lint`, `npm run typecheck`, `npm test`(34 files, 124 tests), `npm run build`, `npm run test:e2e`(48 tests), `git diff --check` 통과. Playwright 결과 폴더는 생성 artifact로 커밋하지 않는다.
