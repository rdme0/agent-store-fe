# AgentStore FE 인수인계서

최종 갱신: 2026-08-27

## AgentCode/OpenAPI HIGH_RISK failure matrix

| ID | 실패 경계·불변식 | 회귀 검증 |
|---|---|---|
| AC-FE-01 | generated client, adapter, form payload와 public JSON은 `slug`가 아닌 `code`/`agentCode`/`targetAgentCode` 계약만 사용한다. | `entities/agent/api.test.ts`, `entities/dependency/api.test.ts`, `npm run api:generate` 후 `rg` 계약 검사 |
| AC-FE-02 | `/agents/:code` route identity가 바뀌어도 이전 요청·lazy page 응답이 새 Agent 화면을 덮어쓰지 않는다. | `pages/RegistryPages.test.tsx`의 `keeps the next code page visible when the previous route request resolves late` deferred-route test |
| AC-FE-03 | Quote 발급·새 Version 전환·route unmount 중에는 owner/generation lock을 유지하고 stale quote가 새 Version에 적용되지 않는다. | `features/dependencies/QuotePanel.test.tsx` request owner, reset, unmount cases |
| AC-FE-06 | 새 Dependency와 Version별 Quote는 Python식 comparator를 전송하며 `^` 문법을 새로 만들지 않는다. | `features/dependencies/DependencyEditor.test.tsx`, `features/dependencies/QuotePanel.test.tsx` |
| AC-FE-04 | execution snapshot의 Root·dependency·provider candidate `agentCode`를 새로고침/SSE refetch 뒤에도 표시하며 stale replay가 되돌리지 않는다. | `pages/ExecutionPage.test.tsx`, `features/execution/ExecutionJourney.test.tsx`, `features/execution/useExecutionEvents.test.ts` |
| AC-FE-05 | atomic payment 값은 string으로 유지하고 code 전환이 금액·결제 UI 계산을 바꾸지 않는다. | `entities/agent/model.test.ts`, `features/execution/paymentPresentation.test.ts` |

## Function Contract Marketplace

- 개발자 navigation에 Function Contract 화면과 Agent Manifest import 화면을 추가했다. 계약 생성 시 input/output JSON Schema 문법을 먼저 검사하고 계약·ACTIVE 공급자를 조회하며, manifest는 현재 YAML 내용 검증 성공 후에만 import한다.
- Agent와 Version 등록에서 function contract를 선택할 수 있으며 선택한 계약의 response format을 그대로 사용한다.
- DRAFT dependency는 `pinned`·`allowlist`·`marketplace` 공급자 범위와 `lowest_price`·`latest_version`·`highest_reliability`·`fastest` 선택 전략을 지원한다.
- 개발자 Quote는 후보 상태, 관측 수·신뢰도·p95, 선택된 공급자·Version·가격·payTo를 보여주며 Execution API의 `quoteSnapshot`으로 새로고침 뒤에도 graph label을 복원한다.
- 쉬운 사용 모드는 function contract, Schema, 후보 정책과 wallet을 노출하지 않는다.

## 저장소와 역할

- 경로: `C:\work\project\agent-store-fe`
- 스택: React 19, Vite, TypeScript, React Router, TanStack Query
- API 계약 원본: `C:\work\project\agent-store-be\openapi\openapi.json`
- 생성 client는 `src/generated/`이며 직접 수정하지 않는다. `npm run api:generate`만 사용한다.

## 현재 구현 상태

- 실행 상세은 쉬운 사용·개발자 모드 모두 Quote snapshot의 예정 graph와 실제 execution step/SSE refetch를 합친 세로 카드 여정을 먼저 보여준다. 예정·준비·확인·완료·실패·결제 확인·미사용 상태를 구분하고 반복 호출은 횟수와 atomic 비용을 한 카드에 합친다.
- 완료 뒤 쉬운 사용 모드는 최종 답변 다음에 여정을 펼쳐 두며 기술 증거를 숨긴다. 개발자 모드는 Version·호출·결제 상태를 카드에 표시하고 기존 graph·provider proof·payment hash는 접힌 `거래 상세 보기`에 둔다.
- 현재 분석 경로의 root와 활성 하위 카드만 전용 progress ring을 움직이고, 준비 중인 sibling은 정적인 대기 상태로 둔다. 연결선은 관계만 표현하는 정적 요소다. 모션은 terminal·비가시 탭·reduced-motion에서 정지하며 700px 이하에서는 기술 graph를 렌더링하지 않고 세로 여정만 유지한다.
- SSE replay는 cursor/dedupe와 current execution query refetch만 담당한다. 화면은 영속된 `ExecutionDto + quoteSnapshot`을 유일한 상태 원본으로 사용한다.

- 밝은 상단 헤더와 모바일 접근성 drawer를 사용한다. `/`는 Marketplace이며 `/agents`는 `/`로 redirect한다.
- Marketplace는 검색, 정렬, cursor 기반 `더 보기`, loading/empty/error 상태를 갖는다.
- Agent 등록은 기본 정보·endpoint/Version·결제 정보 세 구역으로 나뉘며, 사람이 읽는 USDC 입력을 atomic 값으로 변환한다.
- Agent 상세의 Publish/Disable은 확인 dialog, query invalidation, 중복 action 차단을 갖는다.
- 실행 화면은 SSE 상태와 결제·복구 안내를 표시하며, 개발자 대시보드는 수익 table 중심이다.
- Agent 등록과 새 Version 생성에서 응답 형식(TEXT, MARKDOWN, STRUCTURED, JSON)을 선택하며 기본값은 JSON이다. Version 상세에도 선택값을 표시한다.
- 실행 결과는 step의 `responseFormat`으로 렌더링한다. Markdown은 `react-markdown`/GFM/rehype-sanitize를 사용하고, STRUCTURED만 제목·요약·섹션 카드로 해석하며 나머지 JSON은 generic viewer로 표시한다.
- public JSON 응답은 Spring `CommonResponse<T>` envelope을 entity adapter에서 unwrap한다.

## 현재 상태와 다음 순서

BE Flyway history checksum mismatch는 schema/data 변경 없이 Flyway `repair`로 해소됐고, Spring이 생성한 OpenAPI artifact에 `q`, `sort`, `dependencyCount`가 포함됨을 확인했다. `AGENTSTORE_OPENAPI=C:\work\project\agent-store-be\openapi\openapi.json npm run api:generate`로 client를 재생성했다.

`listMarketplaceAgents()`는 생성된 query type을 직접 사용해 `cursor`, `limit`, `q`, `sort`를 요청하며, Marketplace 카드는 API `dependencyCount`를 `의존성 수`로 표시한다. 카드는 ACTIVE Version의 기본 호출 가격을 표시하며, 중복되는 목록 내 `실행 준비` 링크는 제공하지 않는다. 의존성을 포함한 Maximum Cost는 상세 화면의 Quote 발급 뒤에 확정된다. 이번 응답 형식 계약 변경에 맞춰 생성 client를 다시 만들고 폼 payload, 실행 결과 renderer, Markdown sanitization, 과거 데이터 JSON fallback을 반영했다. 2026-08-27 `npm ci`, lint, typecheck, 전체 test(26개 파일·96개), build를 다시 통과했다. npm audit의 기존 high 취약점 4건과 Vite chunk 경고는 기능 실패가 아니어서 별도 후속 작업으로 남긴다. BE V13 migration과 runtime output validator도 적용됐으며, fresh read-only verifier는 PASS로 확인됐다.

실행 상세는 SSE 이벤트 뒤 재조회된 execution snapshot을 실행 여정에 반영한다. 따라서 실행 도중 생성된 dependency step과 parent-child edge가 카드 흐름에 반영된다. terminal 상태, SSE cursor와 connection은 과거 snapshot으로 되돌리지 않으며, route execution ID가 바뀌면 이전 stream을 abort하고 늦게 도착한 이벤트를 무시한다.

## 주의사항

- `AGENTS.md`, `AI.md`, `CLAUDE.md`, `README.md`, `scripts/`, `skills/`에는 기존 하네스 문서 변경이 있을 수 있다. 작업 시작 시 dirty path를 기록하고 관련 없는 변경은 보존한다.
- DB, OpenAPI, SSE, 결제와 async lifecycle은 `HIGH_RISK`다. `AI.md`의 failure matrix와 developer → fresh verifier 절차를 지킨다.
- UI에서 가짜 client-side 검색·정렬, 가짜 health 상태, 가짜 실행 이력을 만들지 않는다.
- 일반 UI는 밝은 neutral + cobalt, 한국어 중심, 8px spacing grid를 유지한다. 불필요한 gradient, 장식 이미지, 중첩 card를 추가하지 않는다.

## 검증 명령

```powershell
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```
