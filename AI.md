# AI.md

## Skills

Repository-local skills are the source of truth for AgentStore FE work.

### Available skills

- `agent-store-fe-maintainer`: Maintain React, Vite, and TypeScript production code in this repository. Use for feature work, refactoring, testing, and component organization.
- `agent-store-fe-style-verifier`: Independently review FE production diffs without editing them.
- `api-client-maintainer`: Keep generated OpenAPI client types and FE API usage aligned with the BE contract.
- `readme-maintainer`: Keep the FE README aligned with the implemented scope and run commands.
- `git-commit-korean`: Inspect history and create small Korean commits that match repository conventions.

## Local guidance

- Read the relevant skill before changing code in its scope.
- Preserve pre-existing user changes and record dirty paths before implementation.
- Keep generated API files reproducible; never hand-edit generated output.
- Do not add application features while completing repository-harness work.

## Mandatory production-code agent workflow

Apply this workflow to every task that changes production code under `src/`.

1. The coordinator records pre-existing dirty paths in this repository and any paired BE repository.
2. A developer agent uses `$agent-store-fe-maintainer` and runs the narrowest relevant checks.
3. The developer returns a handoff containing the requirement, owned production files, exact diff, design decisions, and test commands/results. The developer does not declare completion.
4. The coordinator creates a fresh, read-only verifier agent using `$agent-store-fe-style-verifier` and passes only the handoff and current worktree.
5. The verifier reviews only developer-owned production changes and reports findings.
6. If a blocking finding exists, send only that finding to the same developer for the smallest refactor and retest.
7. Create a fresh verifier after every refactor. Continue the developer→fresh-verifier cycle until all blocking findings are resolved; do not impose a fixed cycle limit. If a finding cannot be resolved safely, report the concrete blocker and request direction.
8. Complete only when the final verifier has no blocking findings and relevant tests pass.

For FE/BE contract changes, update and verify the BE OpenAPI contract first, then regenerate FE API types and review the generated diff.
