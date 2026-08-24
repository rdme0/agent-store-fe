# Capability Marketplace FE Failure Matrix

위험도: `HIGH_RISK` — OpenAPI, quote identity와 execution snapshot 표시가 변경된다.

| ID | 사용자 동작/경합 | request owner | 기대 UI | 복구/테스트 |
|---|---|---|---|---|
| FE-01 | capability 생성 버튼 연속 입력 | form mutex | 요청 1회, 성공 후 목록 invalidate | deferred mutation 테스트 |
| FE-02 | capability 목록 요청 뒤 route/mode 변경 | TanStack query key | 이전 응답이 다른 화면을 덮지 않음 | route 전환 테스트 |
| FE-03 | direct/capability target 전환 | dependency form | 숨긴 target 값을 payload에 포함하지 않음 | form payload 테스트 |
| FE-04 | capability target인데 policy 누락 | dependency form | client-side 거절, 요청 없음 | validation 테스트 |
| FE-05 | quote 요청 중 질문/Version identity 변경 | quote generation token | 늦은 quote 무시 | 기존 deferred quote 테스트 확장 |
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
| FE-05·06 | `QuotePanel.test.tsx` — deferred quote identity와 same-tick execution lock |
| FE-07 | `ExecutionPage.test.tsx` — GET의 `quoteSnapshot`만으로 고정 graph·후보·선택 이유 복원 |
| FE-08 | `reducer.test.ts`, `useExecutionEvents.test.ts` — terminal/payment 상태 역행 방지 |
| FE-09 | `ExecutionPage.test.tsx` — easy mode에서 공급자·wallet·transaction proof 미노출 |
| FE-10 | `DependencyGraph.test.tsx`의 graph 자체 영역 구조와 390px 수동 viewport 회귀 점검 |
| FE-11 | `DependencyEditor.test.tsx` — React pending render 전 same-tick 생성 submit을 동기 mutex로 1회 coalesce |
| FE-12 | `DependencyEditor.test.tsx` — capability 조회 실패를 오류로 표시하고 명시적 재시도 후 복구 |

2차 fresh verifier가 지적한 capability 생성 동기 mutex와 execution snapshot 증거 복원을 각각 FE-01·FE-07 회귀 테스트로 고정했다.
최종 fresh verifier가 지적한 dependency editor lifecycle을 family 단위로 감사해 조회 실패 fail-closed, target 유형별 가용성, create/update/delete 동기 mutex를 적용했다.
