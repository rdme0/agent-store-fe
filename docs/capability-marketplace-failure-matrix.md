# Capability Marketplace FE Failure Matrix

위험도: `HIGH_RISK` — 접근 발급, quote 승인, 실행 조회/SSE, 등록 submit lifecycle. 공개 API/DB 계약 변경 없음.

## 2026-09-05 심사위원 UX 승인 범위

| ID | 동작/소유권과 복구 | 구현 후 실행할 검증 |
|---|---|---|
| AC-FE-07 | 신규 데모는 easy이고 유효 access의 모드 선택을 유지한다. landing/quote 발급은 동기 lock + abort + access generation으로 소유하며 종료 뒤 늦은 발급을 폐기한다. | `LandingPage.test.tsx`, `QuotePanel.test.tsx`, `public-browser.spec.ts` |
| AC-FE-08 | Marketplace/detail은 공개 조회이고 private route는 access 뒤 원래 목적지로 복귀한다. expiry/401 이유를 전달하며 mutation을 자동 재전송하지 않는다. | `router.test.tsx`, `demoAccess.test.tsx`, `generatedClient.integration.test.ts`, `public-browser.spec.ts` |
| AC-FE-09 | 검색/정렬 URL + query cache, 목록 스크롤 복귀; 빈 공개 목록/검색 없음/네트워크 오류를 구분하고 표시 개수만 제공한다. | `RegistryPages.test.tsx`, `public-browser.spec.ts` |
| AC-FE-10 | easy는 질문→비용→승인 순서이고 graph는 상세를 열 때만 lazy load한다. 기술 정보는 접힌 developer 상세에만 둔다. | `QuotePanel.test.tsx`, `ExecutionPage.test.tsx`, `public-browser.spec.ts` |
| AC-FE-11 | quote generation/동기 lock/AbortSignal; 재발급은 승인을 초기화하고 만료 뒤 질문은 보존한다. 실행은 중복 생성하지 않는다. | `QuotePanel.test.tsx`, `public-browser.spec.ts`, Spring browser gate |
| AC-FE-12 | execution ID query + SSE owner, refresh coalesce; unknown 우선, 정산 확인 비용/부분 결과/null 복구와 늦은 route 응답 무시를 보장한다. | `ExecutionPage.test.tsx`, `useExecutionEvents.test.ts`, `public-browser.spec.ts`, Spring browser gate |
| AC-FE-13 | 등록 단계별 local state, 최종 submit lock + unmount owner; dashboard section query와 DRAFT publish/ACTIVE Marketplace 갱신을 보장한다. | `AgentForm.test.tsx`, `RegistryPages.test.tsx`, `DeveloperDashboardPage.test.tsx`, `public-browser.spec.ts` |

실제 Spring 통합 브라우저 gate는 전용 PostgreSQL/local 공급자만 사용한다. 화면 fixture E2E와 구분해 결과를 기록한다. 2026-09-05에 `PostgresMarketplaceHttpE2eIntegrationTest` 전용 gate를 `RUN_POSTGRES_INTEGRATION_TESTS=true`, `RUN_SPRING_BROWSER_E2E=true`로 실행해 26개 HTTP E2E와 브라우저 happy path를 통과했다. 이 gate는 public browse → bodyless access → quote 승인 → 단일 execution → SSE → persisted result를 실제 Spring·PostgreSQL·local x402 provider로 확인하며, testnet 결제 증거는 아니다.

| ID | 사용자 동작/경합 | request owner | 기대 UI | 복구/테스트 |
|---|---|---|---|---|
| FE-01 | capability 생성 버튼 연속 입력 | form mutex | 요청 1회, 성공 후 목록 invalidate | deferred mutation 테스트 |
| FE-02 | capability 목록 요청 뒤 route/mode 변경 | TanStack query key | 이전 응답이 다른 화면을 덮지 않음 | route 전환 테스트 |
| FE-03 | direct/capability target 전환 | dependency form | 숨긴 target 값을 payload에 포함하지 않음 | form payload 테스트 |
| FE-04 | capability target인데 policy 누락 | dependency form | client-side 거절, 요청 없음 | validation 테스트 |
| FE-05 | quote 요청·재확인 중 질문/Version identity 변경 | quote generation + synchronous request lock | 현재 identity의 유효 quote가 도착하면 실행 가능, 진행 중에는 이유를 표시하고 늦은 quote는 무시 | `QuotePanel.test.tsx` deferred identity·easy quote settle/recheck 테스트 |
| FE-06 | execution 생성 중 중복 submit | execution lock token | 실행 1개만 생성 | 기존 same-tick 테스트 확장 |
| FE-07 | execution 페이지 새로고침 | execution query | 응답의 quoteSnapshot으로 graph·선택 이유 복원 | page test |
| FE-08 | SSE snapshot/replay가 HTTP snapshot보다 오래됨 | execution lifecycle owner | terminal/payment 상태 역행 없음 | 기존 reducer/reconnect 테스트 |
| FE-09 | easy mode로 전환 | display mode | 후보·Schema·wallet·hash 미노출 | easy rendering 테스트 |
| FE-10 | 390px 화면 | page layout | 페이지 가로 overflow 없음 | narrow viewport 구조 테스트 |
| FE-11 | dependency create/update/delete 연속 입력 | dependency form mutex | 같은 tick의 mutation 1회만 전송 | same-tick form submit 테스트 |
| FE-12 | capability 계약 조회 실패 | capability query | 빈 목록으로 위장하지 않고 오류와 재시도 표시 | reject 후 retry 테스트 |

Generated client는 Spring OpenAPI 검증 뒤에만 재생성하며 직접 수정하지 않는다.

## Row-to-test mapping

| Matrix row | 실행되는 테스트 |
|---|---|
| FE-01 | `CapabilitiesPage.test.tsx` — same-tick 생성 submit을 동기 mutex로 1회 coalesce |
| FE-02 | `RegistryPages.test.tsx` — 선택된 display mode를 query identity에 전달 |
| FE-03·04 | `DependencyEditor.test.tsx` — target 전환 payload와 capability policy 필수 검증 |
| FE-05·06 | `QuotePanel.test.tsx` — deferred quote identity, easy mode 유효 quote 활성화·재확인 상태, same-tick execution lock |
| FE-07 | `ExecutionPage.test.tsx` — GET의 `quoteSnapshot`만으로 고정 graph·후보·선택 이유 복원 |
| FE-08 | `reducer.test.ts`, `useExecutionEvents.test.ts` — terminal/payment 상태 역행 방지 |
| FE-09 | `ExecutionPage.test.tsx` — easy mode에서 공급자·wallet·transaction proof 미노출 |
| FE-10 | `DependencyGraph.test.tsx`의 graph 자체 영역 구조와 390px 수동 viewport 회귀 점검 |
| FE-11 | `DependencyEditor.test.tsx` — React pending render 전 same-tick 생성 submit을 동기 mutex로 1회 coalesce |
| FE-12 | `DependencyEditor.test.tsx` — capability 조회 실패를 오류로 표시하고 명시적 재시도 후 복구 |
| AC-FE-07 | `LandingPage.test.tsx`, `QuotePanel.test.tsx`, Playwright desktop/mobile/narrow access exchange |
| AC-FE-08 | `router.test.tsx`, `demoAccess.test.tsx`, generated-client HTTP test, Playwright private route/401 return |
| AC-FE-09 | `RegistryPages.test.tsx`, Playwright populated/empty/error/search-sort return |
| AC-FE-10 | `QuotePanel.test.tsx`, `ExecutionPage.test.tsx`, Playwright easy summary and lazy-detail checks |
| AC-FE-11 | `QuotePanel.test.tsx`, Playwright explicit approval/expiry/reconciliation path, Spring browser gate |
| AC-FE-12 | `ExecutionPage.test.tsx`, `useExecutionEvents.test.ts`, Playwright partial/null/reconciliation and Spring SSE gate |
| AC-FE-13 | `AgentForm.test.tsx`, `RegistryPages.test.tsx`, `DeveloperDashboardPage.test.tsx`, Playwright mobile/keyboard/130% |

2차 fresh verifier가 지적한 capability 생성 동기 mutex와 execution snapshot 증거 복원을 각각 FE-01·FE-07 회귀 테스트로 고정했다.
최종 fresh verifier가 지적한 dependency editor lifecycle을 family 단위로 감사해 조회 실패 fail-closed, target 유형별 가용성, create/update/delete 동기 mutex를 적용했다.
# Demo access failure matrix

| ID | Boundary and invariant | Regression coverage |
| --- | --- | --- |
| DA-BE-01 | Bodyless `POST /api/demo/access` issues a 6-hour Bearer capability signed with the shared domain-separated HMAC boundary. | PostgreSQL HTTP E2E issues the token through the real Spring controller and verifies expiry. |
| DA-BE-02 | Missing, malformed, tampered, and expired demo Bearer tokens never create a developer principal; valid demo Bearer tokens do not authenticate callback or external receipt paths. | Security HTTP E2E: 401 envelope/trace for each invalid token; callback and `/v1` retain their native credential requirements. |
| DA-BE-03 | Access issuance keeps the existing CommonResponse envelope and never exposes the signing secret or token internals in logs. | Controller/service and bearer authentication tests; bodyless HTTP request. |
| DA-BE-04 | A valid Bearer token authorizes only the shared demo developer's owned resources; foreign Agent, Version, manifest and revenue requests remain rejected. | PostgreSQL HTTP E2E creates a foreign developer fixture and verifies ownership rejection. |
| DA-FE-01 | Landing access is explicit: no route or display-mode transition issues a token. One click issues a bodyless access request once, stores the token plus expiry, routes to the target, and exposes retry after failure. | `LandingPage.test.tsx` and `generatedClient.integration.test.ts` verify the bodyless request; Playwright `public-browser.spec.ts` runs the local API exchange on desktop/mobile. |
| DA-FE-02 | Expiry, 401, and explicit demo exit clear stored access and return the user to the landing CTA; a stale completion cannot restore a cleared token. | `src/shared/auth/demoAccess.test.tsx` covers expiry cleanup, automatic developer-mode exit, and explicit exit event; generated-client integration covers 401 cleanup. |
| DA-FE-03 | Each generated or handwritten API call carries the current Bearer token only; no cookie, CSRF header, `credentials: include`, or Vite proxy participates. | `src/shared/api/generatedClient.integration.test.ts` and Playwright local fixture inspect the browser Bearer request path. |
| DA-FE-04 | Display mode is a local presentation state owned only by `DisplayModeContext`: demo issuance defaults to easy, common routes preserve their URL when toggled, and developer-only routes switch to developer after access or return to Marketplace before easy mode is applied. | Router unit tests cover desktop/mobile toggle accessibility and route transitions; Playwright verifies both shells. |
