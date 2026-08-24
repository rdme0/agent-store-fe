# Manifest·공급자 선택 UI Failure Matrix

위험도: `HIGH_RISK`

## 불변식

- 생성된 OpenAPI client만 public HTTP 계약을 호출하며, 수동 DTO를 만들지 않는다.
- YAML 검증·import·DRAFT 교체 요청은 동일 form generation 안에서 한 번만 진행한다.
- validate/import 응답은 현재 편집 내용의 generation과 일치할 때만 화면에 반영한다.
- DRAFT 교체는 성공한 뒤 Agent, Version, dependency, quote query를 함께 무효화한다.
- 가격은 atomic string으로 유지하고 UI에서 부동소수점 산술을 하지 않는다.
- provider scope·전략·성능 지표는 개발자 화면에서만 표시하고 쉬운 사용 화면에는 노출하지 않는다.

| ID | 사용자 동작/실패 | 기대 UI 상태 | 금지 동작 | 테스트 |
|---|---|---|---|---|
| MAN-FE-01 | YAML 문법·계약 검증 실패 | 오류를 form에 표시, 기존 preview 유지 | 일부 import 성공처럼 표시 | `AgentManifestPage.test.tsx` validation failure |
| MAN-FE-02 | validate 완료 전 편집하거나 늦은 응답 도착 | 현재 generation의 결과만 표시 | 이전 YAML의 hash/preview 반영 | `AgentManifestPage.test.tsx` stale validation |
| MAN-FE-03 | import/replace 연속 클릭 | 한 mutation만 요청, 버튼 disabled | 중복 Agent/Dependency 생성 | `AgentManifestPage.test.tsx` duplicate submit |
| MAN-FE-04 | import/replace 성공 | form 결과와 성공 안내, 관련 query invalidate | 오래된 Agent/Version/graph 표시 | `AgentManifestPage.test.tsx` mutation invalidation |
| PRO-FE-01 | provider scope/strategy/지표가 있는 Quote | 선언 범위와 선택 이유를 개발자에게 표시 | 가격·성능을 임의 계산하거나 숨겨진 후보를 선택했다고 표시 | `ProviderSelectionProof.test.tsx` typed snapshot render |
| PRO-FE-02 | 쉬운 사용 모드 전환 | 기술적 provider 정보 비노출 | scope, wallet, strategy 노출 | `QuotePanel.test.tsx` easy mode |

## 테스트 매핑

- `AgentManifestPage.test.tsx`: MAN-FE-01~04
- `ProviderSelectionProof.test.tsx`, `QuotePanel.test.tsx`: PRO-FE-01~02
