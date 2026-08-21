---
name: agent-store-fe-maintainer
description: Maintain AgentStore React, Vite, and TypeScript frontend code. Use when adding or changing pages, features, entities, shared components, API integrations, state, accessibility, styling, or FE tests.
---

# AgentStore FE Maintainer

## Workflow

1. Inspect the current app structure, nearby components, package scripts, and the current diff before editing.
2. Preserve unrelated user changes and keep the implementation within the requested feature boundary.
3. Follow the coordinator's `STANDARD` or `HIGH_RISK` classification. Keep ordinary CRUD and presentation work lightweight; do not invent a failure matrix for `STANDARD` work.
4. Before implementing `HIGH_RISK` work, complete the FE failure matrix from `AI.md`, identify the request owner and lifecycle identity, and map every applicable row to a test. Return the matrix for coordinator approval before editing production code.
5. Use the existing project conventions. Introduce `app`, `pages`, `features`, `entities`, and `shared` boundaries only when the feature needs them; do not reorganize unrelated starter files.
6. Keep route components focused on composition, feature components focused on interaction, and API/data transformation at the API or entity boundary.
7. Use generated API types and the shared API client. Do not duplicate server contracts in component code.
8. Handle loading, empty, error, retry, and disabled states for network-backed UI.
9. Use semantic HTML, keyboard-accessible controls, visible focus states, and useful labels.
10. Keep money and payment values as strings or decimal-safe values; never calculate USDC with JavaScript floating-point numbers.

## High-risk async lifecycle rules

Apply these rules only when the classified risk is present.

- Do not rely only on render-lagging `isPending` or `isFetching` values to prevent same-tick duplicate work. Use a synchronous guard when duplicate entry can violate an invariant.
- Give each async lifecycle an explicit owner or generation token. Before applying completion, confirm the component is still mounted and the route/entity identity, lifecycle generation, and owner still match.
- Tie streams, reconnect delays, and requests to `AbortSignal` or an equivalent deterministic cleanup path. Unmount or identity replacement must immediately invalidate prior work.
- Serialize refresh, retry, and create/submit operations when they mutate or replace the same resource lifecycle.
- Define how terminal SSE state interacts with replay and reconnect so a stale stream cannot reopen or overwrite a completed lifecycle.
- After a blocking finding, audit the entire invariant family and adjacent races. Update the matrix and tests with the refactor; do not submit a line-only fix.

## File and component rules

- Keep components small and colocate feature-specific styles and tests where the nearby code does so.
- Do not introduce a global state library for state that belongs to one route or feature.
- Use TanStack Query for server state once it is installed; keep transient form state local.
- Do not hand-edit generated API files.
- Avoid barrel exports unless they remove a real import cycle or match an established local convention.

## Verification

Run the narrowest relevant checks first, then the full available checks:

```text
npm run lint
npm run build
npm test
```

If a script does not exist yet, report that fact rather than inventing a passing result. For UI changes, verify the primary flow at desktop and narrow viewport sizes when practical.

For high-risk async changes, add deterministic tests for applicable matrix rows. Prefer deferred promises for response ordering, fake timers for reconnect/retry delays, rerendering without a React `key` for route identity changes, and direct form submission for same-tick duplicate paths. Assert both the visible result and that obsolete requests, timers, or streams cannot mutate the current lifecycle.

The developer handoff must include all of the following for both `STANDARD` and `HIGH_RISK` work:

- the original requirement, risk class and reason, and changed invariants;
- developer-owned production files, pre-existing dirty paths, the exact diff, and design decisions;
- contract, schema, or generated-client changes, including an explicit `none` when unchanged;
- ordinary test mapping from changed public behavior to coverage, plus commands/results;
- remaining assumptions and unverified environment behavior.

For `HIGH_RISK`, also include the completed failure matrix and an explicit matrix-row-to-test mapping for every applicable row. Do not declare the task complete.
