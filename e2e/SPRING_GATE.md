# Actual Spring browser gate

This is separate from `npm run test:e2e`, which uses the local API fixture.
Run from the backend repository with the dedicated PostgreSQL database available:

```powershell
$env:RUN_POSTGRES_INTEGRATION_TESTS='true'
$env:SPRING_EXCLUSIVE_MAINTENANCE='true'
$env:RUN_SPRING_BROWSER_E2E='true'
$env:INTEGRATION_DATASOURCE_URL='jdbc:postgresql://localhost:5432/agent_store_integration?currentSchema=public'
$env:INTEGRATION_DATASOURCE_PASSWORD='<integration database password>'
.\gradlew.bat integrationTest --tests '*PostgresMarketplaceHttpE2eIntegrationTest.browser*' --no-daemon
```

Prerequisites: sibling `../agent-store-fe` checkout, installed npm dependencies and Playwright Chromium, Node on PATH.
The JUnit test rejects any database other than `agent_store_integration`, starts real Spring on a random port,
creates only tracked PostgreSQL fixtures and starts a local HTTP x402 provider. No OpenAI, facilitator, or
blockchain is contacted. The provider is an explicit deterministic test fixture, not a production payment mode.

The Node runner starts Vite on a random localhost port with the actual Spring API URL (no proxy), then checks:
public Marketplace without token issuance → question → bodyless access → quote approval → one execution →
SSE request → persisted result. Spring verifies one completed database execution and one signed provider call.
Browser, Vite and provider servers close in `finally`; Spring closes with the Gradle test worker. Only rows
belonging to the test's tracked Agent/Version, quotes and executions are cleaned up.

Coverage: AC-FE-07/08/09/10/13 integration happy-path transport evidence. Failure-scenario breadth remains in
the separate local API fixture suite and backend HTTP/PostgreSQL tests; this test is not evidence of testnet spending.
Screenshot: `test-results/spring-browser-completed.png`.
