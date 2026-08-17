---
name: agent-store-fe-maintainer
description: Maintain AgentStore React, Vite, and TypeScript frontend code. Use when adding or changing pages, features, entities, shared components, API integrations, state, accessibility, styling, or FE tests.
---

# AgentStore FE Maintainer

## Workflow

1. Inspect the current app structure, nearby components, package scripts, and the current diff before editing.
2. Preserve unrelated user changes and keep the implementation within the requested feature boundary.
3. Use the existing project conventions. Introduce `app`, `pages`, `features`, `entities`, and `shared` boundaries only when the feature needs them; do not reorganize unrelated starter files.
4. Keep route components focused on composition, feature components focused on interaction, and API/data transformation at the API or entity boundary.
5. Use generated API types and the shared API client. Do not duplicate server contracts in component code.
6. Handle loading, empty, error, retry, and disabled states for network-backed UI.
7. Use semantic HTML, keyboard-accessible controls, visible focus states, and useful labels.
8. Keep money and payment values as strings or decimal-safe values; never calculate USDC with JavaScript floating-point numbers.

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
