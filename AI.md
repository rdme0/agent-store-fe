# AI.md

## 프로젝트

AgentStore의 React 19 + Vite + TypeScript 프론트엔드다. API 계약은 Spring BE의 `openapi/openapi.json`에서 생성하며 FE는 DB와 결제 secret을 직접 다루지 않는다.

## 작업 시작 인수인계

모든 작업 시작 전 루트의 [`HANDOFF.md`](./HANDOFF.md)를 읽는다. 이 문서는 현재 구현 상태, 선행 blocker, 저장소 경계와 다음 작업 순서를 기록한다. 문서 내용과 실제 `git status`가 다르면 `git status`와 코드를 우선하고, 인수인계서를 최신 상태로 갱신한다.

## Skills

- `agent-store-fe-maintainer`: React/Vite/TypeScript 구현 규칙 (`./skills/agent-store-fe-maintainer/SKILL.md`)
- `agent-store-fe-style-verifier`: production diff read-only 검증 (`./skills/agent-store-fe-style-verifier/SKILL.md`)
- `api-client-maintainer`: generated OpenAPI client와 FE 계약 유지 (`./skills/api-client-maintainer/SKILL.md`)
- `readme-maintainer`: 구현 범위와 실행 문서 유지 (`./skills/readme-maintainer/SKILL.md`)
- `git-commit-korean`: 작은 한국어 커밋 작성 (`./skills/git-commit-korean/SKILL.md`)

## 위험도 분류

coordinator는 작업 시작 전에 `STANDARD` 또는 `HIGH_RISK`를 선언한다.

`HIGH_RISK`는 중복 mutation, SSE 재연결, abort/unmount, route identity 변경, stale response, 결제·금액 상태, FE·BE 계약/OpenAPI 변경이다. 그 외 단순 CRUD, 문서, 스타일, 독립 조회는 `STANDARD`다.

고위험 변경은 구현 전에 FE failure matrix와 테스트 매핑을 작성한다. matrix는 사용자 동작, 동시 응답, request owner, unmount·identity 처리, UI 상태, 복구 경로, 검증 테스트를 포함하고 중복 submit/refresh 경합/pending retry/abort/늦은 응답/SSE replay·reconnect를 다룬다.

## Agent workflow

```text
coordinator
  ↓ 위험도·dirty path·계약 범위 기록
developer agent
  ↓ 구현·테스트·handoff
fresh read-only verifier
  ↓ 필요 시 invariant family 단위 refactor
fresh verifier 재검증
```

- 작업 시작 전에 기존 dirty path와 owned files를 기록한다.
- developer는 구현과 테스트를 담당하며 완료 선언을 하지 않는다.
- handoff에는 요구사항, 위험도와 근거, 변경 invariant, matrix/test mapping, 계약·generated diff, 명령과 결과, 남은 가정을 포함한다.
- verifier는 developer 결론이 아니라 요구사항·matrix·현재 diff를 독립 검토한다.
- verifier는 blocking finding을 invariant family별로 한 번에 보고한다.
- 같은 family의 blocker가 다시 나오면 해당 lifecycle과 인접 race를 함께 감사하고 matrix와 테스트를 갱신한다.
- 고정 cycle 제한은 없으며 fresh verifier가 blocking finding 0건이고 테스트가 통과할 때까지 반복한다.
- verifier는 production 파일을 수정하지 않는다. lint, typecheck, test, build, `git diff --check` 같은 read-only 검증만 실행한다.
- 파일·계약·invariant ownership이 모두 독립적일 때만 병렬화한다. schema, OpenAPI, runtime state를 공유하면 직렬화한다.

## API envelope

- Spring public JSON success and error responses use `CommonResponse<T>` (`isSuccess`, `message`, `errorCode`, `result`).
- Entity adapters unwrap `result`; `ApiRequestError` uses HTTP status, `errorCode`, `message`, and `X-Trace-Id`.
- JSON `traceId`, nested `error.code`, and `error.details` are not part of the new contract.

## FE 규칙

- `app`, `pages`, `features`, `entities`, `shared`, `generated` 경계를 유지한다.
- API 호출은 generated client와 entity API adapter를 사용하고 DTO와 UI model 변환은 경계에 둔다.
- money/payment 값은 atomic string으로 유지하며 JavaScript floating point 계산을 하지 않는다.
- loading, empty, error, retry, disabled 상태와 접근성을 구현한다.
- 고위험 async 작업은 동기 mutex/owner token, mount·identity·generation 검증, AbortSignal cleanup, replay terminal 판정을 사용한다.
- generated 파일은 직접 편집하지 않고 `npm run api:generate`로 재생성한다.

## 검증

```powershell
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```
