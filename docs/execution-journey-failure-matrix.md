# Execution Journey FE Failure Matrix

위험도: `HIGH_RISK` — OpenAPI snapshot, SSE replay와 실행 identity를 사용해 실시간 여정 상태를 표시한다.

## 불변식과 신뢰 경계

- 여정은 Quote snapshot의 예정 graph와 현재 execution step/SSE 상태만 사용한다. 타이머나 프론트 추측으로 상태를 진행시키지 않는다.
- execution ID와 generation의 소유권은 기존 `useExecutionEvents`가 유지한다. 여정 컴포넌트는 stream·refresh를 직접 시작하지 않는다.
- terminal execution은 과거 snapshot이나 replay로 진행 상태로 되돌아가지 않는다.
- atomic USDC는 문자열과 `BigInt`로만 합산하며 부동소수점 계산을 하지 않는다.
- 쉬운 사용 모드에는 endpoint, wallet, transaction hash, provider 후보와 내부 오류 코드를 표시하지 않는다.
- 결제 확인 불명은 완료나 일반 실패로 합치지 않는다.

## Failure matrix

| ID | 사용자 동작/경합 | request owner | 기대 UI | 금지 동작 | 검증 테스트 |
|---|---|---|---|---|---|
| JNY-01 | snapshot만 있고 step이 아직 없음 | execution query | 전체 트리를 `예정`으로 표시 | 임의 진행·완료 연출 | journey model 테스트 |
| JNY-02 | PAYMENT_REQUIRED/STEP_RUNNING SSE 수신 | existing SSE generation | 해당 실제 단계만 `준비 중`/`확인 중` 전환 | sibling 상태 추정 | journey model·page 테스트 |
| JNY-03 | 동일 dependency가 여러 번 호출됨 | persisted step/payment identity | 한 카드에 호출·완료 횟수와 `SETTLED` 비용을 정확히 합산 | 중복 카드·부동소수점 합산·미확정 비용의 사용 처리 | journey model 테스트 |
| JNY-04 | root terminal인데 예정 dependency step이 없음 | terminal execution snapshot | `이번 답변에는 사용되지 않았어요` 표시 | 완료로 가장 | journey model 테스트 |
| JNY-05 | 하위 실패 또는 root 실패 | terminal execution snapshot | 실패 단계와 상위 결과 상태를 분리 표시 | 성공 check·계속되는 모션 | journey model·page 테스트 |
| JNY-06 | PAYMENT_RECONCILIATION_REQUIRED | existing SSE generation | `결제 확인 중이라 결과를 확정하지 못했어요` 표시, 미확정 비용은 사용으로 표시하지 않음 | 성공/일반 실패·확정 비용으로 축약 | journey model·page 테스트 |
| JNY-07 | route execution ID 교체 뒤 이전 refresh 도착 | `useExecutionEvents` owner/generation | 새 실행 여정 유지 | 이전 실행이 현재 카드 덮어쓰기 | 기존 hook lifecycle 테스트 |
| JNY-08 | SSE replay 중복·terminal step 뒤 payment replay·늦은 refresh | reducer seen IDs/terminal state | 상태·호출 횟수 멱등 유지 | 중복 횟수·step 상태 역행 | reducer/hook 테스트 + journey model 테스트 |
| JNY-09 | 탭 비가시 또는 terminal 전환 | document visibility/current status | 현재 경로 progress ring 정지 | background/terminal animation | component 테스트 |
| JNY-09A | 여러 sibling이 준비 중 | snapshot tree와 실제 step 상태 | root부터 현재 단계까지의 경로만 회전하고 나머지 준비 단계는 정적으로 표시 | 모든 카드가 동시에 회전해 현재 단계를 구분하지 못함 | journey model·component 테스트 |
| JNY-10 | `prefers-reduced-motion` | media query hook·CSS | paused class와 CSS `animation:none`으로 journey 반복 animation을 제거하고 텍스트·색·아이콘 변경 | 무한 animation의 초고속 반복·필수 의미를 모션에만 의존 | component media-query assertion·수동 접근성 점검 |
| JNY-11 | easy/developer 모드 전환 | display mode context | 동일 여정, easy는 기술 증거 미노출, developer는 접힌 거래 상세 제공 | easy wallet/hash 노출 | page 테스트 |
| JNY-12 | 390px 모바일 | CSS layout | 세로 카드 여정, 페이지 가로 overflow 없음, 기술 그래프 미렌더링 | 페이지 수준 horizontal scroll | structure/CSS assertion·수동 viewport 점검 |
| JNY-13 | snapshot 설명 누락 | execution query | Agent 이름 기반 중립 설명 | UUID를 사용자 설명으로 노출 | journey model 테스트 |
| JNY-14 | 상태 변화 announcement | journey state signature | 단일 `aria-live=polite`에서 준비·진행·완료·실패·결제 확인의 실제 변화당 한 번 안내, focus 유지 | 이중 live region·render마다 반복 안내·focus 이동 | component rerender 테스트 |

## Row-to-test mapping

| Matrix row | 실행되는 테스트 |
|---|---|
| JNY-01·03·04·06·08·09A·13 | `ExecutionJourney.test.tsx`의 pure journey model 고정 vector와 current-path spinner assertion |
| JNY-02·05·11 | `ExecutionPage.test.tsx`의 easy/developer 실제 상태 렌더링 |
| JNY-07·08 | 기존 `useExecutionEvents.test.ts`, `reducer.test.ts`의 execution identity·replay·terminal 회귀 |
| JNY-09·14 | `ExecutionJourney.test.tsx`의 visibility·aria-live 상태 전환 |
| JNY-10 | `ExecutionJourney.test.tsx`의 reduced-motion media query → paused class 검증과 `index.css` 명시적 animation 제거 규칙 |
| JNY-12 | `ExecutionPage.test.tsx`의 mobile graph 미렌더링 구조와 390px 수동 viewport 점검 |
