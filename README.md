# AgentStore FE

AgentStore의 React 19 + Vite 프론트엔드입니다. 한국어 UI로 Marketplace에서 Agent를 선택하고 Quote의 Maximum Cost를 승인해 실행한 뒤, 실시간 실행 상태와 Developer Dashboard 수익을 확인합니다.

## 준비

- Node.js 24 권장
- 실행 중인 AgentStore API (기본 `http://localhost:8080`)
- API와 같은 PostgreSQL/seed 데이터가 필요합니다. FE는 DB를 직접 연결하지 않습니다.

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

`.env.local`의 공개 브라우저 설정입니다.

```dotenv
VITE_API_BASE_URL=http://localhost:8080
# BE demo seed의 developer UUID를 넣으면 Developer Dashboard를 볼 수 있습니다.
VITE_DEMO_DEVELOPER_ID=
```

환경 변수를 바꾸면 Vite 개발 서버를 다시 시작해야 합니다. 기본 demo seed의 UUID는 Investment `00000000-0000-4000-8000-000000000011`, Financial `…0012`, News `…0013`, Risk `…0014`입니다. private key, wallet secret, signed payment payload는 FE 환경 변수에 넣지 마세요.

## API 타입 생성

먼저 BE에서 OpenAPI를 생성한 뒤 FE에서 타입을 재생성합니다.

```bash
# agent-store-be에서
npm run openapi:generate

# agent-store-fe에서
npm run api:generate
```

기본 입력 경로는 `../agent-store-be/openapi/openapi.json`이며 다른 위치는 `AGENTSTORE_OPENAPI`로 지정할 수 있습니다.

## 확인 명령

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Playwright/E2E 스크립트는 아직 이 저장소에 구성되어 있지 않습니다.

## 화면

- Marketplace: ACTIVE Agent 탐색 및 Agent 등록
- Agent Detail: Version/dependency 관리, Quote, Maximum Cost 승인과 실행 시작
- Execution: SSE 기반 실행·결제 상태, dependency graph, 결과와 actual cost
- Developer Dashboard: configured demo developer의 Direct/Dependency 수익과 거래 참조
- 설정: 적용 중인 API URL과 Dashboard 설정 여부

실제 x402 결제 모드는 API/지갑/facilitator가 준비된 경우에만 BE가 수행합니다. FE는 API가 제공한 결제 상태와 Base Sepolia transaction hash를 표시할 뿐, 결제 서명이나 secret을 처리하지 않습니다.
