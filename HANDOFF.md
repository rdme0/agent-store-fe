# AgentStore FE 인수인계서

최종 갱신: 2026-08-21

## 저장소와 역할

- 경로: `C:\Users\we6610\WebstormProjects\agent-store-fe`
- 스택: React 19, Vite, TypeScript, React Router, TanStack Query
- API 계약 원본: `C:\Users\we6610\IdeaProjects\agent-store-be\openapi\openapi.json`
- 생성 client는 `src/generated/`이며 직접 수정하지 않는다. `npm run api:generate`만 사용한다.

## 현재 구현 상태

- 밝은 상단 헤더와 모바일 접근성 drawer를 사용한다. `/`는 Marketplace이며 `/agents`는 `/`로 redirect한다.
- Marketplace는 검색, 정렬, cursor 기반 `더 보기`, loading/empty/error 상태를 갖는다.
- Agent 등록은 기본 정보·endpoint/Version·결제 정보 세 구역으로 나뉘며, 사람이 읽는 USDC 입력을 atomic 값으로 변환한다.
- Agent 상세의 Publish/Disable은 확인 dialog, query invalidation, 중복 action 차단을 갖는다.
- 실행 화면은 SSE 상태와 결제·복구 안내를 표시하며, 개발자 대시보드는 수익 table 중심이다.
- Agent 등록과 새 Version 생성에서 응답 형식(TEXT, MARKDOWN, STRUCTURED, JSON)을 선택하며 기본값은 JSON이다. Version 상세에도 선택값을 표시한다.
- 실행 결과는 step의 `responseFormat`으로 렌더링한다. Markdown은 `react-markdown`/GFM/rehype-sanitize를 사용하고, STRUCTURED만 제목·요약·섹션 카드로 해석하며 나머지 JSON은 generic viewer로 표시한다.
- public JSON 응답은 Spring `CommonResponse<T>` envelope을 entity adapter에서 unwrap한다.

## 현재 상태와 다음 순서

BE Flyway history checksum mismatch는 schema/data 변경 없이 Flyway `repair`로 해소됐고, Spring이 생성한 OpenAPI artifact에 `q`, `sort`, `dependencyCount`가 포함됨을 확인했다. `AGENTSTORE_OPENAPI=C:\Users\we6610\IdeaProjects\agent-store-be\openapi\openapi.json npm run api:generate`로 client를 재생성했다.

`listMarketplaceAgents()`는 생성된 query type을 직접 사용해 `cursor`, `limit`, `q`, `sort`를 요청하며, Marketplace 카드는 API `dependencyCount`를 `Version 수`로 표시한다. 이번 응답 형식 계약 변경에 맞춰 생성 client를 다시 만들고 폼 payload, 실행 결과 renderer, Markdown sanitization, 과거 데이터 JSON fallback을 반영했다. adapter·화면 테스트, lint, typecheck, 전체 test, build, diff check는 통과했다. BE V13 migration과 runtime output validator도 적용됐으며, fresh read-only verifier는 PASS로 확인됐다.

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
