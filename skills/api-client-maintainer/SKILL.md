---
name: api-client-maintainer
description: Maintain the generated AgentStore frontend API client and keep FE request, response, error, and SSE types aligned with the backend OpenAPI contract.
---

# API Client Maintainer

Use this skill whenever a backend HTTP contract, DTO, error code, execution event, or SSE payload changes.

## Contract workflow

1. Treat the backend OpenAPI document as the source of truth.
2. Verify the backend route schema and generated `/openapi.json` before changing FE usage.
3. Regenerate FE types and client code through the repository script; never edit generated files manually.
4. Update the smallest typed API adapter and feature mapping needed by the change.
5. Public JSON responses use `CommonResponse<T>`; adapters unwrap only `result`, while errors read `status`,
   `errorCode`, `message`, and the `X-Trace-Id` response header. Do not reintroduce nested `error.code` or JSON
   `traceId` assumptions.
6. Keep atomic USDC amounts as strings and preserve nullable/error fields from the contract.
7. For SSE, keep event names and payload discriminators typed and handle reconnect behavior explicitly.

## Checks

- Confirm generated output is reproducible.
- Search for stale endpoint names and manually duplicated response shapes.
- Run the FE typecheck/build and relevant feature tests.
- When the BE server is unavailable, report that generation was blocked instead of replacing the contract with guessed types.
