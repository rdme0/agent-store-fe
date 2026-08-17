---
name: git-commit-korean
description: Inspect AgentStore frontend history and current diff, then create small Korean commits that match the repository convention when the user requests commits or commit-ready organization.
---

# Korean Commit Maintainer

Inspect `git log`, `git status`, and the complete diff before proposing or creating commits. Preserve unrelated changes. Group changes by one logical purpose, keep generated output with the contract change that requires it, and use concise Korean commit subjects with the repository's existing emoji/conventional style. Never use destructive reset or checkout commands.
