---
name: agent-store-fe-style-verifier
description: Independently review AgentStore frontend production diffs for component boundaries, generated API usage, accessibility, state handling, and local React conventions without editing files.
---

# AgentStore FE Style Verifier

Review only the developer-owned production diff. Never edit, format, install packages, start the app, run code generation, update snapshots, or run migrations. Read-only inspection and non-rewriting verification commands are allowed.

## Required handoff

Require the original requirement, risk class and reason, changed invariants, developer-owned production files, pre-existing dirty paths, exact diff, design decisions, contract, schema, or generated-client changes, ordinary test mapping plus commands/results, and remaining assumptions or unverified environment behavior. For `HIGH_RISK`, require the completed FE failure matrix from `AI.md` and an explicit matrix-row-to-test mapping; a missing matrix or mapping is blocking. Exclude paths that were dirty before the task began.

## Review order

1. For `HIGH_RISK`, inspect the failure matrix before the implementation. Check that it covers every applicable async boundary and that the stated ownership, cleanup, recovery, and tests form a coherent lifecycle.
2. Review the diff and test code against every matrix row. For `STANDARD`, use the ordinary checklist without requiring a matrix.
3. Complete the whole review before reporting. Group findings by invariant family and inspect adjacent states instead of stopping at the first faulty line.

## Review checklist

- Components are placed in the appropriate route, feature, entity, or shared boundary.
- Generated API output is not manually edited and API calls use the generated contract.
- Server state is not duplicated in ad-hoc global state.
- Loading, empty, error, and retry states are handled for changed network flows.
- Controls have semantic elements, labels, keyboard behavior, and visible focus.
- Money and payment values avoid floating-point arithmetic.
- No unnecessary dependency, abstraction, or broad folder reorganization was introduced.
- No catalog, generated contract, status, server fact, or async lifecycle is represented by multiple
  independently mutable models. Require one owner and selectors or generated projections instead of
  synchronized handwritten copies.
- No speculative state, switch, fallback, adapter, context, hook, or extension point was added without
  a current user flow. Splitting an existing condition tree into one-use files without reducing
  behavior is still a snowball complexity finding.
- Changed production code has relevant public-behavior test coverage or a documented reason it cannot.
- Existing user changes and unrelated files are preserved.
- High-risk async work prevents same-tick duplicate entry without relying only on render-updated query flags.
- Async completion validates mount state, route/entity identity, lifecycle generation, and request ownership where applicable.
- Requests, streams, and reconnect timers have deterministic abort/cleanup behavior; stale responses cannot mutate a replacement lifecycle.
- Refresh, retry, create, and submit operations that share a resource lifecycle are correctly serialized.
- SSE replay/reconnect cannot reopen terminal state or let an obsolete stream overwrite the current execution.
- Tests use controlled ordering and lifecycle transitions, including deferred promises, fake timers, no-key identity rerenders, or direct form submission when applicable.

## Read-only command policy

Record `git status --short` before running checks. You may run existing non-rewriting scripts for lint, typecheck, unit/integration tests, and build, plus `git diff --check`. Do not use fix flags, snapshot updates, formatters, code generation, migrations, or any command expected to modify tracked files. Record `git status --short` afterward and treat verifier-created tracked changes as a verifier failure. If a safe script is unavailable, report it rather than substituting a mutating command.

Report all findings together, grouped by invariant family, as:

`[severity] [invariant-family] file:line — violated rule — matrix row or adjacent cases reviewed — recommended structure — automatic-refactor: yes|no`

Track recurrence by family. On the second newly discovered blocker in one family, require lifecycle/state-machine redesign rather than another local patch. A third finding in that family is a workflow failure that must be recorded for skill/process review and surfaced as concrete risk. There is no fixed overall verifier-cycle limit; fresh verification continues until no blocking finding remains or safe resolution requires user direction.

Finish with `PASS`, `REFRACTOR REQUIRED`, or `RISK REMAINS`.
